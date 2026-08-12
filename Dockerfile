# syntax=docker/dockerfile:1.7

# Production image for "The Culprit" (Next.js 15, Node.js runtime, Prisma 7 + adapter-pg).
#
# Build once in CI, push to GHCR, pull-and-run on the VPS — the VPS never installs a package or
# compiles anything. See docs/deployment/docker-vps.md for the full pipeline.
#
# Prisma 7 with a driver adapter (`@prisma/adapter-pg`) uses a WASM query compiler, not a native
# Rust engine binary — there is no glibc/musl binary-target concern, so a plain Debian-slim base
# is used instead of Alpine (fewer footguns than musl, still small).

ARG NODE_VERSION=22-slim

# ---- base -------------------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
WORKDIR /app

# ---- dependencies -------------------------------------------------------------------------------
# Full install (incl. devDependencies) — the build stage needs TypeScript, Tailwind, and the
# Prisma CLI. NODE_ENV is intentionally NOT set to production here, or `npm ci` would silently
# skip devDependencies and the build would fail.
FROM base AS dependencies
COPY package.json package-lock.json .npmrc ./
RUN npm ci --legacy-peer-deps

# ---- builder ------------------------------------------------------------------------------------
FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# The repo has no top-level public/ directory (no static assets checked in) — create an empty one
# so the runner stage's COPY below has something to copy regardless.
RUN mkdir -p public

# Public (NEXT_PUBLIC_*) values are inlined into the client bundle by design — they are not
# secret. Server secrets below are NEVER passed as ARG (ARG values persist in image history);
# they are mounted as BuildKit secrets, readable only for the duration of this RUN layer.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_CALENDLY_URL
# Not a NEXT_PUBLIC_* var (it's read server-side, in next.config.ts), but still not secret — it's
# the R2 bucket's public URL by design (see .env.example). next.config.ts's images.remotePatterns
# is computed from this at `next build` time and baked into .next/required-server-files.json — the
# standalone runner never re-reads next.config.ts, so setting R2_PUBLIC_URL only in
# .env.production (runtime) has no effect; it must be present here, at build time.
ARG R2_PUBLIC_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY} \
    NEXT_PUBLIC_CALENDLY_URL=${NEXT_PUBLIC_CALENDLY_URL} \
    R2_PUBLIC_URL=${R2_PUBLIC_URL} \
    NEXT_TELEMETRY_DISABLED=1

# DATABASE_URL/DIRECT_URL/BETTER_AUTH_SECRET are required only because `next build` imports
# src/modules/shared/lib/env.server.ts (Zod-validated at module load) while tracing routes — no
# database connection is actually made at build time. See docs/deployment/docker-vps.md.
RUN --mount=type=secret,id=database_url,required=true \
    --mount=type=secret,id=direct_url,required=true \
    --mount=type=secret,id=better_auth_secret,required=true \
    sh -c '\
      DATABASE_URL="$(cat /run/secrets/database_url)" \
      DIRECT_URL="$(cat /run/secrets/direct_url)" \
      BETTER_AUTH_SECRET="$(cat /run/secrets/better_auth_secret)" \
      npm run build'

# ---- runner ---------------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
# Standalone output: server.js + only the production deps Next actually traced as used.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Safety net: Next's file tracer occasionally misses Prisma's generated client/WASM query
# compiler because it's produced by a codegen step, not a static import. Copy it explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"

# next start's standalone server.js already handles SIGTERM for graceful shutdown; run it as
# PID 1 directly (no shell wrapper) so that signal reaches it undelayed.
CMD ["node", "server.js"]

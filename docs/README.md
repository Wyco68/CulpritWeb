---
status: current
source_of_truth: false
last_updated: 2026-08-08
related_modules: []
related_decisions: []
---

# Project knowledge base — "The Culprit"

This tree exists for **AI coding agents** (and humans) to retrieve current project context before
making changes. It is not user-facing — it ships nothing to the public website and adds no runtime
dependency to the app.

## How the pieces relate

| Document | Role |
|---|---|
| [`PROJECT_SPEC.md`](../PROJECT_SPEC.md) (repo root) | **Primary narrative source of truth.** Full requirements, data model, API, workflows, with inline history (strikethrough + dated notes) preserved. When `docs/` and the spec disagree on a fact, the spec wins — unless a specific contradiction below says otherwise. |
| `docs/requirements/*` | Current-only distilled view of the spec's functional/non-functional requirements and scope — for fast agent lookup, not a replacement for §5/§6/§3 of the spec. |
| `docs/architecture/*` | The **actual shipped architecture**, verified against `src/`, `prisma/schema.prisma`, and `package.json` — not an idealized design. |
| `docs/decisions/ADR-*` | One record per significant architectural decision: context, alternatives, consequences, and what it supersedes. **Authoritative for "why"** — `source_of_truth: true` in frontmatter. |
| `docs/development/*`, `docs/deployment/*` | Conventions and operational notes, cross-checked against actual scripts/config/git history. |
| `.claude/reference/*` | Raw customer/team meeting minutes (controlled documents) — historical record of what was *asked for*, with conflict-resolution notes where the shipped app diverged. |
| `.claude/skills/fullstack-nextjs-starter/references/*` | The **original implementation guide** — see [Known contradictions](#known-contradictions--gaps). Partially stale; do not treat as current without cross-checking `docs/architecture/`. |

## Current vs. historical — the rule

**Never treat a superseded decision as current.** Every doc in this tree describes the *current*
state only; where something changed, the doc links to the relevant ADR instead of re-explaining
the history inline. Concretely:

- Calendly is **embed-only** today. A server-side REST/webhook integration existed 2026-08-02 →
  2026-08-08 and was removed — see [ADR-005](decisions/ADR-005-calendly-embed-only.md). Do not
  reintroduce a `CALENDLY_ACCESS_TOKEN`, REST client, or webhook receiver without a new ADR.
- Appointments have **no review queue** today. A request → approve/decline → book workflow existed
  through 2026-08-05 and was removed — see
  [ADR-004](decisions/ADR-004-appointment-workflow-admin-only.md). Do not add
  `pending`/`approved`/`booked` statuses back without a new ADR.
- There is **no i18n** today, at all — not even the translation-lookup layer without routing. See
  [ADR-006](decisions/ADR-006-remove-i18n-and-locale-routing.md).
- Object storage is **Cloudflare R2** today. Supabase Storage was used 2026-08-05 → 2026-08-08 —
  see [ADR-002](decisions/ADR-002-object-storage-r2.md).

If a document you're reading (including this tree) doesn't clearly say "current," check its
frontmatter `status:` field and its `last_updated` date before relying on it.

## Metadata

Every doc carries lightweight frontmatter:

```yaml
status: current | deprecated | historical
source_of_truth: true | false   # true only for ADRs — the canonical record of a decision's "why"
last_updated: YYYY-MM-DD
related_modules: [...]           # src/modules/* this doc describes
related_decisions: [...]         # ADR IDs this doc depends on or explains
```

## Known contradictions / gaps

Found while building this documentation system (2026-08-08). Not silently fixed — flagged here so
an agent doesn't trust the wrong source, and a human can decide what (if anything) to correct.

1. ~~`PROJECT_SPEC.md §9.1` i18n claim was stale~~ — **fixed 2026-08-08**: the paragraph claiming
   "only the routing layer was cut, copy still goes through next-intl" was corrected in place to
   match the code and `CLAUDE.md` (i18n removed entirely — no `next-intl` dependency, no
   `messages/`, no `src/i18n/`). See
   [ADR-006](decisions/ADR-006-remove-i18n-and-locale-routing.md).
2. **`.claude/skills/fullstack-nextjs-starter/references/{architecture,modules,data-model,security,integrations,ui-ux}.md`
   describe a superseded design**, not the shipped app: `[locale]` routing + next-intl, a
   `notifications` module, a five-state appointment machine with `approve`/`decline`/`book`, a
   `STORAGE_DRIVER=r2|supabase` toggle between two storage adapters, and a `middleware.ts`-based
   admin gate. None of that exists in `src/` today. `docs/architecture/*` and the ADRs in this
   tree are the corrected replacement; the skill's reference files were not updated after the
   2026-08-08 rewrite.
3. ~~No `middleware.ts` exists anywhere in the project~~ — **partially superseded 2026-08-10**:
   `src/middleware.ts` now exists, added by
   [ADR-008](decisions/ADR-008-cloudflare-rate-limiting.md) as a rate-limit fallback on
   `/api/auth/*` and mutating `/api/admin/*`. It still makes **no authorization decision** — the
   admin route guard remains a separate, single server-side `requireAdmin()` check in
   `src/app/(admin)/admin/layout.tsx` (pages) and inside each admin route handler (API). See
   [architecture/authentication.md](architecture/authentication.md).
4. **Audit-log writes happen in the repository layer, not the service layer**, contradicting the
   skill docs' explicit claim ("written in the service layer... not in repositories"). Verified
   across all seven repositories that mutate state. See
   [architecture/overview.md](architecture/overview.md#layers).
5. ~~`CLAUDE.md`'s admin-app description listed "Audit log"~~ — **resolved 2026-08-08**: no viewer
   is planned. `CLAUDE.md` was corrected to drop it from the admin-app description; `AuditLog`
   stays a backend-only audit trail (written by every mutating repository), never a user-facing
   page. See `CLAUDE.md`'s opening paragraph.
6. **`CLAUDE.md`'s commit-type policy (`feat|fix|build|docs` only)** doesn't fully match `git log`:
   one `refactor:` and one `ci:` commit exist alongside 74 commits that do follow the rule. Minor;
   noted in [development/git-workflow.md](development/git-workflow.md).
7. **Minor code-comment staleness**: `src/modules/integrations/index.ts`'s header comment still
   describes the storage adapter as "(Supabase Storage)" though the actual exported/used adapter
   is `R2StorageAdapter`. Not a doc contradiction, just a one-line comment worth a follow-up edit.

## Retrieval

`npm run docs:search -- "<query>"` — see the script header in `scripts/docs-search.mjs` for how
scoring works. Also see [`AGENTS.md`](../AGENTS.md) (repo root) for the full before/after-code-change
workflow this system is meant to support.

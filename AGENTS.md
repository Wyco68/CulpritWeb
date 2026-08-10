# AGENTS.md — instructions for AI coding agents on "The Culprit"

This file tells any AI coding agent (Claude Code or otherwise) how to use this repo's
documentation system **before** and **after** making changes. It is a workflow instruction, not a
requirements document — for requirements/architecture/decisions themselves, see
[`docs/README.md`](docs/README.md).

## The knowledge base, in one paragraph

[`PROJECT_SPEC.md`](PROJECT_SPEC.md) is the primary narrative source of truth, with inline
history preserved. [`docs/`](docs/) is a current-state-only distillation of it, cross-checked
against actual source code, split into `requirements/`, `architecture/`, `decisions/` (ADRs —
authoritative for *why*), `development/`, and `deployment/`. [`CLAUDE.md`](CLAUDE.md) carries
hard project rules and subagent routing. Search all of it with
`npm run docs:search -- "<query>"`. Full map and the current-vs-historical policy:
[`docs/README.md`](docs/README.md).

## Before modifying code

1. **Read the relevant requirements.** Check `docs/requirements/` (functional,
   non-functional, scope) for the feature area you're touching. If the request looks like it
   revives something explicitly out of scope (`docs/requirements/scope.md`'s "Explicitly out of
   scope" list — e.g. a visitor appointment request form, server-side Calendly sync, i18n), stop
   and confirm with the user before building it.
2. **Search for related architecture and decisions**:
   `npm run docs:search -- "<feature or concept>"`. Read the matching `docs/architecture/*.md`
   page(s) and any linked ADR (`docs/decisions/ADR-*.md`) — ADRs carry `source_of_truth: true` and
   are the authoritative record of *why* something is built the way it is.
3. **Check for superseded/deprecated decisions.** If your change resembles something an ADR marks
   as superseded (review-queue appointments, server-side Calendly REST/webhooks, Supabase Storage,
   i18n/locale routing), read that ADR's "Alternatives considered" and "Consequences" sections
   before reintroducing it — there's usually a documented reason it was removed, not just an
   oversight. See [`docs/README.md#known-contradictions--gaps`](docs/README.md#known-contradictions--gaps)
   for the specific places `PROJECT_SPEC.md` or the `.claude/skills/fullstack-nextjs-starter/`
   reference docs are known to be stale — **do not** treat those as current without cross-checking
   `docs/architecture/`.
4. **Inspect the actual implementation** (the module's `.service.ts`/`.repository.ts`/`.schema.ts`,
   the route handler) — docs describe intent, the code is the final authority on current
   behavior. If the code and a doc disagree, trust the code, then flag the doc as stale (see
   "After modifying code" below) rather than silently trusting either source.
5. **Determine whether the requested change conflicts with current requirements or an accepted
   ADR.** If it does, surface the conflict to the user before implementing — don't quietly
   override a documented decision.
6. Only then implement the change.

## After modifying code

1. **Update documentation if architecture or requirements changed.** Edit the relevant
   `docs/architecture/*.md` / `docs/requirements/*.md` page(s) in the same change. Keep
   `last_updated` in the frontmatter current.
2. **Create a new ADR when a significant architectural decision is made** (new dependency, new
   data model shape, a reversed prior decision, a new external integration). Follow the structure
   in any existing `docs/decisions/ADR-*.md` file: Status, Date, Context, Decision, Alternatives
   considered, Consequences, Supersedes/Superseded by. If you don't know the *original* reasoning
   behind something you're superseding, write "Reason not documented in the available project
   history" — do not invent a justification.
3. **Do not modify requirements merely to justify an implementation.** If code and
   `docs/requirements/` disagree, that's a decision to make explicitly (new ADR, or a
   `docs/README.md#known-contradictions--gaps` entry), not something to paper over.
4. **Run the checks**: `npm run typecheck && npm run lint && npm test` (add `npm run build` for
   anything touching config/build-affecting files). Fix failures before considering the change
   done.
5. **Report documentation changes separately** from the code change in your summary to the user —
   don't bury a spec/ADR update inside a code-change description.

## Hard rules

**[`CLAUDE.md`](CLAUDE.md) `## Hard rules` and `## Subagent routing`** are the single source of
truth for standing project rules (layering, Prisma-only-in-repositories, auth model, no-i18n,
Calendly embed-only, free-tier-only, etc.) and for which specialist subagent to delegate to. This
file does not restate them — read `CLAUDE.md` directly so the two never drift out of sync. This
file is scoped to one thing CLAUDE.md doesn't cover: *how to use the `docs/` knowledge base* around
a change.

## Searching the docs

```bash
npm run docs:search -- "appointment workflow"
npm run docs:search -- "why postgres" --json
npm run docs:search -- "old calendly integration" --include-superseded
```

Current docs rank above deprecated/historical ones by default. `--include-superseded` also
searches `.claude/skills/fullstack-nextjs-starter/references/` (the original, partly-stale
implementation guide) — useful only for "what was originally planned" questions, never for "what
should I build."

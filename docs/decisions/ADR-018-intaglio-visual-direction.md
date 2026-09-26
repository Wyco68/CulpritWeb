---
status: current
source_of_truth: true
last_updated: 2026-09-26
related_modules: [shared]
related_decisions: [ADR-016]
---

# ADR-018: Intaglio visual direction replaces the minimalist design language

## Status

Accepted. Supersedes the "professional, minimalist" design language in `PROJECT_SPEC.md` §1/§9 and
the brand personality in `PRODUCT.md`.

## Date

2026-09-26

## Context

The customer found the shipped interface too plain and asked for a site that looks beautiful,
modern, expressive and premium, on both the public site and the admin. Three directions were
proposed; she chose **Intaglio**, which takes its ornament from security printing — the engraved
guilloché linework on banknotes and passports that exists to make a document hard to forge.

The spec was also stale: it still described a dark-navy header, while the code had shipped a
pale-green band since 2026-09.

## Decision

- **Green stays the brand, including the pale green masthead band.** The action colour `#247E5D`
  and the band colour `hsl(150 35% 91%)` are unchanged; the band now carries a generated guilloché
  rosette. (A deep banknote-green band was tried first and reverted the same day at the customer's
  request — she wants her pale green kept.)
- **Light only, permanently.** There is no dark theme, no theme switch and no OS-preference
  variant. `color-scheme: light` stays on `:root` so native controls render light.
- **No logo.** The lab's name, set in type, is the mark. It stays admin-editable.
- **Type:** Newsreader for headings and prose; Schibsted Grotesk for interface text and figures
  (tabular numerals). IBM Plex Mono and the all-caps mono labels were removed.
- **One ornament.** The guilloché appears on the masthead only. Operational screens (admin tables,
  forms, dialogs) stay calm: white panels, status tokens, no pattern.
- **Motion:** CSS only. The rosette draws once on first load; everything else is feedback on a
  user's action. All motion collapses under `prefers-reduced-motion`.
- **Status tokens** `success`, `warning`, `info` join `destructive`, each with a foreground and a
  tint. Status is always icon + label, never colour alone.

## Consequences

- `src/app/globals.css` is the token source; the spec no longer repeats hex values.
- Text, markers and the focus ring on the band use `--accent-on-band` (5.46:1), since `--accent`
  is too faint there (4.19:1).
- Navigation moves from a tab strip into a **sidebar** beneath the header, from `lg` up, on both
  the public site and the admin; below `lg` it opens as a menu sheet. The header stays full width
  across the top and carries the visible "Make Appointment" action (public) or Log out (admin).
- The admin header becomes compact; the large "Admin Panel" title is gone.
- Research works gain an optional card photo (`research.photo_url`, migration
  `20260926120000_research_photo`) and render as cards, three to a row where the content column is
  wide enough; events render as cards the same way. The footer carries no navigation.
- No new runtime dependency is needed for the direction itself.

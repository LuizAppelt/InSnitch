## 2024-05-24 - Initial setup
**Learning:** Setup the palette journal.
**Action:** Started tracking UX findings.

## 2024-05-24 - Missing ARIA Labels on Icon-only Close Buttons
**Learning:** Found that modal close buttons across the app (manage snapshots, settings, extension guide) are icon-only but lack `aria-label` attributes and proper focus states, reducing accessibility for screen reader users.
**Action:** Will add `aria-label="Fechar"` and `focus-visible:ring-2 focus-visible:ring-ig-primary` to these icon-only buttons to improve both screen reader and keyboard accessibility.

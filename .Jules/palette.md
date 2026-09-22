## 2026-09-22 - Custom focus rings for inputs and selects
**Learning:** Interactive elements with 'focus:outline-none' lose critical keyboard navigation feedback. It's a common anti-pattern in Tailwind apps to remove outlines without replacing them with custom rings.
**Action:** Explicitly add 'focus-visible:ring-2 focus-visible:ring-ig-primary' to inputs and selects where outline is disabled to ensure accessibility.

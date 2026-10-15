## 2026-10-15 - Focus States and ARIA labels
**Learning:** Interactive elements with `focus:outline-none` in Tailwind need explicit focus rings for keyboard accessibility (e.g., `focus-visible:ring-2 focus-visible:ring-ig-primary`). Icon-only buttons (like modal close 'X' buttons) often lack ARIA labels, making them inaccessible to screen readers.
**Action:** Added `aria-label` to modal close buttons and `focus-visible:ring-2` to elements using `focus:outline-none` to ensure they remain keyboard accessible without visual outline regressions for mouse users.

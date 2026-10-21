## 2024-05-24 - Improve Keyboard Accessibility on Elements with outline-none
**Learning:** When styling interactive elements like inputs and selects with Tailwind, using `focus:outline-none` removes the default browser focus ring, breaking keyboard accessibility (users can't see what they're tabbing through).
**Action:** When using `focus:outline-none`, always explicitly add custom focus rings (e.g., `focus-visible:ring-2 focus-visible:ring-ig-primary`) to ensure elements remain keyboard accessible while preserving custom styling.


## 2024-05-18 - Mobile-Hidden Text and Outline Removal Focus Accessibility
**Learning:** Found a pattern where interactive elements use `focus:outline-none` without providing alternative focus styles for keyboard users, and navigation buttons heavily rely on text that is hidden on mobile devices (`hidden md:inline`) without screen reader fallbacks (`aria-label`).
**Action:** When styling with Tailwind in this project, explicitly add custom focus rings (e.g., `focus-visible:ring-2 focus-visible:ring-ig-primary`) to interactive elements that use `focus:outline-none`. Always add `aria-label` to buttons where the main descriptive text is hidden on smaller screens or if the button is icon-only.

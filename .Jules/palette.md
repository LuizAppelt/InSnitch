## 2024-10-03 - Fixing Hidden Focus Indicators
**Learning:** The application extensively uses `focus:outline-none` across `<select>` and `<input>` elements in Tailwind to maintain a clean UI, which unintentionally removes focus indicators for keyboard navigation, harming accessibility.
**Action:** Always explicitly re-add focus indicators when removing the default outline. In this project, append `focus-visible:ring-2 focus-visible:ring-ig-primary` to any interactive elements using `focus:outline-none` to ensure keyboard accessibility while preserving the clean visual style.

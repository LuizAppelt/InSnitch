## 2026-10-12 - Improve keyboard accessibility on elements with focus:outline-none
**Learning:** Elements styled with `focus:outline-none` typically lose their default visual focus indication when navigated via keyboard.
**Action:** When styling with Tailwind, explicitly add custom focus rings (e.g., `focus-visible:ring-2 focus-visible:ring-ig-primary`) to interactive elements that use `focus:outline-none` to ensure they remain keyboard accessible.

## 2024-05-15 - Interactive Element Focus Rings
**Learning:** Elements styled with Tailwind's `focus:outline-none` (like custom selects and search inputs) lose their default browser focus indicator, making them inaccessible for keyboard users navigating the app.
**Action:** Always add explicit custom focus rings (e.g., `focus-visible:ring-2 focus-visible:ring-ig-primary`) when removing default outlines to maintain keyboard accessibility.

## 2024-05-18 - Missing focus states on custom form elements
**Learning:** In this project, elements like `<select>` and `<input>` styled with Tailwind often have `focus:outline-none` applied to remove default browser outlines. However, this breaks keyboard accessibility as it removes the visual focus indicator.
**Action:** Always explicitly add custom focus rings (e.g., `focus-visible:ring-2 focus-visible:ring-ig-primary`) to interactive elements that use `focus:outline-none` to ensure they remain accessible to keyboard users.

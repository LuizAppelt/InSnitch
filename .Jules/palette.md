## 2024-05-18 - Missing focus states on custom form elements
**Learning:** When using `focus:outline-none` on form elements (like selects and inputs) in this app to disable the native browser outline, the elements were left completely without a visual focus indicator for keyboard users.
**Action:** When styling with Tailwind in this project, explicitly add custom focus rings (e.g., `focus-visible:ring-2 focus-visible:ring-ig-primary`) to interactive elements that use `focus:outline-none` to ensure they remain keyboard accessible.

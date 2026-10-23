## 2024-03-05 - Restore Keyboard Accessibility on Custom Form Elements
**Learning:** In Tailwind projects, using `focus:outline-none` on form elements like `<select>` and `<input>` removes default browser focus rings, harming keyboard accessibility and tab navigation.
**Action:** Always pair `focus:outline-none` with explicit focus ring classes like `focus-visible:ring-2 focus-visible:ring-ig-primary` to ensure users navigating via keyboard have a clear visual indicator of the focused element.

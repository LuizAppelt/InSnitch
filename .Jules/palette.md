## 2026-10-02 - Keyboard Accessibility with Tailwind
**Learning:** When styling with Tailwind in this project, elements with `focus:outline-none` (used for hiding native outlines on click) lose keyboard focus visibility. Native outlines must be explicitly replaced.
**Action:** Always add custom focus rings (e.g., `focus-visible:ring-2 focus-visible:ring-ig-primary`) to interactive elements that use `focus:outline-none` to ensure they remain accessible to keyboard users while maintaining the desired visual style on mouse click.

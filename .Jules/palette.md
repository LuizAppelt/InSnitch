## 2023-10-27 - Hidden Text Accessibility
**Learning:** Using `hidden md:inline` to hide text on mobile removes it from the accessibility tree, making icon-only buttons on mobile devices inaccessible to screen readers if they lack explicit `aria-label`s.
**Action:** Always add explicit `aria-label`s to buttons or elements that have visible text hidden on smaller screens.

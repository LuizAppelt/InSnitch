## 2026-11-08 - Accessible Responsive Text
**Learning:** Using `hidden {breakpoint}:inline` removes text from the accessibility tree entirely on mobile, leaving screen reader users without context for icon-only buttons.
**Action:** Use `sr-only {breakpoint}:not-sr-only {breakpoint}:inline` to visually hide text on mobile while keeping it available to screen readers.

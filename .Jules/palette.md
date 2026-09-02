## 2026-09-02 - [Inaccessible Mobile Navigation]
**Learning:** Using `hidden md:inline` on button text without providing an `aria-label` makes the buttons entirely inaccessible and unreadable for screen reader users on mobile devices.
**Action:** Always provide an `aria-label` (and consider `title`) for icon-only buttons or buttons where text is hidden responsively.

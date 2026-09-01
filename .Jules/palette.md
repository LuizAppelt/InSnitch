## 2024-05-19 - Added ARIA labels and titles to sidebar and modal buttons
**Learning:** Found that sidebar navigation buttons hide text on smaller screens using `hidden md:inline`, making them icon-only for mobile and screen readers. Also, modal close buttons were icon-only.
**Action:** Always check responsive classes (like `hidden`, `md:inline`) on navigation items to ensure they remain accessible (via `aria-label`) and usable (via `title` tooltip) when text is hidden.

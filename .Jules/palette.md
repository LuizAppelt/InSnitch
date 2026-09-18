## 2024-05-18 - Mobile navigation leaves screen readers blind
**Learning:** Hiding text labels on smaller screens via `hidden md:inline` effectively turns navigation items into icon-only buttons. Without explicit ARIA attributes, screen reader users on mobile viewports lose critical navigation context.
**Action:** Always verify if responsive CSS hides label text and explicitly provide `aria-label`s or visually hidden text for screen readers when designing mobile navigation patterns in Tailwind.

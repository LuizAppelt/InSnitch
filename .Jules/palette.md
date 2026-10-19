## 2024-05-24 - Custom focus rings and aria-labels for hidden text
**Learning:** Interactive elements utilizing `focus:outline-none` can become inaccessible for keyboard navigation. Additionally, buttons with icon-only content or text hidden on mobile screens lack context for screen readers.
**Action:** When styling with Tailwind, explicitly add custom focus rings (e.g., `focus-visible:ring-2 focus-visible:ring-ig-primary`) to elements with `focus:outline-none`. Always provide `aria-label` attributes for icon-only buttons or buttons where text is conditionally hidden.

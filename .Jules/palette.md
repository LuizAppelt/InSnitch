## 2024-03-22 - Modal Close Buttons Accessibility
**Learning:** Icon-only modal close buttons lacked screen reader support and visible keyboard focus states.
**Action:** Always add `aria-label` (e.g., "Fechar") and visible focus rings (`focus-visible:ring-2 focus:ring-ig-primary focus:outline-none`) to icon-only buttons for accessibility.
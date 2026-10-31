## 2026-10-31 - Added custom focus rings to improve keyboard accessibility for select and input elements
**Learning:** This app frequently uses 'focus:outline-none' on its interactive elements without providing custom focus rings, hindering keyboard navigation for users relying on visual cues.
**Action:** Replace 'focus:outline-none' with custom tailwind focus ring utility classes such as 'focus:outline-none focus-visible:ring-2 focus-visible:ring-ig-primary' in interactive elements across the application.
## 2026-10-31 - Added ARIA labels to icon-only buttons
**Learning:** The application uses several modal close buttons containing only icons ('x') without text or ARIA labels, making their purpose ambiguous to screen reader users.
**Action:** Always add 'aria-label' to icon-only buttons to ensure they remain accessible to assistive technologies.

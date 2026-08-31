## 2024-08-31 - Improved Accessibility for Icon-Only Buttons
**Learning:** Found several icon-only buttons (like "X" close buttons on modals, and theme toggles) that lacked accessible names. The theme toggle text is hidden on mobile, meaning screen readers only saw the icon without context.
**Action:** Always ensure `aria-label` attributes are added to buttons that rely solely on icons for meaning, or where text is visually hidden on smaller screens.

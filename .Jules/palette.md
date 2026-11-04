## 2024-03-24 - Accessibility improvements for Tailwind UI
**Learning:** Found several elements using 'focus:outline-none' which removes keyboard navigation indicators. Icon-only buttons and selects lacked descriptive 'aria-label' attributes.
**Action:** Added 'focus-visible:ring-2 focus-visible:ring-ig-primary' to interactive elements and descriptive 'aria-label's to select menus and icon buttons to ensure WCAG compliance while preserving design intent.

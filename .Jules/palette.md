## 2024-05-14 - Mobile Hidden Text & Keyboard Navigation
**Learning:** Buttons with `hidden md:inline` text become icon-only on mobile. Without `aria-label`s, they are completely inaccessible to screen reader users on mobile devices. Additionally, interactive elements using `focus:outline-none` lose their focus indicators, preventing keyboard navigation.
**Action:** Always add `aria-label` or `title` to buttons where text is hidden responsively. Ensure `focus-visible:ring-2 focus-visible:ring-ig-primary` is applied alongside `focus:outline-none`.

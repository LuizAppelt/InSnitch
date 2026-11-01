## 2024-05-14 - Accessible Close Buttons and Focus Rings
**Learning:** This app extensively uses Lucide icons without accessible text (e.g., `<i data-lucide="x"></i>`) for modal close buttons, and often removes default focus rings using `focus:outline-none` on select/input elements without providing alternatives.
**Action:** Always explicitly add `aria-label="Fechar"` to icon-only close buttons in modals, and append `focus-visible:ring-2 focus-visible:ring-ig-primary` when using `focus:outline-none` on interactive elements to preserve keyboard accessibility.

## 2026-09-28 - Missing ARIA Labels on Icon-Only Modal Close Buttons
**Learning:** Found multiple instances of icon-only close buttons (`<i data-lucide="x"></i>`) in modals without `aria-label` attributes or proper focus states, making them inaccessible to screen readers and difficult to use for keyboard navigators.
**Action:** Always add `aria-label="Fechar"` and appropriate focus indicators (`focus-visible:ring-2 focus-visible:ring-ig-primary focus-visible:outline-none`) to icon-only buttons, especially in modals, to ensure accessibility.

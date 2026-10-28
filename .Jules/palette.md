## 2024-05-24 - Focus Rings & Accessible Buttons
**Learning:** Adding custom focus rings (`focus-visible:ring-2 focus-visible:ring-ig-primary`) to interactive elements like `select` and `input` that use `focus:outline-none` is crucial for keyboard accessibility. Icon-only buttons must have `aria-label` attributes to ensure they are readable by screen readers.
**Action:** Replace `focus:outline-none` with `focus:outline-none focus-visible:ring-2 focus-visible:ring-ig-primary` in interactive elements, and add `aria-label` to all close buttons (`<button ...><i data-lucide="x"></i></button>`).

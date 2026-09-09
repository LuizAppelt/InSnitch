## 2024-05-19 - Accessible Focus Rings on Interactive Elements
**Learning:** In this application's custom UI, elements utilizing Tailwind's `focus:outline-none` can cause keyboard accessibility issues (e.g., hidden focus state when tabbing).
**Action:** When overriding the default focus outline with `focus:outline-none`, explicitly add `focus-visible:ring-2 focus-visible:ring-ig-primary` to restore keyboard accessibility while maintaining visual design.

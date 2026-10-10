## 2024-05-24 - Restore Focus Rings for Keyboard Accessibility
**Learning:** Elements styled with `focus:outline-none` in Tailwind lose default focus rings, which harms keyboard accessibility for visually impaired users.
**Action:** When using `focus:outline-none`, explicitly add `focus-visible:ring-2 focus-visible:ring-ig-primary` to restore keyboard accessibility while avoiding focus rings on mouse clicks.

## 2024-11-20 - Focus Rings on Form Elements
**Learning:** Widespread use of `focus:outline-none` on interactive form elements (select, inputs) hides the default focus ring, making keyboard navigation difficult for accessibility.
**Action:** When using `focus:outline-none`, always explicitly add alternative focus indicators like `focus-visible:ring-2 focus-visible:ring-ig-primary` to ensure keyboard accessibility without affecting mouse users.

## 2026-09-15 - [Preserve Accessible Focus Rings]
**Learning:** When using Tailwind CSS, applying `focus:outline-none` to remove default browser outlines on inputs or selects completely breaks keyboard accessibility by removing the focus indicator. This is a common pattern that creates a major accessibility barrier.
**Action:** Always pair `focus:outline-none` with explicit custom focus indicators, such as `focus-visible:ring-2 focus-visible:ring-ig-primary`, to ensure interactive elements remain identifiable for keyboard users while maintaining the desired aesthetic.

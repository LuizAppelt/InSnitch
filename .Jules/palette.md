
## 2023-10-01 - Focus Outline Customizations & Mobile Hidden Text Labels
**Learning:** Found two patterns in this repo requiring attention for accessibility:
1. `focus:outline-none` was frequently being used without a fallback, which removes standard keyboard accessibility focus indicators.
2. The UI relies heavily on text labels being visually hidden on mobile devices (e.g., `hidden md:inline`).

**Action:**
1. Always apply `focus-visible:ring-2 focus-visible:ring-ig-primary` alongside `focus:outline-none` for interactive elements to retain focus accessibility.
2. Ensure buttons with `hidden md:inline` text explicitly have an `aria-label` attribute on the outer button container so that screen readers pronounce the label effectively on all sizes.

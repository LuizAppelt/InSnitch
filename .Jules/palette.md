## 2024-05-24 - explicit focus rings

**Learning:** This app extensively uses `focus:outline-none` on standard form elements (select, input) to suppress default browser outlines for visual aesthetics, but failed to provide custom focus indicators, severely impacting keyboard accessibility.
**Action:** When removing default outlines in Tailwind (`focus:outline-none`), always pair it with custom focus rings (e.g., `focus-visible:ring-2 focus-visible:ring-ig-primary`) to maintain accessibility without compromising the design system.

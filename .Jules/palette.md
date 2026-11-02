## 2024-03-24 - Initial Palette setup\n**Learning:** Need a place to journal critical UX learnings.\n**Action:** Created this file to track future UX/a11y insights.
## 2024-03-24 - Missing ARIA Labels on Modal Close Buttons
**Learning:** Icon-only modal close buttons in the app often lack ARIA labels, making them invisible to screen readers, and lack visible focus styles, hurting keyboard navigation.
**Action:** When working on modals, always add `aria-label="Fechar"` and appropriate focus ring styles (`focus:outline-none focus-visible:ring-2 focus-visible:ring-ig-primary`) to the close buttons.

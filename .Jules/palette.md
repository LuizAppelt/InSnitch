## 2026-10-06 - Focus Rings on Outline-None Elements & Icon-Only Button ARIA Labels
**Learning:** Using 'focus:outline-none' on interactive elements like inputs and selects without providing alternative focus styles breaks keyboard accessibility. Also, modal close buttons that only use icons are not accessible to screen readers.
**Action:** Always add custom focus rings (e.g. 'focus-visible:ring-2 focus-visible:ring-ig-primary') when removing default outlines, and always provide translated 'aria-label' attributes (e.g. 'aria-label="Fechar"') for icon-only buttons.

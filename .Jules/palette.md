## 2024-11-12 - Add ARIA Labels to Icon-only Close Buttons
**Learning:** Found several icon-only close buttons in modals (lines 669, 711, 750) missing ARIA labels, making them inaccessible to screen readers.
**Action:** Adding `aria-label="Fechar"` to these icon-only buttons to improve screen reader accessibility in Portuguese, the primary language of the application.

## 2026-11-09 - Add ARIA Labels to Modal Close Buttons
**Learning:** Found multiple modal close buttons (x icon only) lacking ARIA labels, creating an accessibility issue for screen readers in this application's specific modal implementation pattern.
**Action:** Always add 'aria-label="Fechar"' to icon-only close buttons in modals.

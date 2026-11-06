## 2024-11-06 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found multiple icon-only buttons (like delete, close modal, and refresh) missing ARIA labels. Since they rely purely on visual context (icons), screen readers wouldn't know their purpose, causing accessibility issues.
**Action:** Always verify if a button lacks text content (or if its text content is hidden). If it does, ensure it has a descriptive `aria-label`.

## 2024-11-06 - Missing Custom Focus Rings
**Learning:** Found several `select` and `input` elements utilizing `focus:outline-none` but missing proper custom focus rings. This makes keyboard navigation difficult since the active element isn't visually distinct.
**Action:** When using `focus:outline-none`, always append `focus-visible:ring-2 focus-visible:ring-ig-primary` or similar visual indicator so keyboard users can track their focus.

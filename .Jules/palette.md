## 2024-05-18 - Missing ARIA Labels on Icon Buttons
**Learning:** Found multiple icon-only buttons (using lucide icons like close modal buttons) in `static/index.html` that are completely missing `aria-label` attributes, making them inaccessible to screen readers.
**Action:** Will add appropriate `aria-label` attributes in Portuguese (e.g. "Fechar modal", "Alternar tema") to improve accessibility.

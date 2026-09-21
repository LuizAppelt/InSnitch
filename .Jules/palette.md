## 2024-05-18 - Missing focus indicators for keyboard navigation
**Learning:** Found that multiple interactive elements (`<select>`, `<input>`) in the application use `focus:outline-none`, breaking keyboard accessibility. These elements lack a fallback focus indicator, making it difficult for keyboard users to know where they are.
**Action:** Adding custom focus rings (`focus-visible:ring-2 focus-visible:ring-ig-primary`) to replace `focus:outline-none` and improve a11y. Adding appropriate aria-labels to elements without visible text labels.

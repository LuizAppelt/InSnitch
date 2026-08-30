## 2024-08-30 - Labels and ARIA Labels
**Learning:** Found multiple form inputs in modals missing `for` attributes on their labels, making it difficult for users to click the labels to focus the inputs. Also found icon-only "close" buttons in modals missing `aria-label`s, which is problematic for screen reader accessibility.
**Action:** When adding modals or forms, ensure all labels have a `for` attribute corresponding to the `id` of the input they describe. For icon-only buttons, always include an `aria-label` explaining the action.

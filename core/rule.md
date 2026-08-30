# Public six-bucket routing rule

Route every artifact by four ordered questions:

1. **Role** — authority, reusable capability, scaffold, active source, deliverable, or runtime state?
2. **Lifecycle** — live input or produced result?
3. **Reuse scope** — repository-wide, project-specific, or machine-private?
4. **Privacy** — does it contain credentials, personal data, logs, or local state?

| Bucket | Primary role | Public release rule |
|---|---|---|
| `core/` | identity-neutral authority and governance | include only portable rules |
| `capabilities/` | reusable execution logic | include reviewed code and skills |
| `template/` | examples, tests, starter scaffolds | include anonymous fixtures |
| `projects/` | active source-of-work | include examples only |
| `outputs/` | generated deliverables | include protocol, not real outputs |
| `local-runtime/` | mutable machine state | include interface notes only |

Privacy overrides convenience: credentials, personal memory, raw logs, and
machine-specific configuration are always local-only.

# Load-test example – city traffic management

This example contains **3 000 XDRS content files** for a fictional city traffic management authority and is used to load-test xdrs-core querying, context-window handling, and lint performance.

## Domain

The `city-traffic` scope covers a multi-modal transport authority managing:

- Trains, buses, road vehicles, bicycles, and pedestrians
- Infrastructure, systems, monitoring, maintenance, standards, and new development
- Operations, governance, services, and finance
- Engineering platforms, integrations, pipelines, and quality

## File distribution

| Type | Count | % |
|---|---|---|
| Policy | 1500 | 50 % |
| Research | 450 | 15 % |
| Skills (SKILL.md) | 600 | 20 % |
| Articles | 300 | 10 % |
| Initiatives | 150 | 5 % |
| **Total** | **3 000** | **100 %** |

Decision breakdown: 600 ADRs · 450 BDRs · 450 EDRs

## Regenerating the files

```bash
node generate.js
```

The generator is deterministic and idempotent.

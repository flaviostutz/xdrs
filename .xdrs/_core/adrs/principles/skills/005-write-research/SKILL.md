---
name: 005-write-research
description: >
  Creates a new research document following XDR research standards: selects scope, type, subject, and number;
  then writes a focused study of constraints, findings, and option proposals with pros and cons.
  Activate this skill when the user asks to create, add, or write a research document that backs a decision.
metadata:
  author: flaviostutz
  version: "1.0"
---

## Overview

Guides the creation of a well-structured research document by following `_core-adr-006`, checking related XDRs and existing research to avoid duplication, and producing a concise study that supports a decision lifecycle without replacing the XDR.

## Instructions

### Phase 1: Understand the Research Goal

1. Read `.xdrs/_core/adrs/principles/006-research-standards.md` in full to internalize the folder layout, numbering rules, and mandatory template.
2. Identify the problem or question being explored, the main constraints or requirements, and which decision or decision threads this research supports.
3. Do NOT proceed without a clear problem statement and at least one concrete constraint or requirement.

### Phase 2: Select Scope, Type, Subject, and Number

**Scope** — use `_local` unless the user explicitly names another scope.

**Type** — match the type of decision this research supports (`adrs`, `bdrs`, or `edrs`).

**Subject** — pick the most specific subject that matches the problem domain.

**Research number** — scan `.xdrs/[scope]/[type]/[subject]/researches/` for the highest existing number and increment by 1. Never reuse numbers from deleted research documents.

### Phase 3: Research Existing Artifacts

1. Read relevant XDRs across all scopes listed in `.xdrs/index.md`.
2. Read existing research documents in the same or overlapping subjects to avoid duplicating the same study.
3. Read related skills or articles if they contain context, implementation limits, or terminology that must be reflected.
4. Collect links that should appear in the final `## References` section.

### Phase 4: Write the Research Document

Use the mandatory template from `006-research-standards`:

```markdown
# [scope]-research-[number]: [Short Title]

## Overview

[Brief description of the problem or question, audience, and decision thread(s) it supports.]

Question: [Central question of the research]?

## Constraints

- [Constraint 1]

## Findings

- [Finding 1]

## Proposals

### Option 1: [Name]

[Short description]

**Pros**
- [Benefit]

**Cons**
- [Drawback]

## Recommendation

[Optional preferred direction]

## References
```

Rules:
- Focus on exploring options under stated constraints; do not turn the document into the final decision.
- End the `## Overview` section with `Question: [central question]?` so the main research question is explicit.
- Make it explicit when the same research may feed multiple downstream XDRs.
- Include a few meaningful proposals and summarize pros and cons for each.
- Keep findings concrete and useful for later discussion or revision.
- Keep the document under 2000 lines. Prefer much shorter when possible.
- Treat `Research` as the artifact name; `researches/` is only the folder name.
- Use lowercase file names. Never use emojis.

### Phase 5: Review the Draft

Before writing files, verify:

1. **Problem clarity**: Is the research question explicit?
2. **Constraints**: Are the most important constraints stated clearly?
3. **Option quality**: Do the proposals represent real alternatives with non-trivial pros and cons?
4. **Decision boundary**: Does the text support a decision without pretending to be the XDR itself?
5. **References**: Are all related XDRs, research docs, skills, or articles linked, including multiple decisions when applicable?

If any check fails, revise before continuing.

### Phase 6: Write Files

1. Create the research file at `.xdrs/[scope]/[type]/[subject]/researches/[number]-[short-title].md`.
2. Add an entry to `.xdrs/[scope]/[type]/index.md`.
3. Add back-references from the related XDR, article, or skill when the relationship is important for discovery.

## Examples

**Input**: "Create research comparing package distribution options for our XDR scopes"

**Expected actions:**
1. Read `006-research-standards.md`.
2. Choose type `adrs` and subject `principles`.
3. Scan `.xdrs/_local/adrs/principles/researches/` for the next number.
4. Read related XDRs about packaging and versioning.
5. Write a research document with constraints, findings, and options such as npm package, git submodule, and copy-paste distribution.
6. Add references to the resulting XDR if a decision is later created.

## Edge Cases

- If the user is really asking for a final decision, write an XDR instead of research.
- If only one viable option exists, still record why alternatives were excluded or unavailable.
- If the document grows too large, split independent problem threads into separate research files.
- If the supported decision does not exist yet, reference the decision topic or planned XDR title in the overview.

## References

- [_core-adr-006 - Research standards](../../006-research-standards.md)
- [_core-adr-001 - XDR standards](../../001-xdr-standards.md)
- [002-write-xdr skill](../002-write-xdr/SKILL.md)
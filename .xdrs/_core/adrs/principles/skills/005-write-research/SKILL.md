---
name: 005-write-research
description: >
  Creates a new research document following XDR research standards: selects scope, type, subject, and number;
  then writes an IMRAD-based study with enough evidence and method detail to support future decisions.
  Activate this skill when the user asks to create, add, or write a research document that backs a decision.
metadata:
  author: flaviostutz
  version: "1.0"
---

## Overview

Guides the creation of a well-structured research document by following `_core-adr-006`, checking related XDRs and existing research to avoid duplication, and producing an IMRAD-based study that supports a decision lifecycle without replacing the XDR. Treat each section goal in the research template as an acceptance criterion, not as optional wording.

## Instructions

### Phase 1: Understand the Research Goal

1. Read `.xdrs/_core/adrs/principles/006-research-standards.md` in full to internalize the folder layout, numbering rules, and mandatory template.
2. Identify the problem or question being explored, who needs the result, which decision or decision threads this research supports, and why the study matters now.
3. Internalize the goal of each required section before drafting: `Abstract` proves relevance quickly, `Introduction` explains why the study exists, `Methods` makes the important parts reproducible, `Results` records raw findings with minimal interpretation, `Discussion` interprets the findings, `Conclusion` summarizes next use, and `References` makes sources traceable.
4. Collect the main constraints, known facts, important experiences, gaps, and assumptions that belong in the introduction.
5. Do NOT proceed without a clear problem statement, a central question, and at least one credible source of evidence or a method for generating it.

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

### Phase 4: Create the Skeleton and Frame the Study

1. Create the final section skeleton in the research file before running the study: `Abstract`, `Introduction`, `Methods`, `Results`, `Discussion`, `Conclusion`, `References`.
2. Write a one-line note under each section heading capturing that section's goal before filling in the content so the draft stays disciplined.
3. Draft `## Introduction` early so the problem, scope, constraints, assumptions, and central question are fixed before evidence collection expands.
4. Draft `## Methods` before or while executing the study so tools, data sources, and conditions are captured while they are still precise.
5. Treat `## Abstract` as a late-stage summary. Do not try to finalize it yet.

### Phase 5: Capture Evidence as the Study Runs

1. As experiments, comparisons, code spikes, interviews, benchmarks, or document reviews happen, append the concrete findings to `## Results` continuously.
2. Prefer capturing tables, bullet points, numbers, code outputs, and option comparisons while the evidence is fresh.
3. If multiple options solve the same problem, add a comparison table and explicit pros and cons for each option in `## Results` so the research can support later decision making.
4. Update `## Methods` whenever the actual study design changes so the final document remains reproducible.
5. Keep interpretation out of `## Results`; record observations first and save meaning-making for `## Discussion`.

### Phase 6: Synthesize After Results Stabilize

1. Write `## Discussion` only after the important findings are visible in `## Results`.
2. Use `## Discussion` to interpret significance, trade-offs, limitations, implications, and performance considerations for technical readers.
3. Write `## Conclusion` after the discussion so it reflects the actual findings and the most likely next uses of the research.
4. Write `## Abstract` last so it accurately summarizes the final goal, methods, results, and conclusion for executives or quick readers.

### Phase 7: Write the Research Document

Use the mandatory template from `006-research-standards`:

```markdown
# [scope]-research-[number]: [Short Title]

## Abstract

[Single paragraph summarizing the goal, methods, results, and conclusion. Goal: help executives or quick readers decide whether the paper is relevant. Under 200 words.]

## Introduction

[Describe the problem, context, constraints, known facts, experiences, gaps, assumptions, and objectives.
Use visuals, bullets, graphs, or diagrams when helpful. Goal: explain why this study exists. Under 700 words.]

Question: [Central question of the research]?

## Methods

[Explain how the study was conducted, including design, tools, data sources, and test conditions.
Include enough detail for an experienced professional to reproduce the relevant parts. Goal: make the important parts of the study reproducible. Under 1200 words.]

## Results

[Report findings, data, trends, quantitative results, code artifacts, and option comparisons.
Use figures, tables, or bullets when useful. If multiple options solve the same problem, add comparison tables and explicit pros and cons for each option. Focus on raw findings, not interpretation. Goal: present the raw findings with minimal interpretation. Under 1800 words.]

## Discussion

[Interpret the results, explain significance, trade-offs, performance considerations, limitations, and implications. Goal: interpret the findings for technical readers. Keep this section technically engaged and under 1000 words.]

## Conclusion

[Summarize the main findings and how the research can be used in next steps. Goal: summarize the main findings and how they should be used next. Under 400 words.]

## References

[A list of all cited literature, websites, tutorials, documentation, discussions, and related artifacts. Goal: make all cited sources and supporting artifacts traceable.]

- [Related XDR or artifact](relative/path.md) - Why it matters
- [Another related XDR if this research informed multiple decisions](relative/path.md) - Why it matters
```

Rules:
- Treat the goal sentence of each section as a hard check on what belongs in that section.
- Focus on exploring and evidencing the problem space; do not turn the document into the final decision.
- Make it explicit when the same research may feed multiple downstream XDRs.
- Use good-enough evidence. Experienced professional judgment is allowed, but the conclusions still need support that other colleagues can inspect and learn from.
- Ensure the methods and test conditions are reproducible enough for an experienced professional to rerun or evolve the critical parts later.
- Use visuals, bullet points, graphs, or diagrams when they improve clarity, especially in the introduction and results.
- Keep section word limits within the standard and keep the document under 5000 words total unless the introduction explicitly states that a very detailed analysis is required.

### Phase 8: Check Section Goals

Before the final review, verify each section against its specific goal:

1. **Abstract goal**: Does it help a quick reader decide whether the research is relevant, in one paragraph and under 200 words?
2. **Introduction goal**: Does it explain why the study exists, stay within scope, and end with `Question: ...?`?
3. **Methods goal**: Could an experienced professional reproduce the important parts that materially affect the conclusion?
4. **Results goal**: Are the findings concrete and minimally interpreted, with comparisons and pros/cons when multiple options exist?
5. **Discussion goal**: Does it interpret the findings rather than repeat the results?
6. **Conclusion goal**: Does it summarize the main findings and the likely next uses without introducing new evidence?
7. **References goal**: Are cited sources and related artifacts traceable, including related XDRs, skills, articles, and research where relevant?

If any section fails its goal, revise that section before continuing.

### Phase 9: Review the Draft

Before writing files, verify:

1. **Problem clarity**: Is the research question explicit?
2. **Section discipline**: Does each section contain the right kind of content with minimal duplication?
3. **Method quality**: Could an experienced professional reproduce or extend the important parts of the study from the methods section?
4. **Evidence quality**: Are the results concrete enough to support the discussion and conclusion?
5. **Decision boundary**: Does the text support a decision without pretending to be the XDR itself?
6. **References**: Are all related XDRs, research docs, skills, articles, and external sources linked when relevant?

If any check fails, revise before continuing.

### Phase 10: Write Files

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
5. Write an IMRAD-based research document comparing options such as npm package, git submodule, and copy-paste distribution, with the comparison grounded in methods and results.
6. Add references to the resulting XDR if a decision is later created.

## Edge Cases

- If the user is really asking for a final decision, write an XDR instead of research.
- If only one viable option exists, still explain what was evaluated, what was ruled out, or what constraints removed the alternatives.
- If the document grows too large, split independent problem threads into separate research files unless the introduction explicitly justifies a longer study.
- If the supported decision does not exist yet, reference the decision topic or planned XDR title in the introduction and conclusion.

## References

- [_core-adr-006 - Research standards](../../006-research-standards.md)
- [_core-adr-001 - XDR standards](../../001-xdr-standards.md)
- [002-write-xdr skill](../002-write-xdr/SKILL.md)
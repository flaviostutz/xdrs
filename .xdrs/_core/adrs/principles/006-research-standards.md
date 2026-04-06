# _core-adr-006: Research standards

## Context and Problem Statement

Teams often need more space than an XDR allows to evaluate constraints, explore options, and record findings before or after a decision changes. When that material is scattered across PR comments, docs, and chat, the reasoning behind a decision becomes hard to recover or update.

Question: How should research documents be structured and organized so they support the decision lifecycle without replacing XDRs as the source of truth?

## Decision Outcome

**IMRAD-based subject-level research documents co-located with XDRs**

Research documents are Markdown files placed inside a subject folder alongside decision records. They use an IMRAD-inspired paper structure adapted to company needs so teams can combine experienced professional judgment with good-enough evidence, preserve reproducibility where it matters, and revisit the work when technology, constraints, or facts change.

### Implementation Details

- Research is evidence and exploration, not the adopted decision. When a research document and an XDR disagree, the XDR takes precedence.
- `Research` is the artifact name. `researches/` is only the folder name used alongside `skills/` and `articles/`.
- Research documents MUST live under `researches/` inside the relevant subject folder:
  `.xdrs/[scope]/[type]/[subject]/researches/[number]-[short-title].md`
- Research documents SHOULD stay focused on one problem statement or decision thread.
- Research documents MUST state clearly what problem or question is being investigated and who needs the result.
- Research documents MUST follow this section order: `Abstract`, `Introduction`, `Methods`, `Results`, `Discussion`, `Conclusion`, `References`.
- Research uses a company-adapted IMRAD structure. It MAY include informed professional judgment and experience-based observations, but claims that affect the conclusion MUST have enough evidence to be teachable, reviewable, and useful to other colleagues.
- Research does not require full academic statistical rigor. Use good-enough evidence that supports the conclusion without demanding exhaustive proof.
- Research documents MUST describe the methods, tools, sources, and conditions with enough detail that an experienced professional could at least minimally reproduce the important parts of the study, especially the aspects that materially affected the conclusion.
- The short title portion after the research id MUST stay under 20 words.
- `## Abstract` MUST be a single paragraph under 200 words summarizing the goal, methods, results, and conclusion. It SHOULD help executives or quick readers decide whether the paper is relevant.
- `## Introduction` MUST define the problem, context, constraints, known facts, experiences, gaps, assumptions, and objectives. It SHOULD use visuals, bullet points, graphs, or diagrams when that improves understanding. It MUST stay under 700 words and MUST end with `Question: [central question]?`.
- `## Methods` MUST explain how the study was conducted, including design, tools, data sources, and test conditions, with a reproducibility goal. It MUST stay under 1200 words.
- `## Results` MUST present findings, data, trends, quantitative results, produced code, and option comparisons when relevant. It SHOULD use figures, tables, or bullet lists where useful. Keep interpretation to a minimum. It MUST stay under 1800 words.
- When different options for the same problem are being analyzed, `## Results` SHOULD include comparison tables and explicit pros and cons for each option so the research can support later decision making.
- `## Discussion` MUST interpret the results, explain significance, trade-offs, performance considerations, limitations, and implications for technical readers. It MUST stay under 1000 words.
- `## Conclusion` MUST summarize the main findings and the likely next uses of the research. It MUST stay under 400 words.
- `## References` MUST list all cited literature, websites, tutorials, documentation, discussions, or related artifacts.
- In general, research SHOULD roughly follow the proportion `Introduction : Methods : Results : Discussion ≈ 3 : 5 : 6 : 4`.
- Be strict about the goal of each section. Avoid duplicating the same material across sections and prefer clarity over rhetorical flourishes.
- Research documents SHOULD stay under 5000 words total. They MAY exceed that only when the `## Introduction` explicitly states that the study will be lengthy because a very detailed analysis is required.
- Research documents SHOULD link to the XDRs, skills, articles, discussions, and external references they informed.
- One research document MAY inform multiple XDRs, including a mix of ADRs, BDRs, and EDRs, when the same investigation produced several downstream decisions.
- Research file names MUST be lowercase. Never use emojis.
- A research document MAY exist before the related XDR is written, or remain after the XDR changes, as long as its status and references stay clear.

**Folder layout**

```
.xdrs/[scope]/[type]/[subject]/
  researches/
    [number]-[short-title].md
```

Examples:
- `.xdrs/_core/adrs/principles/researches/001-research-and-decision-lifecycle.md`
- `.xdrs/business-x/adrs/platform/researches/003-api-gateway-options.md`
- `.xdrs/_local/edrs/ai/researches/002-model-serving-constraints.md`

**Research numbering**

- Each research document has a number unique within its `scope/type/subject/researches/` namespace.
- Determine the next number by checking the highest number already present in that namespace.
- Never reuse numbers of deleted research documents. Gaps are expected.

**Research template**

All research documents MUST follow this template:

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

## Considered Options

- Related research: [001-research-and-decision-lifecycle](researches/001-research-and-decision-lifecycle.md)

* (REJECTED) **Inline long-form analysis inside the XDR** - Put all research and decision text in one file.
  * Reason: Makes XDRs too long, mixes evidence with the adopted rule set, and hurts fast retrieval by humans and AI agents.
* (CHOSEN) **IMRAD-based subject-level research beside XDRs** - Keep exploratory material beside the decisions, skills, and articles it informs, using an IMRAD-inspired structure adapted to company work.
  * Reason: Preserves lifecycle context, keeps the XDR concise, gives readers a predictable structure, and raises evidence quality without demanding full academic rigor.

## References

- [_core-adr-001 - XDR standards](001-xdr-standards.md)
- [_core-adr-003 - Skill standards](003-skill-standards.md)
- [_core-adr-004 - Article standards](004-article-standards.md)
- [005-write-research skill](skills/005-write-research/SKILL.md) - Step-by-step instructions for creating a research document
# _core-adr-006: Research standards

## Context and Problem Statement

Teams often need more space than an XDR allows to evaluate constraints, explore options, and record findings before or after a decision changes. When that material is scattered across PR comments, docs, and chat, the reasoning behind a decision becomes hard to recover or update.

Question: How should research documents be structured and organized so they support the decision lifecycle without replacing XDRs as the source of truth?

## Decision Outcome

**subject-level research documents co-located with XDRs**

Research documents are Markdown files placed inside a subject folder alongside decision records. They capture the explored option space, relevant constraints, findings, and proposal tradeoffs that back a decision during elaboration, discussion, approval, retirement, and updates.

### Implementation Details

- Research is evidence and exploration, not the adopted decision. When a research document and an XDR disagree, the XDR takes precedence.
- `Research` is the artifact name. `researches/` is only the folder name used alongside `skills/` and `articles/`.
- Research documents MUST live under `researches/` inside the relevant subject folder:
  `.xdrs/[scope]/[type]/[subject]/researches/[number]-[short-title].md`
- Research documents SHOULD stay focused on one problem statement or decision thread.
- Research documents MUST state clearly what problem or question is being investigated and who needs the result.
- The `## Overview` section MUST end with a line in the form `Question: [central question]?` that states the central question the research answers.
- Research constraints MAY include hard requirements, stack limitations, regulatory limits, or other conditions that narrow the option space.
- Research documents MUST summarize the problem constraints, important findings, and a small set of proposals with pros and cons for each option.
- Research proposals are the considered options for the decision thread. They are not the final policy.
- Research documents SHOULD link to the XDRs, skills, articles, discussions, and external references they informed.
- One research document MAY inform multiple XDRs, including a mix of ADRs, BDRs, and EDRs, when the same investigation produced several downstream decisions.
- Research documents SHOULD remain concise enough to read end-to-end. Target under 500 lines; hard limit 2000 lines.
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

## Overview

[Brief description of the problem or question being explored, who needs the result, and the decision thread(s) it supports. Under 5 lines.]

Question: [Central question of the research]?

## Constraints

- [Constraint or requirement 1]
- [Constraint or requirement 2]

## Findings

- [Important finding 1]
- [Important finding 2]

## Proposals

### Option 1: [Name]

[Short description of the option.]

**Pros**
- [Benefit 1]
- [Benefit 2]

**Cons**
- [Drawback 1]
- [Drawback 2]

### Option 2: [Name]

[Same structure as above for each meaningful option.]

## Recommendation

[Optional summary of the currently preferred direction, if any.]

## References

- [Related XDR or artifact](relative/path.md) - Why it matters
- [Another related XDR if this research informed multiple decisions](relative/path.md) - Why it matters
```

## Considered Options

- Related research: [001-research-and-decision-lifecycle](researches/001-research-and-decision-lifecycle.md)

* (REJECTED) **Inline long-form analysis inside the XDR** - Put all research and decision text in one file.
  * Reason: Makes XDRs too long, mixes evidence with the adopted rule set, and hurts fast retrieval by humans and AI agents.
* (REJECTED) **Separate top-level research area outside the subject tree** - Centralize all research in one independent folder.
  * Reason: Breaks proximity with the decisions it supports and makes subject-scoped discovery weaker.
* (CHOSEN) **Subject-level research folder co-located with XDRs** - Keep exploratory material beside the decisions, skills, and articles it informs.
  * Reason: Preserves lifecycle context, keeps the XDR concise, and makes the research easy to discover when revisiting or updating a decision.

## References

- [_core-adr-001 - XDR standards](001-xdr-standards.md)
- [_core-adr-003 - Skill standards](003-skill-standards.md)
- [_core-adr-004 - Article standards](004-article-standards.md)
- [005-write-research skill](skills/005-write-research/SKILL.md) - Step-by-step instructions for creating a research document
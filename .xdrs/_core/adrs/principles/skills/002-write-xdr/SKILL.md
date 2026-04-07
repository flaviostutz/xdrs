---
name: 002-write-xdr
description: >
  Creates a new XDR (Decision Record) interactively: selects type, scope, subject, and writes a focused, conflict-checked decision document.
  Activate this skill when the user asks to create, add, or write a new XDR, ADR, BDR, or EDR.
metadata:
  author: flaviostutz
  version: "1.0"
---

## Overview

Guides the creation of a well-structured XDR by following the standards in `_core-adr-001`, consulting `xdr-standards` for every core element definition, researching existing records for conflicts, checking redundancy across related artifacts, and iterating until the document is concise, decision-focused, and clear about when the decision should be used.

## Instructions

### Phase 1: Understand the Decision

1. Read `.xdrs/index.md` to discover all active scopes and their canonical indexes.
2. Read `.xdrs/_core/adrs/principles/001-xdr-standards.md` in full to internalize structure rules, mandatory language, and the XDR template.
3. Treat `.xdrs/_core/adrs/principles/001-xdr-standards.md` as the canonical source for all core XDR element definitions. Before choosing or writing any core element, consult it for the exact rules for type, scope, subject, ID, numbering, title, placement, and applicable folder structure instead of relying on memory or local convention.
4. Ask the user (or infer from context) the topic of the decision. Do NOT proceed to Phase 2 without a clear topic.

### Phase 2: Select Type, Scope, and Subject

Consult `001-xdr-standards` while making each choice in this phase. The summaries below are orientation only; when any detail matters, the standard decides.

**Type** — choose exactly one based on the nature of the decision:
- **BDR**: business process, product policy, strategic rule, operational procedure
- **ADR**: system context, integration pattern, overarching architectural choice
- **EDR**: specific tool/library, coding practice, testing strategy, project structure

**Scope** — use `_local` unless the user explicitly names another scope.

**Subject** — pick one from the allowed list for the chosen type (from `001-xdr-standards`):
- ADR: `principles`, `application`, `data`, `integration`, `platform`, `controls`, `operations`
- BDR: `principles`, `marketing`, `product`, `controls`, `operations`, `organization`, `finance`, `sustainability`
- EDR: `principles`, `application`, `infra`, `ai`, `observability`, `devops`, `governance`

**XDR ID** — format: `[scope]-[type]-[next available number]`
- Scan `.xdrs/[scope]/[type]/` for the highest existing number in that scope+type and increment by 1.
- Never reuse numbers from deleted XDRs.

### Phase 3: Choose the Title

Choose a title that clearly states the question this XDR answers, not the answer itself. The title should let a reader know at a glance what decision scope this record covers.

- Good: "Package manager for Node.js projects", "Phone marketing procedures", "Integration patterns for systems connectivity"
- Avoid: "Use pnpm", "We chose pnpm", or overly vague titles like "Tooling decisions"

### Phase 4: Research Related XDRs

1. Read all existing XDRs relevant to the topic across all scopes listed in `.xdrs/index.md`.
2. Identify decisions that already address the topic (full or partial overlap).
3. Note decisions that might conflict with the intended outcome.
4. Read related `researches/` documents when they exist, especially if they contain constraints, findings, or option tradeoffs that should influence the decision.
5. Collect XDR IDs and file paths for cross-references.

### Phase 5: Check Redundancy Across Related Artifacts

1. Review the related XDRs, research documents, skills, articles, and guides connected to the same decision thread.
2. Identify content that is repeated across those files, especially decision statements, applicability boundaries, mandatory rules, and rationale.
3. Prioritize the final decision, core boundaries, and short key instructions in the XDR itself.
4. When another document already explains details well, link to it instead of re-explaining the same content in full.
5. Copy only short instructions or key excerpts when they materially help a reader apply the decision without leaving the XDR.
6. Avoid repeating the same decision text across multiple related documents whenever a link or short reference is enough.

### Phase 6: Write the First Draft

Use the mandatory template from `001-xdr-standards`:

```
# [scope]-[type]-[number]: [Short Title]

## Metadata
[Optional. Include only when at least one metadata field is present]
Status: [Optional. Use Draft, Active, or Deprecated. Defaults to Active when omitted]
Valid: [Optional. Use from YYYY-MM-DD, until YYYY-MM-DD, or from YYYY-MM-DD until YYYY-MM-DD]
Applied to: [Optional short applicability scope, under 40 words]

## Context and Problem Statement
[4 lines max: background, who is impacted, and the explicit question being answered]

## Decision Outcome

**[Chosen Option Title]**
[One sentence: what is the decision]

### Implementation Details
[Rules, applicability boundaries, concise examples, and optional do/don't guidance — under 100 lines]

## Considered Options (if meaningful options exist)

## Conflicts (mandatory if conflicts found in Phase 3)

## References (optional)
```

Mandatory rules to apply while drafting:
- Include `## Metadata` only when `Status:`, `Valid:`, and/or `Applied to:` adds value; omit the whole section when none of those fields is defined.
- When present, place `## Metadata` immediately before `## Context and Problem Statement`.
- Keep `Applied to:` under 40 words, use `Status:` only with `Draft`, `Active`, or `Deprecated`, remember that omitted `Status:` means `Active`, and use `Valid:` only with ISO date ranges.
- When metadata is present, write it so a reader can decide whether the XDR should be used for the current case without guessing. `Status:` controls lifecycle state, omitted `Status:` means `Active`, `Valid:` controls the active time window, `Applied to:` narrows the contexts where that active decision applies, and the decision text defines any remaining boundaries.
- Use mandatory language ("must", "always", "never") only for hard requirements; use advisory language ("should", "recommended") for guidance.
- Do not duplicate content already in referenced XDRs — link instead.
- Keep the decision itself authoritative in the XDR. Supporting artifacts may elaborate, but they should not restate the full decision when a short reference is enough.
- Make clear when the decision applies and any important exception boundaries.
- Keep exploratory option analysis in a related Research document when it would distract from the final decision text.
- Prefer plain Markdown, tables, or ASCII art for simple structure, flow, layout, or relationship indications.
- If the XDR genuinely needs local images or supporting files, store them in `.xdrs/[scope]/[type]/[subject]/assets/` and link with a relative path.
- No emojis. Lowercase filenames.
- Target under 100 lines total; 200 lines max for complex decisions.

### Phase 7: Review the Draft

Check every item before finalizing:

1. **Length**: Is it under 100 lines? Trim verbose explanations. Move detailed skills to a separate file and link.
2. **Metadata**: If metadata exists, is it directly before Context, limited to `Status:` / `Valid:` / `Applied to:`, omitted entirely when all three are absent, and specific enough for a reader to decide whether the XDR is active, currently valid, and applicable?
3. **Originality**: Does every sentence add value that cannot be found in a generic web search? Remove obvious advice. Keep only the project-specific decision.
4. **Clarity**: Is the chosen option unambiguous? Is the "why" clear in one reading?
5. **Redundancy**: Is the XDR the primary source for the decision itself, with related documents linked instead of duplicated wherever possible?
6. **Conflicts section**: Is it present and filled if Phase 3 found any conflicts?
7. **Index entries**: Will the new XDR be added to `[scope]/[type]/index.md` and `.xdrs/index.md`?

If any check fails, revise and re-run this phase before proceeding.

### Phase 8: Write Files

1. Create the XDR file at `.xdrs/[scope]/[type]/[subject]/[number]-[short-title].md`.
2. Add an entry to `.xdrs/[scope]/[type]/index.md` (create the file if it does not exist).
3. Add or verify the scope entry in `.xdrs/index.md`.
4. If significant research was produced or already exists, link it from the XDR `## Considered Options` section.
5. If concise rules, examples, or do/don't bullets help readers apply the decision correctly, add them inside `### Implementation Details` without turning the XDR into a long procedure.

### Constraints

- MUST follow the XDR template from `001-xdr-standards` exactly.
- MUST consult `001-xdr-standards` as the canonical source for every core element definition, especially type, scope, subject, ID, numbering, naming, and placement.
- MUST NOT add personal opinions or general best-practice content not tied to a decision.
- MUST NOT create an XDR that duplicates a decision already captured in another XDR — extend or reference instead.
- MUST prefer links and short references over repeating the same decision content across related documents.
- MUST keep scope `_local` unless the user explicitly states otherwise.

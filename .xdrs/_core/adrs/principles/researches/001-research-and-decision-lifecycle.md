# _core-research-001: Research and decision lifecycle

## Abstract

This study evaluates where research material should be positioned in the XDR framework so teams can preserve decision traceability and option analysis without weakening XDRs as the authoritative source. Three placement strategies were assessed against the framework's discoverability and conciseness constraints. Subject-level co-location in a dedicated `researches/` folder alongside `skills/` and `articles/` was found to best preserve context, keep XDRs concise, and stay consistent with the existing folder conventions. The study recommends treating Research as a first-class optional supporting artifact at the subject level.

## Introduction

As the XDR framework grows, teams need space beyond a concise XDR to record the reasoned evaluation of options — constraints, findings, tradeoffs, and rejected paths — before or after a decision changes. Without a dedicated place for this material, long-form analysis migrates into pull request comments, shared documents, and chat threads, making it hard to discover and harder to review when facts or technology change.

Three structural concerns drive this study:

- XDRs must stay under roughly 1300 words so both humans and AI agents can parse them quickly.
- Supporting analysis must be discoverable without knowing where to look outside the XDR folder tree.
- The framework already has `skills/` and `articles/` co-located per subject; a research artifact needs to fit that model or justify a deviation.

Known constraints from the XDR model:

- XDRs are the authoritative source of truth; no other artifact may override them.
- Subject-level folder structure is the canonical navigation layer.
- The framework must remain simple enough to onboard with a short article.

Question: How should a Research artifact fit into the XDR model so it supports the decision lifecycle without diluting the role of XDRs as the source of truth?

## Methods

This study used a structured option evaluation approach:

1. Catalogued the current XDR folder model and subject-level artifacts (`skills/`, `articles/`) from `_core-adr-001`.
2. Identified the key discoverability and maintenance constraints documented in `_core-adr-001`.
3. Defined three candidate placement strategies for research material based on common documentation pattern variants.
4. Assessed each option against four criteria: proximity to the relevant XDR, impact on XDR conciseness, discoverability for subjects with multiple related XDRs, and overall framework simplicity.

No external benchmarks were used. Assessment is based on the existing XDR structural rules and professional judgment about folder-based discoverability in developer tooling ecosystems.

## Results

Three placement strategies were evaluated:

| Option | Placement | Proximity to XDR | XDR Conciseness | Simplicity |
|--------|-----------|-----------------|-----------------|------------|
| 1 | Inside the XDR file | High (same file) | Low (bloat risk) | High |
| 2 | Global `researches/` tree | Low (detached from subjects) | High | Medium |
| 3 | Subject-level `researches/` | High (same subject) | High | Medium |

### Option 1: Keep research inside XDRs

Use larger XDRs and keep all exploratory analysis in the same file as the final decision.

**Pros**
- One file per decision thread.
- No new folder type to learn or maintain.

**Cons**
- Makes XDRs too long and hard to scan.
- Weakens the under-1300-word size constraint for decision records.

### Option 2: Create a top-level shared research area

Store all research under a global `researches/` tree detached from subjects.

**Pros**
- Centralized catalog of studies; easy to browse all research at once.

**Cons**
- Loses proximity to the decisions it informed.
- Makes subject-scoped discovery and maintenance harder.
- Inconsistent with how `skills/` and `articles/` are organized.

### Option 3: Add `researches/` beside `skills/` and `articles/`

Keep research documents under the same subject folder as the XDR they support.

**Pros**
- Preserves context: evidence lives beside the decision it informed.
- Keeps XDRs concise while retaining detailed tradeoff history.
- Consistent with the existing `skills/` and `articles/` co-location pattern.

**Cons**
- Adds one more artifact type to explain and maintain.
- Requires canonical indexes to cover one additional optional folder.

## Discussion

Option 3 dominates the evaluation on the key criteria. Subject-level co-location is what makes `skills/` and `articles/` discoverable in practice; research benefits from the same property. A global research tree (Option 2) loses the proximity that makes it useful when revisiting a decision, and inline analysis (Option 1) conflicts directly with the under-1300-word XDR guideline.

The main cost of Option 3 is framework complexity: teams must learn a new artifact type and canonical indexes must cover one more folder. This cost is real but modest. The XDR framework already has four artifact types (XDR, Skill, Article, Index); adding Research brings it to five, adding only one new section to the index template and one new optional folder per subject.

A risk worth noting: teams may resist creating a separate research file for simple decisions. This is acceptable. Research documents are optional and are most valuable for decisions with non-trivial option tradeoffs, evolving constraints, or evidence worth preserving for future reviews. For simple decisions, brief inline rationale in the XDR itself remains appropriate as long as the total XDR length stays under 1300 words.

## Conclusion

Subject-level co-location in `researches/[number]-[short-title].md` alongside the XDR is the model that best preserves discoverability, keeps XDRs concise, and stays consistent with existing folder conventions. Option 1 (inline) conflicts with the XDR size constraint; Option 2 (global tree) breaks subject-level proximity. The framework overhead of an optional `researches/` folder is low relative to the lifecycle traceability it provides. Research is optional and most useful for non-trivial decisions; for simple decisions, inline rationale remains acceptable within the 1300-word XDR budget.

## References

- [_core-adr-006](../006-research-standards.md) - Decision that adopts research as a first-class artifact
- [_core-adr-001](../001-xdrs-core.md) - Base XDR structure and folder conventions
- [_core-adr-004](../004-article-standards.md) - Distinction between research (evidence) and synthesis (articles)
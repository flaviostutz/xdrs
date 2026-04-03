# _core-research-001: Research and decision lifecycle

## Overview

This research evaluates how Research should fit into the XDR model so maintainers can evolve it as a supporting artifact without weakening XDRs as the source of truth. It provides the context behind the decision captured in [_core-adr-006](../006-research-standards.md).

Question: How should a Research artifact fit into the XDR model so it supports the decision lifecycle without diluting the role of XDRs as the source of truth?

## Constraints

- XDRs must stay concise and decision-focused.
- Supporting analysis must be easy to discover from the same subject folder.
- The new artifact must help during elaboration, discussion, approval, retirement, and updates.
- The structure must remain simple enough for humans and AI agents to navigate.

## Findings

- Long-form option analysis does not fit well inside XDRs because it mixes evidence gathering with the adopted decision.
- Articles are useful for synthesis, but they are optimized for understanding and navigation rather than preserving the full option tradeoff study.
- Skills are procedures, not evidence. They explain how to do something, not why an option was evaluated or rejected.
- Subject-level co-location is the strongest predictor of discoverability in the current XDR model.

## Proposals

### Option 1: Keep research inside XDRs

Use larger XDRs and keep all exploratory analysis in the same file as the final decision.

**Pros**
- One file per decision thread.
- No new folder type to teach.

**Cons**
- Bloats XDRs and makes the adopted rule set harder to scan.
- Weakens the under-100-line guidance for decision records.

### Option 2: Create a top-level shared research area

Store all research under a global `researches/` tree detached from subjects.

**Pros**
- Centralized catalog of studies.
- Easy to browse all research at once.

**Cons**
- Loses proximity to the decisions it informed.
- Makes subject-scoped discovery and maintenance harder.

### Option 3: Add `researches/` beside `skills/` and `articles/`

Keep research documents under the same subject as the XDR they support.

**Pros**
- Preserves context and keeps evidence close to the decision.
- Lets XDRs stay concise while retaining detailed tradeoff history.

**Cons**
- Adds one more artifact type to explain and maintain.
- Requires linting and indexes to recognize another optional folder.

## Recommendation

Option 3 is the best fit because it preserves the existing navigation model while separating evidence gathering from the adopted decision text.

## References

- [_core-adr-006](../006-research-standards.md) - Decision that adopts research as a first-class artifact
- [_core-adr-001](../001-xdr-standards.md) - Base XDR structure and references
- [_core-adr-004](../004-article-standards.md) - Distinction between research and synthesis
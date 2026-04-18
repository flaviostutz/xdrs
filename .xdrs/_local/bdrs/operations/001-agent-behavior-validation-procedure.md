---
name: _local-bdr-001-agent-behavior-validation-procedure
description: Defines the agent behavior validation procedure for this repository. Apply when maintaining or releasing xdrs-core.
applied-to: xdrs-core repository maintenance and release workflow
---

# _local-bdr-001: Agent behavior validation procedure for this repository

## Context and Problem Statement

This repository uses agent behavior tests to validate local changes to XDRs, skills, prompts, and packaging. The testing workflow is useful for maintaining this repo, but it should not be shipped as reusable `_core` policy to downstream consumers.

Question: How should xdrs-core keep its agent behavior validation procedure documented without distributing it as part of `_core`?

## Decision Outcome

**workspace-local operational policy**

Keep the repository's agent behavior validation procedure as a `_local` BDR and do not distribute it with `_core`.

### Implementation Details

- This repository MAY use the `testPrompt` / `runPromptTest` library exported by `xdrs-core`, together with repository-local fixtures, to validate agent behavior during maintenance and release work.
- The authoritative policy for this procedure MUST live under `.xdrs/_local/**`, not under `.xdrs/_core/**`.
- Shared `_core` XDRs and indexes MUST describe only reusable guidance that consumers should receive when they extract or compose `xdrs-core`.
- If a future behavior-testing rule becomes reusable across consumers, capture that reusable part in a separate shared XDR instead of promoting this repository-specific procedure unchanged.
- Tests should be placed in the same folder as the tested resources

## Considered Options

* (REJECTED) **Keep the decision as a `_core` EDR** - Continue shipping the repository's behavior-test procedure as shared engineering policy.
  * Reason: This exports a repository-maintenance rule to consumers that do not need it.
* (REJECTED) **Leave the procedure undocumented** - Rely on tests and code alone.
  * Reason: The boundary between repo-local maintenance policy and distributable `_core` guidance becomes unclear.
* (CHOSEN) **Move the procedure to a `_local` BDR** - Keep the decision local and treat it as an operational rule for this repository.
  * Reason: The procedure is about how this repository governs and validates its own maintenance workflow, and `_local` prevents it from being distributed with shared `_core` content.

## References

- [README.md](../../../../../README.md) - Public library usage for prompt behavior tests
- [tests/skills/testPrompt.test.js](../../../../../tests/skills/testPrompt.test.js) - Repository-local behavior-test checks
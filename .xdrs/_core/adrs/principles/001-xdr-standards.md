# _core-adr-001: XDR standards

## Context and Problem Statement

We need a consistent way to capture decisions that scales across scopes and subjects, remains easy to navigate, and works well with AI agents.

Decision Records can be of different kinds, depending on the nature of the decision:
- BDR (Business Decision Record): Captures business process, product features, procedures and strategic decisions. Examples: business rules, product policies, customer service, business workflow, control frameworks for regulators for finance, product procedures and manuals, KYC requirements, business requirements in general
- ADR (Architectural Decision Record): Wider architectural and technical decisions. Examples: how big topics relate to each other, system contexts, overview without realy deciding on details, integration patterns, overarching topics, corporate wide practices, corporate systems, external and internal partners etc
- EDR (Engineering Decision Record): captures engineering details about how to implement things. Examples: specific tools and libraries selection, framework usage, best practices on coding, testing, quality, project structure, pipelines etc

Collectively, these are referred to as XDRs.

How should XDRs be structured and organized across types, teams, and scopes?

## Decision Outcome

**Scoped + typed + subject folders**

Provides clear ownership by scope, predictable navigation, and reusable decisions that work well with AI agents by keeping files small and focused.

### Implementation Details

The standards below are split into framework-wide standards and XDR document standards.

#### General framework standards

- The main document type in the collection of XDRS is the XDR document, which contains a decision. Other documents are normally related to this decision and shouldn't go against its contents.
- Make it clear if an instruction is mandatory or advisory.
  - Mandatory language: "must", "always", "never", "required", "mandatory"
  - Advisory language: "should", "recommended", "advised", "preferably", "possibly", "optionally"
- Always use the following folder structure for XDR documents:
  `.xdrs/[scope]/[type]/[subject]/[number]-[short-title].md`
- Optional supporting artifacts under the same subject:
  - `.xdrs/[scope]/[type]/[subject]/researches/[number]-[short-title].md`
  - `.xdrs/[scope]/[type]/[subject]/skills/[number]-[skill-name]/SKILL.md`
  - `.xdrs/[scope]/[type]/[subject]/articles/[number]-[short-title].md`
- Research, skills, and articles are part of the framework, but each has its own concept-specific standards in dedicated XDRs. This XDR defines the shared framework baseline and the decision-record standard.
  - `_core-adr-003` defines skill standards
  - `_core-adr-004` defines article standards
  - `_core-adr-006` defines research standards
- For simple structure, flow, layout, or relationship indications, documents SHOULD prefer plain Markdown, tables, or ASCII art instead of external assets.
- Images and other supporting files SHOULD be used only when they are materially necessary to preserve clarity, fidelity, or evidence. When used, they SHOULD live in a sibling `assets/` folder next to the document.
  - XDRs in the subject root use `.xdrs/[scope]/[type]/[subject]/assets/`
  - Articles use `.xdrs/[scope]/[type]/[subject]/articles/assets/`
  - Research uses `.xdrs/[scope]/[type]/[subject]/researches/assets/`
  - Skills use `.xdrs/[scope]/[type]/[subject]/skills/[number]-[skill-name]/assets/`
- **Scopes:** 
  - Short name that defines a group or a package of xdrs
  - examples: `business-x`, `business-y`, `team-43`, `_core`
  - `_local` is a reserved scope for XDRs created locally to a specific project or repository. XDRs in `_local` must not be shared with or propagated to other contexts. This scope must always be placed in the lowest position in `.xdrs/index.md` so that its decisions override or extend any decisions from all higher-positioned scopes. Shared `.xdrs/index.md` files MUST NOT link `_local` canonical type indexes because `_local` stays workspace-local and is not distributed with shared packages. Readers, tools, and agents SHOULD still try to discover existing workspace-local `_local` canonical indexes by default, even when the shared root index does not link them.
  - **Types:** `adrs`, `bdrs`, `edrs`
  - there can exist sufixes to the standard scope names (e.g: `business-x-mobileapp`, `business-y-servicedesk`)
- **Subjects:** MUST be one of the following depending on the type of the XDR. Use the subject to indicate the main concern of the decision.
  - **ADR subjects**
    - `principles`: Cross-cutting architecture and policy foundations.
      - Examples: architecture style, interoperability rules, long-term technology direction.
    - `application`: System and service design decisions at application level.
      - Examples: modularization strategy, service decomposition, app-level security flows.
    - `data`: Data architecture and information modeling choices.
      - Examples: canonical schemas, data ownership boundaries, retention strategies.
    - `integration`: Decisions about communication between internal/external systems.
      - Examples: sync vs async patterns, contract strategy, partner integration approach.
    - `platform`: Platform-level runtime and enabling capabilities.
      - Examples: cloud/runtime baseline, foundational services, platform tenancy approach.
    - `controls`: Architecture controls for risk, security, and compliance at a high level.
      - Examples: encryption baseline, auditability requirements, policy enforcement points.
    - `operations`: Operational architecture decisions.
      - Examples: incident model, resilience objectives, operational ownership boundaries.
  - **BDR subjects**
    - `principles`: Business principles and decision criteria that guide all business areas.
      - Examples: customer fairness rules, policy precedence, strategic guardrails.
    - `marketing`: Go-to-market, communication, and campaign policy decisions.
      - Examples: campaign approval rules, channel usage standards, positioning constraints.
    - `product`: Product behavior, lifecycle, and offering decisions.
      - Examples: feature rollout policy, packaging/tiers, product requirement governance.
    - `controls`: Business control framework decisions.
      - Examples: approval segregation, mandatory checks, exception handling policy.
    - `operations`: Day-to-day business process and procedure decisions.
      - Examples: support workflows, onboarding/offboarding procedures, SLA operations.
    - `organization`: Structure, roles, and responsibility model decisions.
      - Examples: decision rights, team topology, accountability boundaries.
    - `finance`: Financial and cost-control business decisions.
      - Examples: budgeting process, pricing governance, investment approval rules.
    - `sustainability`: Environmental and social responsibility policy decisions.
      - Examples: sustainability KPIs, reporting cadence, procurement sustainability criteria.
  - **EDR subjects**
    - `principles`: Engineering principles and non-functional quality defaults.
      - Examples: coding standards baseline, testing philosophy, secure-by-default engineering rules.
    - `application`: Code-level implementation patterns and application conventions.
      - Examples: framework patterns, layer organization, API implementation conventions.
    - `infra`: Infrastructure implementation and runtime operations details.
      - Examples: IaC patterns, environment provisioning, network/runtime hardening details.
    - `observability`: Telemetry, monitoring, alerting, and diagnostics implementation.
      - Examples: log/metric/tracing standards, alert routing policy, SLO measurement approach.
    - `devops`: Delivery pipeline, release automation, and developer workflow decisions.
      - Examples: CI/CD stages, branch strategy, release promotion gates.
    - `governance`: Engineering governance, risk controls, and compliance mechanics.
      - Examples: dependency governance, approval policies, mandatory quality checks.
- Never use emojis
- **Indexes**
  - Keep a canonical index with all XDRs of a certain type+scope in `.xdrs/[scope]/[type]/index.md`
  - Canonical index requirements:
    - Organize XDR documents by subject for easier navigation
    - Add a short description of what this scope is about (responsibilities, general worries, teams involved, link to discussion process, etc)
    - Add a list of other scope indexes that this scope might be related to (only add scopes that might be overridden). E.g: "business-x-mobileapp" scope could refer to "business-x" and "sensitive-data" scopes in its index list. XDRs in scopes listed last override XDRs in scopes listed first when addressing the same topic.
    - Each XDR element entry in the index MUST include a short description of its content, prefferably with an imperative statement or the question it answers, when possible (<15 words). Example: "Use this while planning a new feature", "What communication tone we use with our customers?", "PNPM vs Yarn comparison"
  - Outside the scopes, keep an index pointing to all canonical indexes in `.xdrs/index.md`. Add the text "XDRs in scopes listed last override the ones listed first"
  - Always verify if indexes are up to date after making changes

#### XDR document standards

- Decision record and source of truth
- XDRs MUST contain a clear decision about a certain problem or situation. Avoid being too verbose and focus on explaining clearly the context and the decision. Avoid adding contents that are not original. If you have other references that are important to understand the document, add links and references. Always cite sources.
- XDRs are the central artifact of the framework and the authoritative policy for their scope, type, and subject. Supporting artifacts may explain, justify, or operationalize the decision (like articles, researches and skills), but they do not replace it.
- XDRs MAY include a `## Metadata` section, but only when at least one supported metadata field is present. When used, `## Metadata` MUST appear immediately before `## Context and Problem Statement`.
- Supported XDR metadata fields are:
  - `Status:` Optional. Defines the lifecycle state of the decision. Allowed values are `Draft`, `Active`, and `Deprecated`. If omitted, the decision is treated as `Active`. Only `Active` decisions may be treated as current policy.
  - `Valid:` Optional. Defines the time window in which an active decision may be treated as current. Use ISO dates only: `from YYYY-MM-DD`, `until YYYY-MM-DD`, or `from YYYY-MM-DD until YYYY-MM-DD`. If `from` is omitted, the decision takes effect immediately. If `until` is omitted, the decision remains valid indefinitely.
  - `Applied to:` Optional. A short description of the contexts in which the decision is applicable. Keep it under 40 words. If omitted, the decision should be interpreted as applying to all logically applicable elements according to the decision text itself. Examples: `Only frontend code`, `JavaScript projects`, `Performance-sensitive codebases`
- Before using, enforcing, or citing an XDR as a current rule, humans and AI agents MUST decide whether the decision is appliable for the current case.
  - Check `Status:` first to determine whether the XDR is eligible to be used now. If `Status:` is omitted, treat it as `Active`. `Draft` and `Deprecated` decisions are background or history, not current policy.
  - Check `Valid:` next to determine whether the current moment falls inside the decision's active date window. Not-yet-active and expired windows are not current policy.
  - Check `Applied to:` next to determine whether the active, currently valid decision fits the current codebase, system, workflow, or audience.
  - Check the decision context and implementation details last to determine any additional boundaries, exceptions, or qualifiers that metadata alone cannot express.
  - If any check fails, the XDR MAY still be read as background, history, or context, but it MUST NOT be treated as a current requirement for that case.
- Research documents MAY be added under the same subject to capture the exploration, findings, and proposals that backed a decision. Research is useful during elaboration, discussion, approval, retirement, and updates of xdrs, but the XDR document remains the source of truth.
- **XDR Id:** [scope]-[type]-[xdr number unique in scope] (the xdr id must be unique among all XDRs of the same type in the different scopes and always use lowercase)
  - Types in IDs: `adr`, `bdr`, `edr`
  - Define the next number of an XDR by checking what is the highest number present in the type+scope. Don't fill numbering gaps, as they might be old deleted XDRs and we should never reuse numbers of different documents/decisions. Numbering gaps are expected.
- Decisions MUST be concise and reference other XDRs to avoid duplication.
- The `### Implementation Details` section SHOULD state relevant boundaries or exceptions and what a reader should do or avoid in common cases. Use `## Metadata` as the first-pass filter for whether the decision should be used at all, then keep nuanced boundaries in the decision text.
- Use concise rules, examples, or `Do` / `Don't` lists only when they help a reader apply the decision correctly. Keep them short and decision-specific.
- Conflict handling applies to XDR documents:
  - For cross-scope overrides, document the decision conflict in the XDR `## Conflicts` section of the XDR that overrides another scope.
  - **Within-scope conflicts:** XDRs within the same type+scope must not conflict. If two XDRs appear to conflict, one should be updated, deprecated, or the conflict resolved through a new XDR.
- When research exists for a decision, the XDR SHOULD mention the related research documents after the `## Considered Options` list.
- Never use emojis in contents.
- Always use file names with lowercase.
- Avoid using lengthy instructions on the XDR. If there are long and detailed instructions related to the XDR, or instructions that are outside the decision, create another file with a guide. If the guide is small, keep it in the XDR itself.
- XDRs should be less than 100 lines long as a rule of thumb.
  - This is important to make them focused on a clear decision
  - Exceptions can reach 200 lines (templates, more elaborate decision implementations etc)
- ALWAYS use `_local` scope if the user doesn't explicitelly indicate a specific scope while creating an xdr or skill.

**XDR template**

All XDRs MUST follow this template

```markdown
# [scope]-[type]-[number]: [Short Title]

## Metadata

[Optional section. Omit the entire section when none of `Status:`, `Valid:`, or `Applied to:` is defined. Readers decide whether to use the XDR by checking `Status:` first, treating omission as `Active`, then `Valid:`, then `Applied to:`, and finally the decision text itself.]
Status: [Optional. Use `Draft`, `Active`, or `Deprecated`. Defaults to `Active` when omitted]
Valid: [Optional. Use `from YYYY-MM-DD`, `until YYYY-MM-DD`, or `from YYYY-MM-DD until YYYY-MM-DD`]
Applied to: [Optional short applicability scope, under 40 words]

## Context and Problem Statement

[Describe the context, background, or need that led to this decision.
What is the problem we are trying to solve? Who is being impacted? (<3 lines)

Question: In the end, state explicitly the question that needs to be answered. E.g: "Which platform should I use when implementing an AI agent?"]

## Decision Outcome

**[Chosen Option Title]**
[Very short description of what is the decision, aligned with the titles on the Considered Options section]

[Short description of implementation details for the chosen path]

### Implementation Details

[Optional section with implementation specifics, applicability boundaries, rules, concise examples, or do/don't guidance. This is the answer to the question in the "Context and Problem Statement". (<100 lines)]

## Considered Options

[Optional section present only when there are meaningful options to be discussed.]

* (REJECTED) **Option 1** - Brief description of option 1
  * Reason: Brief description why this was rejected with important aspects to be re-checked in the case we want to change this decision
* (CHOSEN) **Option 2** - Brief description of option 2
  * Reason: Brief description of why this option was accepted, containing the strengths, strategical motivations and it's differential over the other options.
* (REJECTED) **Option 3** - [same as above, if we have more than 2 options to choose from]

[Related research, if any]
- [Research document title](researches/001-example.md) - Brief description of what it informed

## Conflicts

[If this XDR has conflicts with other scopes, this section is MANDATORY and needs to have an explanation why the conflict is accepted]

* Conflict with [XDR id] (e.g.: adr-business-x-001)
  * Summary: Brief description of the conflict
  * Reason to accept: Brief description of why it was decided to accept this conflict, possibly overriding or diverging from the other decision/scopes

## References

[optional section]
[useful links related to this implementation]
[links to the discussion (PRs, meetings etc)]
[links to related skills]
```

**Examples:**
- `.xdrs/business-x/edrs/devops/003-required-development-workflow.md`
- `.xdrs/business-x/adrs/governance/010-security-and-secrets-management.md`
- `.xdrs/_core/adrs/devops/001-multi-repo.md`
- Metadata examples:
  - `Status: Draft`
  - `Status: Active`
  - `Valid: from 2026-03-01 until 2026-12-31`
  - `Applied to: JavaScript projects`

```text
subject/
|-- 001-xdr.md
|-- assets/
|-- articles/
|   |-- 001-article.md
|   `-- assets/
|-- researches/
|   |-- 001-study.md
|   `-- assets/
`-- skills/
    `-- 001-task/
        |-- SKILL.md
        `-- assets/
```

**XDR ID Examples:**
- `business-x-adr-001` (not `ADR-business-x-001` or `business-x-adr-1`)
- `business-x-edr-042` (not `EDR-BUSINESS-X-042`)
- `business-x-bdr-007`

## Considered Options

* (REJECTED) **Flat list of decisions** - Simple but becomes unmanageable as the number grows.
  * Reason: Does not scale and makes navigation difficult over time.
* (REJECTED) **Per-team folders without scope** - Easier ownership but loses organization hierarchy.
  * Reason: Lacks a clear hierarchy and makes cross-team reuse harder.
* (CHOSEN) **Scoped + typed + subject folders** - Clear ownership by scope first, then decision type, with predictable navigation and reusable decisions.
  * Reason: Scales well, supports AI agents with focused files, enables reuse across scopes, and groups all decisions for a given scope together regardless of type.

## References

- [001-lint skill](skills/001-lint/SKILL.md) - Skill for reviewing code changes against XDRs
- [002-write-xdr skill](skills/002-write-xdr/SKILL.md) - Skill for creating a new XDR from this standard
- [_core-adr-003 - Skill standards](003-skill-standards.md)
- [_core-adr-004 - Article standards](004-article-standards.md)
- [_core-adr-006 - Research standards](006-research-standards.md)

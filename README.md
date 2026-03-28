# xdr-standards

A standard way to organize Decision Records (XDRs) across scopes, subjects, and teams so that AI agents can reliably query and follow them.

> **Note:** This repository contains a minimum set of standards and very basic set of ADRs that describe the proposed decisions structure. It is intended to be used as a foundation that other projects can reference, extend, or install as a dependency in order to bootstrap and create their own XDRs.

## Objective

Decision Records capture Architectural (ADR), Business (BDR), and Engineering (EDR) decisions. As organizations grow, hundreds of decisions accumulate across teams, levels, and domains. Without a consistent structure, AI agents cannot efficiently locate the right decisions for a given context, and humans cannot maintain or evolve them sustainably.

This project defines a standard for organizing XDRs that satisfies the following requirements.

## Getting started

1. Create a new project workspace

2. On the workspace root folder, run `npx xdrs-core`

   The basic xdrs tooling should be installed in your workspace along with:
     - AGENTS.md pointing to the XDRs structure
     - XDR related skills and prompts for Copilot

3. Run a prompt such as:

   > Create an ADR about our decision on using Python for AI related projects. For high volume projects (expected >1000 t/s), an exception can be made on using Golang.

## Requirements

### Multi-scope support

Different teams at different organizational levels make decisions that apply to different audiences. XDRs are organized by scope (e.g. `_core`, `business-x`, `business-y-mobileapp`) so that each team owns its own decision space. Scopes can extend or override decisions from broader scopes, with explicit precedence rules: scopes listed later in an index override those listed earlier.

### Subject grouping

Within each scope and type, decisions are grouped by subject (e.g. `application`, `data`, `platform` for ADRs; `product`, `finance` for BDRs). This keeps related decisions together, improves human navigation, and allows AI agents to narrow their search to the relevant subject folder before reading individual records.

### Extensibility

Over time, decisions from various teams and domains accumulate in a shared workspace. The folder structure `.xdrs/[scope]/[type]/[subject]/` is designed to accommodate new scopes, types, and subjects without reorganizing existing content. A root index at `.xdrs/index.md` points to all canonical scope indexes, and each canonical index is updated incrementally as new XDRs are added.

### Distributability

XDR packages are versioned and distributed via the npm registry. This allows teams to adopt specific decision sets at a specific version, rather than accepting all decisions at once. It avoids "all or nothing" situations when linting or checking adherence to decisions in the context of tech debt management. Teams can pin, upgrade, or override only the scopes that are relevant to them.

### AI-agent friendliness

The folder layout, file naming, and document format are designed so that AI agents can efficiently work with hundreds of decisions:

- Each XDR is a small, focused Markdown file (target under 100 lines), covering one decision.
- The canonical index per scope and type lists all XDRs with short descriptions, enabling agents to identify relevant records without reading every file.
- The root index at `.xdrs/index.md` provides a single entry point for discovery.
- Decisions cross-reference each other by XDR ID rather than duplicating content, keeping individual files concise.
- Subject folders reduce the search space when a query maps to a known domain.

### Multi-agent framework support

XDRs and skills must be usable by any type of AI agent, not only coding agents (e.g. GitHub Copilot, Cursor, Cline). General-purpose agent frameworks such as LangGraph, CrewAI, AutoGen, and similar orchestration runtimes must be able to consume XDRs without relying on IDE-specific tooling or conventions.

This is especially important for BDRs: because business rules govern decisions that span both technical and non-technical workflows, agents built with any framework must be able to discover, fetch, and apply BDRs programmatically using only standard file-system or HTTP access to Markdown files.

## Structure

```
.xdrs/
  index.md                          # root index pointing to all scope indexes
  [scope]/
    [type]/                         # adrs | bdrs | edrs
      index.md                      # canonical index for this scope+type
      [subject]/
        [number]-[short-title].md   # individual decision record
        skills/                     # optional agent skill packages
          [number]-[skill-name]/
            SKILL.md
```

Types of Decision Records:

- **ADR** - Architectural Decision Record: architectural and technical decisions
- **BDR** - Business Decision Record: business process and strategy decisions
- **EDR** - Engineering Decision Record: engineering workflow and tooling decisions

See [.xdrs/index.md](.xdrs/index.md) for the full list of active decision records.

## Flow: Decision -> Distribution -> Usage

XDRs and skills follow a three-stage lifecycle that keeps decision-making decentralized while allowing controlled adoption across projects.

### Decision

Each scope manages its own set of XDRs independently. Scope owners discuss and evolve decisions through whatever process fits their team, such as RFCs, pull requests, or architecture review boards. XDRs and skills are authored, reviewed, and merged within the scope's folder in the repository.

### Distribution

Once a set of decisions is ready to share, scope owners pack the relevant `.xdrs/[scope]/` folder into a versioned npm package using a tool such as [filedist](https://github.com/flaviostutz/filedist) and publish it to an npm registry, either public or a company-internal one. Versioning gives consumers explicit control over which revision of a scope's decisions they adopt, avoiding situations where a single breaking policy change is forced on all consumers at once.

The same applies to skills: because they live alongside XDRs inside the scope folder, they are included in the same package and published together.

### Usage

A project that wants to follow a scope's decisions adds the corresponding npm package as a regular dependency. Using a tool such as [filedist](https://github.com/flaviostutz/filedist), the package contents are unpacked into the project's `.xdrs/` folder at install or update time. Updating the dependency version pulls in the latest XDRs and skills for that scope, keeping the project aligned with the scope owners' current decisions.

Multiple scope packages can be combined in the same workspace by listing them as separate dependencies. Scope precedence (defined in `.xdrs/index.md`) determines which decisions take effect when scopes overlap.

```
[Scope repo] --> npm publish --> [npm registry] --> npm install --> [Project workspace]
  .xdrs/[scope]/                  versioned pkg                    .xdrs/[scope]/
    adrs/ bdrs/ edrs/                                                adrs/ bdrs/ edrs/
    [subject]/                                                        [subject]/
      *.md                                                              *.md
      skills/                                                           skills/
```

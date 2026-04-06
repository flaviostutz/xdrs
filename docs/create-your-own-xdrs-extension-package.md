# Create your own xdrs-core extension package

## Overview

This article explains how to turn your own XDR scope into a distributable npm package. It is for
teams that want to publish their own DRs, Research documents, skills, and articles while staying compatible with the
xdrs-core structure and extraction flow.

## Content

### Start with a real shared scope, not `_local`

Use `_local` only for project-only records that must stay inside one repository. Shared packages
should publish a named scope such as `acme-platform` or `team-ml`, because scopes are the unit of
ownership, distribution, and override ordering in XDRs. The root structure and precedence rules are
defined in [_core-adr-001](../.xdrs/_core/adrs/principles/001-xdr-standards.md).

### Package the whole scope as a normal npm package

The package shape used by this repository is the simplest reference implementation: the published
artifact is a regular npm package with a `files` whitelist, a thin CLI entrypoint, and `filedist`
configuration embedded in [package.json](../package.json). The important parts are:

- include the shipped XDR tree, agent instruction files, and CLI files in `files`
- expose `bin/filedist.js` as the package `bin` so consumers run the package through the same
  `extract` and `check` interface
- define one `filedist.sets` entry for managed files and another for editable local overrides

For a minimal consumer flow, see [examples/basic-usage/package.json](../examples/basic-usage/package.json) and
[examples/basic-usage/Makefile](../examples/basic-usage/Makefile).

### Separate managed files from local overrides

This repository's `filedist` config in [package.json](../package.json) shows the key
pattern:

- managed set: ships `AGENTS.md` and `.xdrs/**`, while excluding `.xdrs/index.md`
- keep-existing set: ships `.xdrs/index.md` with `managed=false` and `keepExisting=true`

That split matters because consumers need some files to stay under package control and others to
remain editable in their own repository. The current example verifies exactly that behavior in
[examples/basic-usage/Makefile](../examples/basic-usage/Makefile) by re-extracting into its
consumer `output/` directory and asserting that local edits to `.xdrs/index.md` survive
`extract --keep-existing` while managed files are still checked for drift.

### Keep DRs, Research documents, skills, and articles together

Your reusable package should place DRs, Research documents, skills, and articles under the same scope folder so they
ship together:

```text
.xdrs/
  my-scope/
    adrs/
      index.md
      principles/
        001-my-decision.md
        assets/
        researches/
          001-my-decision-study.md
          assets/
        skills/
          001-my-skill/
            SKILL.md
            assets/
        articles/
          001-my-overview.md
          assets/
```

The co-location rule for Research documents comes from [_core-adr-006](../.xdrs/_core/adrs/principles/006-research-standards.md),
the co-location rule for skills comes from [_core-adr-003](../.xdrs/_core/adrs/principles/003-skill-standards.md),
and article placement rules come from [_core-adr-004](../.xdrs/_core/adrs/principles/004-article-standards.md).
When you publish the scope folder, those documents travel together and stay version-aligned.
When any of those documents use images or local supporting files, keep them in the sibling `assets/` folder next to the document so the package stays self-contained.

### Expose skills to Copilot-compatible tooling

This repository's managed `filedist` set creates symlinks from `.xdrs/**/skills/*` into
`.github/skills`, configured in [package.json](../package.json). That means your skills
remain authored next to the XDRs they implement, but consumers also get the discovery path expected
by GitHub Copilot and similar tooling.

If your package targets non-Copilot agents too, keep the source of truth in `.xdrs/[scope]/.../skills/`
and treat `.github/skills` as an exposure mechanism rather than the canonical location.

### Verify with a consumer example before publishing

The [examples/basic-usage](../examples/basic-usage) folder is the best reference in this repository
for the minimal consumer side of the workflow:

1. depend on the locally packed tarball from `dist/`
2. run `pnpm exec xdrs-core extract --output ./output`
3. verify the expected files exist
4. re-run extraction to confirm keep-existing behavior
5. run `check` and `lint` against the extracted tree

That same pattern should exist in your extension package repository. For an example of a reusable
extension package that composes `xdrs-core` with its own named scope, see
[examples/mydevkit](../examples/mydevkit). A runnable example catches bad
selectors, missing files, broken indexes, and skill exposure problems before you publish.

### Publish and version the package as an upgrade contract

The release flow in [Makefile](../Makefile) packs the project and publishes it with npm,
including prerelease tag handling. Your extension package can follow the same shape: `pnpm pack` for
local verification, then `npm publish` to your public or internal registry.

Version the package with semantic versioning according to the impact on consumers, not only on the
changed file. [_core-adr-005](../.xdrs/_core/adrs/principles/005-semantic-versioning-for-xdr-packages.md)
defines the practical rule: breaking guidance or changed mandatory behavior is `MAJOR`, additive
guidance such as new DRs, Research documents, skills, or articles is usually `MINOR`, and low-risk corrections are
`PATCH`.

### Use agentme as the fuller packaged example

This repository shows the baseline xdrs-core packaging model. For a fuller distribution package that
combines reusable XDR scopes with additional agent workflow files and presets, use
[flaviostutz/agentme](https://github.com/flaviostutz/agentme) as the reference. Its README shows the
same extraction model applied to a richer package: install the dependency, run `extract`, review the
generated output, and re-run `check` when upgrading.

## References

- [_core-adr-001](../.xdrs/_core/adrs/principles/001-xdr-standards.md) - Scope structure, precedence, and distribution model
- [_core-adr-006](../.xdrs/_core/adrs/principles/006-research-standards.md) - Research placement and template rules
- [_core-adr-003](../.xdrs/_core/adrs/principles/003-skill-standards.md) - Skill co-location and discovery rules
- [_core-adr-004](../.xdrs/_core/adrs/principles/004-article-standards.md) - Article placement and template rules
- [_core-adr-005](../.xdrs/_core/adrs/principles/005-semantic-versioning-for-xdr-packages.md) - Versioning policy for published XDR packages
- [package.json](../package.json) - Reference `files`, `bin`, symlink, and `filedist` set layout
- [Makefile](../Makefile) - Reference pack and publish flow
- [examples/basic-usage/package.json](../examples/basic-usage/package.json) - Minimal consumer dependency setup
- [examples/basic-usage/Makefile](../examples/basic-usage/Makefile) - Extraction, keep-existing, check, and lint verification flow
- [examples/mydevkit](../examples/mydevkit) - Extension package example that composes `xdrs-core` with a custom scope
- [agentme](https://github.com/flaviostutz/agentme) - Full distribution package example built on top of xdrs-core
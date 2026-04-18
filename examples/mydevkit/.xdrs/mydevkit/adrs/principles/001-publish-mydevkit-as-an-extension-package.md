---
name: mydevkit-adr-001-publish-mydevkit-as-an-extension-package
description: Defines how mydevkit publishes as an XDR extension package composing xdrs-core. Use as an example of reusable XDR package composition.
---

# mydevkit-adr-001: Publish mydevkit as an extension package

## Context and Problem Statement

We want a small but working example of a reusable XDR package that extends `xdrs-core` without
embedding its `filedist` configuration in `package.json`.

Question: How should this example package compose `xdrs-core` and its own scope for consumers?

## Decision Outcome

**Use a standalone `.filedistrc` package config**

The package uses `.filedistrc` as the source of truth for extraction rules and composes the
published `xdrs-core` package with the local `mydevkit` scope.

### Implementation Details

- The package MUST keep its extraction rules in `.filedistrc`.
- The package MUST expose a thin `bin/filedist.js` wrapper so consumers run `extract` and `check`
  through the package name.
- The package MUST keep authored records under `.xdrs/mydevkit/**`.
- The package MUST provide a root `.xdrs/index.md` that includes both `_core` and `mydevkit`
  canonical indexes.
- Consumer projects SHOULD install both `mydevkit` and `xdrs-core` when they also want the
  `xdrs-core lint` command available directly.

## Considered Options

* (REJECTED) **Keep config only in package.json** - Works, but does not demonstrate standalone config files.
  * Reason: This repository already uses that pattern in the root package.
* (CHOSEN) **Use `.filedistrc` as package config** - Keep distribution rules outside package metadata.
  * Reason: Shows a second supported packaging mode and keeps extraction concerns isolated.

## References

- [package.json](../../../../package.json)
- [.filedistrc](../../../../.filedistrc)
- [README.md](../../../../README.md)
- [001-release-package](skills/001-release-package/SKILL.md) - Skill for packing, verifying, and publishing the example package
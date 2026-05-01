# mydevkit

This example shows a reusable xdrs-core extension package that keeps its `filedist` configuration
in [.filedistrc](.filedistrc) instead of embedding it in `package.json`.

The package composes two sources into one installable CLI:

- the published `xdrs-core` package for `_core`, `AGENTS.md`, and the base extraction flow
- the local `.xdrs/mydevkit/**` scope shipped by this package
- the [consumer](consumer) workspace, which contains the local integration test flow for the packed tarball
- a sample PNG in `.xdrs/mydevkit/adrs/principles/articles/.assets/` showing how document-local binary assets ship with the example package

## Files to look at

- [.filedistrc](.filedistrc) - package extraction rules and `xdrs-core` composition
- [package.json](package.json) - published package metadata and dependencies
- [bin/filedist.js](bin/filedist.js) - thin CLI wrapper for `filedist`
- [consumer/Makefile](consumer/Makefile) - local consumer install, extract, lint, and verification flow
- [.xdrs/index.md](.xdrs/index.md) - root index shipped by the package
- [.xdrs/mydevkit/adrs/index.md](.xdrs/mydevkit/adrs/index.md) - canonical index for the custom scope

## Use this package in your own project

When this package is published to npm, a consumer project can use it like this:

```bash
pnpm add -D xdrs-core mydevkit
pnpm exec mydevkit extract
pnpm exec mydevkit check
pnpm exec xdrs-core lint .
```

If you want to inspect the local tarball flow from this repository, run:

```bash
make -C examples/mydevkit test
```

That target packs this example and then delegates to the [consumer](consumer) Makefile, which
installs the local tarball, extracts the composed XDR tree, verifies the generated skill symlink,
and lints the resulting workspace.

For a fuller production-oriented package built on top of xdrs-core, see
[flaviostutz/agentme](https://github.com/flaviostutz/agentme).
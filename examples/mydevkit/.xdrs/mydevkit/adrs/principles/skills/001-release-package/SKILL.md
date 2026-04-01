---
name: 001-release-package
description: >
  Packs and verifies the mydevkit extension package that composes xdrs-core through a standalone
  .filedistrc file.
metadata:
  author: flaviostutz
  version: "1.0"
---

## Overview

Use this skill when updating the example package and needing to confirm that the packed tarball can
be installed by a consumer workspace.

## Instructions

### Phase 1: Pack the package

1. Run `pnpm install` in the package root.
2. Run `pnpm pack --pack-destination=./dist`.

### Phase 2: Verify the consumer flow

1. Install the packed tarball in the `consumer/` fixture together with the local `xdrs-core` tarball.
2. Run `pnpm exec mydevkit extract --output ./output` from the consumer workspace.
3. Run `pnpm exec mydevkit check --output ./output`.
4. Run `pnpm exec xdrs-core lint ./output`.

### Phase 3: Publish

1. Bump the package version according to the consumer impact.
2. Publish after the local consumer verification passes.

## References

- [mydevkit-adr-001](../../001-publish-mydevkit-as-an-extension-package.md)
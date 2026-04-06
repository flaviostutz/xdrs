# mydevkit-article-001: mydevkit package overview

## Overview

This article explains how the `mydevkit` example package is structured and how it extends
`xdrs-core` using a standalone `.filedistrc`.

## Content

### What this package demonstrates

The package keeps reusable records in `.xdrs/mydevkit/**`, exposes a thin `filedist` CLI wrapper,
and composes `xdrs-core` through its package-level `.filedistrc`.

### Why the config is in `.filedistrc`

Using `.filedistrc` keeps extraction rules separate from package metadata while still letting the
package behave like a normal `filedist`-backed CLI. This is useful when package authors want the
distribution contract to stay easy to review as a dedicated file.

### Consumer flow

Consumers install the package, run `pnpm exec mydevkit extract`, and then use `xdrs-core lint` to
validate the resulting tree. The example [README.md](../../../../README.md) contains the exact
commands.

### Sample packaged PNG asset

This article includes a tiny PNG file in `articles/assets/` to demonstrate that document-local
binary assets are packaged and extracted together with the `mydevkit` scope when an example really
needs them.

![Sample packaged PNG asset](assets/sample-package-asset.png)

## References

- [mydevkit-adr-001](../001-publish-mydevkit-as-an-extension-package.md)
- [README.md](../../../../README.md)
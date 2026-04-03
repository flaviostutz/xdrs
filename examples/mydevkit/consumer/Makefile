SHELL := /bin/bash

clean:
	@rm -rf node_modules output pnpm-lock.yaml

install:
	pnpm add mydevkit@file:../dist/mydevkit-0.0.1.tgz xdrs-core@file:../../../dist/xdrs-core-0.0.1.tgz
	pnpm install

test: clean install
	pnpm exec mydevkit extract --output ./output
	test -e output/AGENTS.md
	test -e output/.xdrs/_core/adrs/principles/001-xdr-standards.md
	test -e output/.xdrs/mydevkit/adrs/principles/001-publish-mydevkit-as-an-extension-package.md
	test -e output/.github/skills/001-release-package/SKILL.md
	grep -q "mydevkit/adrs/index.md" output/.xdrs/index.md
	pnpm exec mydevkit check --output ./output
	@echo "All tests passed!"

lint: clean install
	pnpm exec mydevkit extract --output ./output
	pnpm exec xdrs-core lint ./output
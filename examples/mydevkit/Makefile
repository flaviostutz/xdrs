SHELL := /bin/bash

clean:
	@rm -rf dist node_modules consumer/node_modules consumer/output consumer/pnpm-lock.yaml

build: install
	pnpm pack --pack-destination=./dist

test: clean build consumer-install
	cd consumer && pnpm exec mydevkit extract --output ./output
	cd consumer && test -e output/AGENTS.md
	cd consumer && test -e output/.xdrs/_core/adrs/principles/001-xdr-standards.md
	cd consumer && test -e output/.xdrs/mydevkit/adrs/principles/001-publish-mydevkit-as-an-extension-package.md
	cd consumer && test -e output/.github/skills/001-release-package/SKILL.md
	cd consumer && grep -q "mydevkit/adrs/index.md" output/.xdrs/index.md
	cd consumer && pnpm exec mydevkit check --output ./output
	@echo "All tests passed!"

lint:
	cd consumer && pnpm exec xdrs-core lint ./output

install:
	pnpm install

consumer-install:
	cd consumer && pnpm add mydevkit@file:../dist/mydevkit-$$(node -p "require('../package.json').version").tgz xdrs-core@file:../../../dist/xdrs-core-$$(node -p "require('../../../package.json').version").tgz
	cd consumer && pnpm install
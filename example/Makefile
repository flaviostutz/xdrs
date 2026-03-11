SHELL := /bin/bash

clean:
	@rm -rf output node_modules

test: clean install
	pnpm exec xdrs-core extract --output ./output
	test -e output/AGENTS.md
	test ! -e output/README.md
	test ! -e output/LICENSE
	test -e output/.npmdata
	test -e output/.xdrs/_core/adrs/principles/001-xdr-standards.md

	pnpm exec xdrs-core extract --output ./output

install:
	# replace the dependency with the local package
	pnpm add xdrs-core@file:../dist/xdrs-core-0.0.1.tgz
	pnpm install


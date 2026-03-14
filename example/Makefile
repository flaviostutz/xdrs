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

	# test that .xdrs/index.md changes are preserved on re-extraction (--keep-existing)
	chmod +w output/.xdrs/index.md
	echo "## CUSTOM SECTION" >> output/.xdrs/index.md
	chmod +w output/AGENTS.md
	echo "## CUSTOM SECTION" >> output/AGENTS.md
	pnpm exec xdrs-core extract --output ./output --keep-existing
	grep -q "CUSTOM SECTION" output/.xdrs/index.md

	# npmdata check - verify managed files are in sync
	pnpm exec xdrs-core check --output ./output

install:
	# replace the dependency with the local package
	pnpm add xdrs-core@file:../dist/xdrs-core-0.0.1.tgz
	pnpm install


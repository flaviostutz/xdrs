all: build test

build: install
	pnpm pack --pack-destination=./dist

lint:
	node ./lib/lint.js .

test: build
	make -C example test

clean:
	rm -rf dist node_modules
	make -C example clean

install:
# 	pnpm add filedist@file:../filedist/lib/dist/filedist-0.0.1.tgz
	pnpm install

publish:
	npx -y monotag@1.26.0 current --bump-action=latest --prefix=
	@VERSION=$$(node -p "require('./package.json').version"); \
	if echo "$$VERSION" | grep -q '-'; then \
		TAG=$$(echo "$$VERSION" | sed 's/[0-9]*\.[0-9]*\.[0-9]*-\([a-zA-Z][a-zA-Z0-9]*\).*/\1/'); \
		echo "Prerelease version $$VERSION detected, publishing with --tag $$TAG to avoid it being 'latest'"; \
		npm publish --no-git-checks --tag "$$TAG"; \
	else \
		npm publish --no-git-checks; \
	fi

bump:
	pnpm add filedist@latest
	pnpm install

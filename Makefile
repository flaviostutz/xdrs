all: build test

build: install
	pnpm pack --pack-destination=./dist

lint:
	@echo "No linting rules to check"

test: build
	cd example && make test

clean:
	rm -rf dist node_modules

install:
# 	pnpm add npmdata@file:../npmdata/lib/dist/npmdata-0.0.1.tgz
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

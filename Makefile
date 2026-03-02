build:
	pnpm pack --pack-destination=./dist

lint:
	@echo "No linting rules to check"

test:
	make build
	mkdir package
	cd package && tar -xzf dist/xdrs-*.tgz -C package --strip-components=1
	cd package && npx bin/npmdata.js

publish:
	npx -y monotag@1.26.0 current --bump-action=latest --prefix=
	@VERSION=$$(node -p "require('./package.json').version"); \
	if echo "$$VERSION" | grep -q '-'; then \
		TAG=$$(echo "$$VERSION" | sed 's/[0-9]*\.[0-9]*\.[0-9]*-\([a-zA-Z][a-zA-Z0-9]*\).*/\1/'); \
		echo "Prerelease version $$VERSION detected, publishing with --tag $$TAG to avoid it being 'latest'"; \
		npm publish --no-git-checks --provenance --tag "$$TAG"; \
	else \
		npm publish --no-git-checks --provenance; \
	fi

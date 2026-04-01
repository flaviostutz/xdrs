# Contributing

## Before you start

This project uses XDRs as its source of truth for decisions about structure, engineering, and documentation. Before proposing a change, review:

- `.xdrs/index.md`
- the relevant scope and type index under `.xdrs/`
- `AGENTS.md`

Keep changes focused. Small, well-scoped contributions are preferred because they make discussion and review faster and clearer.

## Report bugs in issues

Open an issue before preparing a fix when you find a bug.

Include:

- what happened
- what you expected to happen
- reproduction steps
- affected files, commands, or environments when relevant

If you already know how to fix the problem, link the issue from your pull request.

## Discuss features in issues first

Do not start larger feature work without prior discussion. Open an issue to explain:

- the problem being solved
- why the change belongs in this project
- the expected impact on users, XDRs, skills, articles, or packaging

This keeps feature work aligned before implementation starts and avoids unnecessary PR churn.

## Send changes through pull requests

Contribute fixes and features through pull requests only.

- Create a feature branch from `main`.
- Keep the branch focused on one topic.
- Target `main` when opening the pull request.
- Link the related issue when one exists.

Prefer several small pull requests over one large mixed change. If a change requires broader refactoring, separate the refactor from behavior changes whenever possible.

## Keep reviewable size

Pull requests should stay small enough that reviewers can understand the full intent in one pass.

Prefer:

- one problem per PR
- limited file count when possible
- isolated renames or formatting changes in separate PRs
- clear commit and PR descriptions explaining the rationale

Avoid combining unrelated fixes, features, and documentation updates unless they are tightly coupled.

## Use conventional comments in review

When reviewing or responding to review, use conventional comments to make intent explicit. Examples:

- `issue:` for a defect or blocking concern
- `suggestion:` for a concrete improvement
- `question:` for clarification
- `nitpick:` for minor optional changes
- `praise:` for something worth highlighting

Apply the same style when replying to feedback so discussion stays precise and easy to scan.

## Validate your change

Before asking for review, run the project checks from the repository root:

```bash
make build
make lint
make test
```

If your change affects examples, packaging, or XDR content, make sure those paths still work end to end.

## XDR-related contributions

When changing XDRs, skills, or articles:

- keep XDRs focused and concise
- update canonical indexes when required
- avoid introducing conflicts with accepted XDRs
- place new content in the correct scope, type, and subject

If a contribution introduces a reusable or non-trivial decision, document it as an XDR instead of leaving the rationale only in the PR.
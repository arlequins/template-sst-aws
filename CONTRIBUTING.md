# Contributing

## Commit format

Use Conventional Commits so Release Please can determine the next semantic version:

- `fix: ...` — patch release
- `feat: ...` — minor release
- `feat!: ...` or a `BREAKING CHANGE:` footer — major release
- `docs: ...`, `chore: ...`, and `ci: ...` — no release by default

Keep each commit focused. Do not include AWS account IDs, email addresses, credentials, state files, or real deployment configuration.

## Review gate

Pull requests must pass `CI / validate`. Enable branch protection on `main` and require that check before merging. The release workflow runs only after the successful CI run for `main`; it never deploys AWS resources.

# AWS bootstrap with SST

This repository is a reusable SST reference template for an `aws-bootstrap` project: account-level controls that must remain separate from application infrastructure. It does not deploy to AWS from CI, and it is not a live account deployment repository.

Keep this project separate from `beat` (or any other application SST project). Application deletion, renaming, or stage cleanup must never alter account budgets, GitHub trust, or account-wide public-access controls.

## What a derived project can include

- A monthly **actual-cost** budget with alerts at 50%, 80%, and 100%.
- A zero-spend actual-cost alert and a 100% forecast-cost alert.
- Account-wide S3 Block Public Access.
- Default encryption for newly created EBS volumes in the selected region.
- A strong IAM password policy for legacy IAM users.
- Optional multi-region CloudTrail management-event audit trail, stored in a private, versioned, encrypted S3 bucket.

The SST code has `retain-all` removal protection. A project derived from this template must review its own account, organization controls, and deployment process before any manual deployment.

## Template validation

The CI workflow checks TypeScript syntax and prepares the SST provider only. It never supplies AWS credentials or runs `sst deploy`, `sst remove`, `sst diff`, or an AWS CLI command. SST generates full provider types when a derived project is connected to its intended provider; that operation can require account credentials, so it is deliberately outside this template CI.

Run the same validation locally:

1. `pnpm install`
2. `pnpm install:sst`
3. `pnpm check`

## Release process

1. Open a pull request using [Conventional Commits](https://www.conventionalcommits.org/), for example `feat: add config recorder template` or `fix: correct budget threshold validation`.
2. CI must pass before the pull request is merged into `main`. Configure `CI / validate` as a required branch-protection check.
3. After a successful `main` CI run, the release workflow uses Release Please to create or update a release PR.
4. Merging that generated PR updates `package.json`, `pnpm-lock.yaml`, and `.release-please-manifest.json`, creates a `vX.Y.Z` tag, and publishes a GitHub Release.

Release Please follows semantic versioning from commit types: `fix:` → patch, `feat:` → minor, and a `!` or `BREAKING CHANGE:` footer → major. The package remains `private`; no npm package is published.

## Use in a derived deployment project

Consume a released Git tag rather than copying the template. A derived repository pins the exact reviewed version, completes the manual checklist in [docs/initial-setup.md](docs/initial-setup.md), and owns its account-specific values and deployment workflow. Do not add account credentials to this template repository or its CI secrets.

```json
{
  "dependencies": {
    "aws-account-baseline-sst": "github:arlequins/template-sst-aws#v0.1.0"
  }
}
```

The first usable tag is created only after this repository's Release Please PR is merged. See [docs/consuming-the-template.md](docs/consuming-the-template.md) for the required consumer boundary.

`ENABLE_AUDIT_TRAIL` is deliberately false by default. Enable it only after confirming that AWS Organizations or Control Tower has not already created an organization trail.

## Decisions before production

See [docs/initial-setup.md](docs/initial-setup.md) for decisions that cannot safely be guessed: alert recipients and thresholds, organization/account layout, audit-log ownership and retention, identity provider, and security-service coverage.

[The bootstrap design](docs/aws-bootstrap.md) records all required account controls, which ones are implemented here, and which require account-specific input in a deployment repository.

# Infrastructure architecture

This repository owns account-level AWS controls and reusable application
storage primitives. It must not contain application routes, domain behavior, or
runtime secrets. A derived application repository owns its API, web, and
feature slices and consumes this package at a pinned release.

## Clean Architecture boundary

```text
derived application domain -> application port <- this package's SST adapter
account baseline composition -> AWS resources
```

The `infra/` modules are infrastructure adapters and configuration builders:

| Module | Responsibility |
| --- | --- |
| `infra/baseline.ts` | account-wide budgets, IAM controls, and public-access block |
| `infra/account-addons.ts` | optional account services and audit controls |
| `infra/private-bucket.ts` | private, encrypted, versioned bucket primitive |
| `infra/s3-primary-data.ts` | mutable state plus immutable ledger application pattern |

Keep business rules such as authorization, content validation, and retry
decisions in the consuming application. Keep account-wide controls here and
never recreate them in an application stack.

## Composition rules

1. Export typed configuration builders from `infra/`; avoid hidden global state.
2. Keep resource names, retention, deletion protection, and `retain-all`
   behavior explicit in the composition root.
3. Give runtime roles only the object actions required by the application
   contract; account bootstrap roles are not runtime roles.
4. Validate configuration with unit tests before any protected `sst diff`.
5. Run AWS diff/deploy only from a trusted GitHub Actions OIDC workflow in the
   consuming repository.

See [S3-primary application contract](s3-primary-data.md) for the storage
adapter boundary and [consuming the template](consuming-the-template.md) for
the handoff between account baseline and application infrastructure.

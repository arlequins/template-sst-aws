# Consuming this template from a deployment repository

This repository releases the reusable account-baseline module. A separate application deployment repository owns the AWS account configuration and deployment authority.

## Dependency rule

Pin an immutable release tag in the deployment repository. Do not depend on a branch such as `main`.

```json
{
  "dependencies": {
    "aws-account-baseline-sst": "github:arlequins/template-sst-aws#vX.Y.Z"
  }
}
```

The consumer imports the single public module:

```ts
import { createAccountBaseline } from "aws-account-baseline-sst/baseline";
```

Application deployment repositories may additionally import the S3-primary
module:

```ts
import { createS3PrimaryDataStore } from "aws-account-baseline-sst/s3-primary-data";
```

That module belongs in the application deployment, not in the once-per-account
bootstrap stack. Review [the S3-primary contract](s3-primary-data.md) before
using it.

## Consumer-owned configuration

Keep these values only in the deployment repository's protected environment or its encrypted secret store:

- `BUDGET_ALERT_EMAIL`
- `MONTHLY_BUDGET_USD`
- `AWS_REGION`
- `ENABLE_AUDIT_TRAIL`
- the AWS account/stage mapping and deployment role

The template must not contain a real email address, account ID, AWS profile, credentials, or deployment workflow.

## Upgrade process

1. Wait for a published `vX.Y.Z` tag in this repository.
2. Update the consumer dependency to that exact tag and regenerate its lockfile.
3. Review the dependency diff and run the consumer's non-deployment CI.
4. Deploy only from the consumer repository's protected workflow after account-specific approval.

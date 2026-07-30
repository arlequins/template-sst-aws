# AWS bootstrap design

Use this project once per AWS account, independently from application SST projects. It owns account-wide controls; a consumer project such as `beat-sst-aws` supplies the real account values and deploys them after review.

## Coverage matrix

| Control | Template status | Owner / notes |
| --- | --- | --- |
| `ap-northeast-1` default | Implemented as a configurable default | Consumer may override `AWS_REGION`; deploy regional controls once per intended region. |
| Monthly Budget | Implemented | Default recommendation: USD 10; actual alerts at 0, 50, 80, 100%, plus forecast at 100%. Budget is an alert, not a spending cap. |
| Cost Anomaly Detection | Required consumer module | Create a service monitor and email/SNS subscription; start at USD 3. It needs an account-owned recipient. |
| Account S3 Block Public Access | Implemented | All four account-level controls are enabled. |
| Private application S3 bucket | Implemented reusable module | `private-bucket` enables all four bucket controls, BucketOwnerEnforced ownership, versioning, default encryption, and denies non-TLS requests. |
| EBS encryption by default | Implemented | Regional control. |
| IAM Access Analyzer | Required consumer module | One account analyzer per intended region. |
| CloudTrail management events | Optional, implemented | Enable only when no Organizations/Control Tower trail already covers the account. |
| GitHub Actions OIDC provider and roles | Required consumer module | Create dev and production roles separately; trust only a configured repository and GitHub Environment subject. Do not use AWS access keys in GitHub. |
| Secrets Manager runtime secret | Required consumer module | Create a secret container and narrowly grant the production OIDC role `GetSecretValue`; populate the value outside IaC. |
| Cost allocation tag activation | Manual billing-console action | AWS account billing setting; activate `Project`, `Stage`, `Owner`, and `ManagedBy`. |
| Root, contacts, Free Tier alerts, IAM Identity Center | Manual bootstrap action | These control account ownership and human access and are intentionally not automated. |

## Manual bootstrap order

1. Secure root access: MFA, no root access keys, and alternate security/operations/billing contacts.
2. Confirm Billing Preferences and Free Tier alerts.
3. Enable IAM Identity Center, create the initial administrator permission set, and configure a local SSO profile. Do not create long-lived local access keys.
4. Deploy this bootstrap from that SSO profile once.
5. Create environment-specific GitHub OIDC deployment roles. Restrict production to `repo:OWNER/REPOSITORY:environment:production`; use a branch subject only when no GitHub Environment is used.
6. Move routine deployment to GitHub Actions OIDC and remove unnecessary human administrator access.

## Application boundary

An application SST project owns only its own resources. For `production`, set `protect: true`, retain persistent data, and use resource-level deletion protection where AWS supports it. Do not assume `protect` prevents all destructive edits: it prevents `sst remove`, while individual resources still need their own deletion safeguards.

For Beat specifically, the application deployment role receives only `s3:ListBucket` constrained to `admins/events/*` and `s3:GetObject` for that prefix. It receives neither `PutObject` nor `DeleteObject`. The administrator event bucket should be created with Object Lock at creation time if WORM retention is required; S3 versioning by itself is not immutability.

Use `createPrivateBucket("BeatAuthEvents", { name: "arlequin-beat-auth-prod" })` in the consumer's SST config. The consumer must not add a public bucket policy, ACL, or S3 website configuration to that bucket.

## Cost guardrails

Add service/tag budgets for Aurora, Bedrock, CloudWatch Logs, and NAT Gateway only in the consumer project that knows the workload and owner. Cost Anomaly Detection is complementary: it detects changes in spend patterns, while Budgets compare cost to fixed or forecast thresholds.

Free Tier and credit rules are account-age and plan dependent. Treat AWS-provided credit/Free Tier emails as an additional alert channel, not as a substitute for the Budget and anomaly controls above. Do not create an AWS Organization or Control Tower solely from this template without first checking the account's current credit and plan consequences.

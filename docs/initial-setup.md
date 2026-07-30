# AWS initial setup checklist

This is a baseline for a new, standalone AWS account. For an AWS Organization, apply organization-wide controls from the management/security account instead of duplicating them in every member account.

## Deploy through this template

| Control | Why it is included | Configuration |
| --- | --- | --- |
| Monthly cost budget | Detects spend during the billing period | `MONTHLY_BUDGET_USD`, `BUDGET_ALERT_EMAIL` |
| S3 Block Public Access | Prevents accidental public S3 exposure account-wide | Always enabled |
| EBS encryption by default | Encrypts new EBS volumes in the selected region | Always enabled; deploy once per region |
| IAM password policy | Protects any remaining IAM console users | Always enabled; prefer Identity Center for humans |
| CloudTrail management events | Records account and control-plane activity | Opt in with `ENABLE_AUDIT_TRAIL=true` |

Budget alerts are **actual spend**, not a spending cap. AWS does not automatically stop resources when a threshold is crossed. Confirm the subscription email after deployment.

## Must do manually before deploying

- [ ] Secure the root user: enable MFA, remove root access keys, and do not use root for normal work.
- [ ] Choose the account model: standalone account or AWS Organizations (recommended for production with separate management, security/log archive, development, and production accounts).
- [ ] Set up human access through IAM Identity Center and least-privilege permission sets; avoid long-lived IAM users and access keys.
- [ ] Set billing-console access for the finance/owner role and confirm the account's billing contact information.
- [ ] Decide who receives cost alerts and the monthly budget. Use a monitored group mailbox rather than one person's address.
- [ ] Decide the deployment identity: an IAM Identity Center role or CI role using OIDC with short-lived credentials.

## Decide before enabling optional services

| Service/control | Default | Decision required |
| --- | --- | --- |
| CloudTrail audit bucket | Off | Do not create a second trail if an Organizations/Control Tower trail already covers the account. Decide log-account ownership and retention period. |
| AWS Config | Off | It records configuration history and can add ongoing cost; choose regions, resource types, retention, and delivery destination. |
| GuardDuty | Off | It has paid monitoring after any free trial; decide accounts/regions and incident owner. |
| Security Hub | Off | It aggregates security findings and can incur charges; decide standards and finding workflow. |
| Amazon Macie | Off | Potentially significant data-discovery cost; enable only with a defined S3 data-classification need. |
| Cost Anomaly Detection | Off | Choose monitor scope and alert recipients. It complements, rather than replaces, the monthly budget. |
| Backup plans | Off | Choose RPO/RTO, retention, vault/account isolation, and covered resources first. |

## After deployment: verify

- [ ] In Billing, verify the monthly budget amount, actual-cost alerts (50/80/100%), and confirmed email subscription.
- [ ] In S3, verify account Block Public Access is fully enabled.
- [ ] In EC2, verify EBS encryption by default in every intended region.
- [ ] In IAM, verify the password policy and that no routine work uses root credentials.
- [ ] If enabled, generate a harmless console/API action and confirm a CloudTrail management event arrives in the audit bucket.
- [ ] Record the deployed SST stage, AWS account ID, region, owner, and change-review process in your team runbook.

## Known boundaries

- Billing settings, root MFA, Organizations, IAM Identity Center, and account contacts are deliberately not automated here because they can change account ownership or require an identity-provider/organization decision.
- EBS encryption is regional. Deploy this template separately for each required region after reviewing the effects.
- This template does not set an AWS Budget Action to stop services. Automatic stopping can cause outages and requires a service-specific decision.

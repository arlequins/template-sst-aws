# S3-primary application data pattern

Use this module only for small, low-write-concurrency systems whose online
queries can resolve to deterministic S3 object keys. It is not a drop-in
replacement for a relational database.

The pattern creates two private buckets:

| Bucket | Purpose | Write model |
| --- | --- | --- |
| State | Mutable projections, sessions, rate-limit windows, workflow heads | Versioned compare-and-swap writes |
| Ledger | Security, review, and business events | Object Lock protected create-only writes |

The module also creates a customer-managed IAM policy for the application
runtime. The policy can read and write state, append ledger objects, and list
only the configured key namespace. It deliberately grants no S3 delete
permission and no ledger read permission.

## Consumer example

```ts
import { createS3PrimaryDataStore } from "aws-account-baseline-sst/s3-primary-data";

const data = createS3PrimaryDataStore("ApplicationData", {
  stateBucketName: "acme-state-production",
  ledgerBucketName: "acme-ledger-production",
  ledgerRetentionDays: 365,
  ledgerObjectLockMode: "COMPLIANCE",
  acknowledgeComplianceRetention: true,
  prefix: "v1",
  runtimePolicyName: "acme-production-s3-primary",
  tags: {
    ManagedBy: "SST",
    Project: "acme",
    Stage: "production",
  },
});

new aws.iam.RolePolicyAttachment("ApplicationDataAccess", {
  role: applicationRole.name,
  policyArn: data.runtimePolicy.arn,
});
```

Bucket names are globally unique and therefore remain consumer-owned
configuration. A consumer may use `GOVERNANCE` Object Lock without the
compliance acknowledgement when operators need a separately authorized
retention bypass.

## Application protocol

Infrastructure policy prevents unconditional writes, but application code must
still implement the protocol:

1. Create a new state object with `If-None-Match: *`.
2. Read an existing state object and retain its ETag.
3. Replace that object with `If-Match: <etag>`.
4. Treat `412 Precondition Failed` as a concurrency conflict.
5. Write each ledger event to a unique key with `If-None-Match: *`.
6. Use idempotency keys and immutable revision objects when one command spans
   more than one S3 key.
7. Never assume a transaction across objects or buckets.

The state bucket keeps versioning enabled and expires noncurrent versions after
90 days by default. Choose a longer period when incident investigation or
recovery requirements demand it. The ledger bucket has versioning and Object
Lock enabled at creation and does not receive a completed-object expiration
rule.

The conditional-write bucket policies apply to `PutObject`. A workload that
uses `CopyObject`, multipart completion, replication, inventory, or another AWS
service writer must receive a separate policy review before adopting this
module.

## Suitable workloads

This pattern is reasonable when all of the following are true:

- write concurrency is low;
- each online lookup has a deterministic object key;
- one aggregate can be updated atomically in one object;
- background reconciliation can repair interrupted multi-object workflows;
- joins, arbitrary queries, globally ordered counters, and full-text search are
  not required.

Move mutable state behind the application's storage interface to DynamoDB or a
relational database when those assumptions stop holding. The immutable S3
ledger may remain.

## Production operations

- Enable CloudTrail S3 data events for both buckets.
- Alarm on conditional-write conflicts, rejected deletes, reconciliation
  backlog, and unexpected authorization failures.
- Enable S3 Inventory for the ledger and periodically verify retention status.
- Exercise recovery from a selected state object version into a separate
  recovery prefix.
- Keep production removal protection in the consuming SST application.
- Test conditional writes and Object Lock against real AWS buckets before
  accepting production traffic; unit tests do not prove provider behavior.

## AWS references

- [Amazon S3 data consistency model](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html#ConsistencyModel)
- [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)
- [Enforcing conditional writes with bucket policy](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes-enforce.html)
- [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
- [S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)

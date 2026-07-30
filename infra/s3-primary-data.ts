import { createPrivateBucket } from "./private-bucket";
import {
  type S3PrimaryDataInput,
  resolveS3PrimaryDataConfig,
} from "./s3-primary-data-config";

export type {
  ResolvedS3PrimaryDataConfig,
  S3PrimaryDataInput,
} from "./s3-primary-data-config";

/**
 * Creates the two-bucket pattern for low-concurrency S3-primary applications:
 * mutable versioned state and an Object Lock protected append-only ledger.
 *
 * The returned IAM policy deliberately has no S3 delete permissions. Attach it
 * only to the application runtime that implements ETag conditional writes.
 */
export function createS3PrimaryDataStore(
  logicalName: string,
  input: S3PrimaryDataInput,
) {
  const config = resolveS3PrimaryDataConfig(input);
  const stateBucket = createPrivateBucket(`${logicalName}State`, {
    name: config.stateBucketName,
    noncurrentVersionExpirationDays:
      config.stateNoncurrentVersionExpirationDays,
    tags: config.tags,
    versioning: true,
    writeProtection: "conditional",
  });
  const ledgerBucket = createPrivateBucket(`${logicalName}Ledger`, {
    acknowledgeComplianceRetention:
      config.acknowledgeComplianceRetention,
    name: config.ledgerBucketName,
    objectLockMode: config.ledgerObjectLockMode,
    objectLockRetentionDays: config.ledgerRetentionDays,
    tags: config.tags,
    versioning: true,
    writeProtection: "append-only",
  });
  const objectPrefix = `${config.prefix}/*`;
  const policyDocument = aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        sid: "ReadBucketMetadata",
        effect: "Allow",
        actions: ["s3:GetBucketLocation"],
        resources: [stateBucket.arn, ledgerBucket.arn],
      },
      {
        sid: "ListApplicationPrefixes",
        effect: "Allow",
        actions: ["s3:ListBucket"],
        resources: [stateBucket.arn, ledgerBucket.arn],
        conditions: [
          {
            test: "StringLike",
            variable: "s3:prefix",
            values: [config.prefix, objectPrefix],
          },
        ],
      },
      {
        sid: "ReadAndConditionallyWriteState",
        effect: "Allow",
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [$interpolate`${stateBucket.arn}/${objectPrefix}`],
      },
      {
        sid: "AppendLedgerEvents",
        effect: "Allow",
        actions: ["s3:PutObject"],
        resources: [$interpolate`${ledgerBucket.arn}/${objectPrefix}`],
      },
    ],
  });
  const runtimePolicy = new aws.iam.Policy(`${logicalName}RuntimePolicy`, {
    ...(config.runtimePolicyName ? { name: config.runtimePolicyName } : {}),
    description:
      "Least-privilege access for S3-primary mutable state and immutable ledger writes",
    policy: policyDocument.json,
    tags: config.tags,
  });

  return {
    ledgerBucket,
    prefix: config.prefix,
    runtimePolicy,
    stateBucket,
  };
}

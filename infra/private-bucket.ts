import {
  type PrivateBucketInput,
  resolvePrivateBucketConfig,
} from "./private-bucket-config";

export type {
  ObjectLockMode,
  PrivateBucketInput,
  ResolvedPrivateBucketConfig,
  WriteProtectionMode,
} from "./private-bucket-config";

/**
 * A private data bucket. This is deliberately incompatible with S3 website
 * hosting: access must be granted through IAM, CloudFront, or another private
 * AWS integration.
 */
export function createPrivateBucket(logicalName: string, input: PrivateBucketInput) {
  const config = resolvePrivateBucketConfig(input);
  const bucket = new aws.s3.BucketV2(logicalName, {
    bucket: input.name,
    ...(config.objectLock ? { objectLockEnabled: true } : {}),
    tags: input.tags,
  });

  new aws.s3.BucketPublicAccessBlock(`${logicalName}PublicAccess`, {
    bucket: bucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  });
  new aws.s3.BucketOwnershipControls(`${logicalName}Ownership`, {
    bucket: bucket.id,
    rule: { objectOwnership: "BucketOwnerEnforced" },
  });
  const versioning = new aws.s3.BucketVersioningV2(`${logicalName}Versioning`, {
    bucket: bucket.id,
    versioningConfiguration: { status: config.versioningStatus },
  });
  new aws.s3.BucketServerSideEncryptionConfigurationV2(`${logicalName}Encryption`, {
    bucket: bucket.id,
    rules: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" } }],
  });
  new aws.s3.BucketLifecycleConfigurationV2(`${logicalName}Lifecycle`, {
    bucket: bucket.id,
    rules: [
      {
        id: "abort-incomplete-multipart-uploads",
        status: "Enabled",
        abortIncompleteMultipartUpload: { daysAfterInitiation: 7 },
      },
      ...(config.noncurrentVersionExpirationDays === undefined
        ? []
        : [
            {
              id: "expire-noncurrent-versions",
              status: "Enabled" as const,
              noncurrentVersionExpiration: {
                noncurrentDays: config.noncurrentVersionExpirationDays,
              },
            },
          ]),
    ],
  });
  if (config.objectLock) {
    new aws.s3.BucketObjectLockConfigurationV2(
      `${logicalName}ObjectLock`,
      {
        bucket: bucket.id,
        rule: {
          defaultRetention: {
            days: config.objectLock.retentionDays,
            mode: config.objectLock.mode,
          },
        },
      },
      { dependsOn: [versioning] },
    );
  }

  const policy = aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        sid: "DenyInsecureTransport",
        effect: "Deny",
        principals: [{ type: "*", identifiers: ["*"] }],
        actions: ["s3:*"],
        resources: [bucket.arn, $interpolate`${bucket.arn}/*`],
        conditions: [
          {
            test: "Bool",
            variable: "aws:SecureTransport",
            values: ["false"],
          },
        ],
      },
      ...(config.writeProtection === "conditional"
        ? [
            {
              sid: "RequireConditionalWrites",
              effect: "Deny" as const,
              principals: [{ type: "*", identifiers: ["*"] }],
              actions: ["s3:PutObject"],
              resources: [$interpolate`${bucket.arn}/*`],
              conditions: [
                {
                  test: "Null",
                  variable: "s3:if-match",
                  values: ["true"],
                },
                {
                  test: "Null",
                  variable: "s3:if-none-match",
                  values: ["true"],
                },
              ],
            },
          ]
        : []),
      ...(config.writeProtection === "append-only"
        ? [
            {
              sid: "RequireCreateOnlyWrites",
              effect: "Deny" as const,
              principals: [{ type: "*", identifiers: ["*"] }],
              actions: ["s3:PutObject"],
              resources: [$interpolate`${bucket.arn}/*`],
              conditions: [
                {
                  test: "Null",
                  variable: "s3:if-none-match",
                  values: ["true"],
                },
              ],
            },
          ]
        : []),
    ],
  });
  new aws.s3.BucketPolicy(`${logicalName}TlsOnly`, {
    bucket: bucket.id,
    policy: policy.json,
  });

  return bucket;
}

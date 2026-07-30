type PrivateBucketInput = {
  /** A globally unique, account-owned bucket name. */
  name: string;
  /** Required for audit/event data; do not use this module for disposable caches. */
  versioning?: boolean;
  tags?: Record<string, string>;
  /** Enables WORM retention for append-only audit or event data. */
  objectLockRetentionDays?: number;
};

/**
 * A private data bucket. This is deliberately incompatible with S3 website
 * hosting: access must be granted through IAM, CloudFront, or another private
 * AWS integration.
 */
export function createPrivateBucket(logicalName: string, input: PrivateBucketInput) {
  const bucket = new aws.s3.BucketV2(logicalName, {
    bucket: input.name,
    ...(input.objectLockRetentionDays ? { objectLockEnabled: true } : {}),
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
  new aws.s3.BucketVersioningV2(`${logicalName}Versioning`, {
    bucket: bucket.id,
    versioningConfiguration: { status: input.versioning === false ? "Suspended" : "Enabled" },
  });
  new aws.s3.BucketServerSideEncryptionConfigurationV2(`${logicalName}Encryption`, {
    bucket: bucket.id,
    rules: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" } }],
  });
  new aws.s3.BucketLifecycleConfigurationV2(`${logicalName}Lifecycle`, {
    bucket: bucket.id,
    rules: [{
      id: "abort-incomplete-multipart-uploads",
      status: "Enabled",
      abortIncompleteMultipartUpload: { daysAfterInitiation: 7 },
    }],
  });
  if (input.objectLockRetentionDays) {
    if (!Number.isInteger(input.objectLockRetentionDays) || input.objectLockRetentionDays < 1) {
      throw new Error("objectLockRetentionDays must be a positive integer");
    }
    new aws.s3.BucketObjectLockConfigurationV2(`${logicalName}ObjectLock`, {
      bucket: bucket.id,
      rule: {
        defaultRetention: { days: input.objectLockRetentionDays, mode: "COMPLIANCE" },
      },
    });
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
    ],
  });
  new aws.s3.BucketPolicy(`${logicalName}TlsOnly`, {
    bucket: bucket.id,
    policy: policy.json,
  });

  return bucket;
}

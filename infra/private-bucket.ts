type PrivateBucketInput = {
  /** A globally unique, account-owned bucket name. */
  name: string;
  /** Required for audit/event data; do not use this module for disposable caches. */
  versioning?: boolean;
  tags?: Record<string, string>;
};

/**
 * A private data bucket. This is deliberately incompatible with S3 website
 * hosting: access must be granted through IAM, CloudFront, or another private
 * AWS integration.
 */
export function createPrivateBucket(logicalName: string, input: PrivateBucketInput) {
  const bucket = new aws.s3.BucketV2(logicalName, {
    bucket: input.name,
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

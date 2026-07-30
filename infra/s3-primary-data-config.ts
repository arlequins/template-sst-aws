import type { ObjectLockMode } from "./private-bucket-config";

export type S3PrimaryDataInput = {
  /** Globally unique bucket for mutable projections and workflow state. */
  stateBucketName: string;
  /** Globally unique bucket for immutable security and business events. */
  ledgerBucketName: string;
  /** Key namespace granted to the application runtime. Defaults to `v1`. */
  prefix?: string;
  /** Default Object Lock retention for ledger objects. */
  ledgerRetentionDays: number;
  /** Defaults to GOVERNANCE. */
  ledgerObjectLockMode?: ObjectLockMode;
  /** Required when ledgerObjectLockMode is COMPLIANCE. */
  acknowledgeComplianceRetention?: boolean;
  /** Defaults to 90 days. */
  stateNoncurrentVersionExpirationDays?: number;
  /** Optional stable name for the generated customer-managed IAM policy. */
  runtimePolicyName?: string;
  tags?: Record<string, string>;
};

export type ResolvedS3PrimaryDataConfig = {
  acknowledgeComplianceRetention: boolean;
  ledgerBucketName: string;
  ledgerObjectLockMode: ObjectLockMode;
  ledgerRetentionDays: number;
  prefix: string;
  runtimePolicyName?: string;
  stateBucketName: string;
  stateNoncurrentVersionExpirationDays: number;
  tags?: Record<string, string>;
};

export function resolveS3PrimaryDataConfig(
  input: S3PrimaryDataInput,
): ResolvedS3PrimaryDataConfig {
  const stateBucketName = input.stateBucketName.trim();
  const ledgerBucketName = input.ledgerBucketName.trim();
  const prefix = input.prefix?.trim() || "v1";
  const stateNoncurrentVersionExpirationDays =
    input.stateNoncurrentVersionExpirationDays ?? 90;
  const ledgerObjectLockMode = input.ledgerObjectLockMode ?? "GOVERNANCE";

  if (!stateBucketName || !ledgerBucketName) {
    throw new Error("stateBucketName and ledgerBucketName are required");
  }
  if (stateBucketName === ledgerBucketName) {
    throw new Error("state and ledger must use separate buckets");
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/.test(prefix)) {
    throw new Error(
      "prefix must contain only letters, numbers, slash, underscore, or hyphen",
    );
  }
  if (prefix.startsWith("/") || prefix.endsWith("/")) {
    throw new Error("prefix must not start or end with a slash");
  }
  if (
    !Number.isInteger(input.ledgerRetentionDays) ||
    input.ledgerRetentionDays < 1
  ) {
    throw new Error("ledgerRetentionDays must be a positive integer");
  }
  if (
    !Number.isInteger(stateNoncurrentVersionExpirationDays) ||
    stateNoncurrentVersionExpirationDays < 1
  ) {
    throw new Error(
      "stateNoncurrentVersionExpirationDays must be a positive integer",
    );
  }
  if (
    ledgerObjectLockMode === "COMPLIANCE" &&
    input.acknowledgeComplianceRetention !== true
  ) {
    throw new Error(
      "COMPLIANCE Object Lock requires acknowledgeComplianceRetention=true",
    );
  }

  return {
    acknowledgeComplianceRetention:
      input.acknowledgeComplianceRetention === true,
    ledgerBucketName,
    ledgerObjectLockMode,
    ledgerRetentionDays: input.ledgerRetentionDays,
    prefix,
    ...(input.runtimePolicyName?.trim()
      ? { runtimePolicyName: input.runtimePolicyName.trim() }
      : {}),
    stateBucketName,
    stateNoncurrentVersionExpirationDays,
    ...(input.tags ? { tags: input.tags } : {}),
  };
}

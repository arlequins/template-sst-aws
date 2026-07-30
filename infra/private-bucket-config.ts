export type ObjectLockMode = "COMPLIANCE" | "GOVERNANCE";
export type WriteProtectionMode = "append-only" | "conditional";

export type PrivateBucketInput = {
  /** A globally unique, account-owned bucket name. */
  name: string;
  /** Required for durable data; do not disable when Object Lock is enabled. */
  versioning?: boolean;
  /** Retains recoverable noncurrent versions for this many days. */
  noncurrentVersionExpirationDays?: number;
  tags?: Record<string, string>;
  /** Enables default WORM retention for append-only audit or event data. */
  objectLockRetentionDays?: number;
  /** Defaults to GOVERNANCE. COMPLIANCE requires an explicit acknowledgement. */
  objectLockMode?: ObjectLockMode;
  /** Required because COMPLIANCE retention cannot be shortened or bypassed. */
  acknowledgeComplianceRetention?: boolean;
  /**
   * Enforces either compare-and-swap writes or create-only writes in the
   * bucket policy. Copy operations need a separately reviewed policy.
   */
  writeProtection?: WriteProtectionMode;
};

export type ResolvedPrivateBucketConfig = {
  noncurrentVersionExpirationDays?: number;
  objectLock?: {
    mode: ObjectLockMode;
    retentionDays: number;
  };
  versioningStatus: "Enabled" | "Suspended";
  writeProtection?: WriteProtectionMode;
};

/**
 * Resolves irreversible bucket choices before any AWS resources are declared.
 */
export function resolvePrivateBucketConfig(
  input: PrivateBucketInput,
): ResolvedPrivateBucketConfig {
  const retentionDays = input.objectLockRetentionDays;
  const hasObjectLock = retentionDays !== undefined;
  const noncurrentVersionExpirationDays =
    input.noncurrentVersionExpirationDays;

  if (
    noncurrentVersionExpirationDays !== undefined &&
    (!Number.isInteger(noncurrentVersionExpirationDays) ||
      noncurrentVersionExpirationDays < 1)
  ) {
    throw new Error(
      "noncurrentVersionExpirationDays must be a positive integer",
    );
  }
  if (
    noncurrentVersionExpirationDays !== undefined &&
    input.versioning === false
  ) {
    throw new Error(
      "noncurrentVersionExpirationDays requires versioning to remain enabled",
    );
  }

  if (!hasObjectLock) {
    if (input.objectLockMode !== undefined) {
      throw new Error(
        "objectLockMode requires objectLockRetentionDays to be configured",
      );
    }
    return {
      ...(noncurrentVersionExpirationDays === undefined
        ? {}
        : { noncurrentVersionExpirationDays }),
      versioningStatus: input.versioning === false ? "Suspended" : "Enabled",
      ...(input.writeProtection
        ? { writeProtection: input.writeProtection }
        : {}),
    };
  }

  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new Error("objectLockRetentionDays must be a positive integer");
  }
  if (input.versioning === false) {
    throw new Error("Object Lock requires versioning to remain enabled");
  }

  const mode = input.objectLockMode ?? "GOVERNANCE";
  if (mode === "COMPLIANCE" && input.acknowledgeComplianceRetention !== true) {
    throw new Error(
      "COMPLIANCE Object Lock requires acknowledgeComplianceRetention=true",
    );
  }

  return {
    ...(noncurrentVersionExpirationDays === undefined
      ? {}
      : { noncurrentVersionExpirationDays }),
    objectLock: {
      mode,
      retentionDays,
    },
    versioningStatus: "Enabled",
    ...(input.writeProtection
      ? { writeProtection: input.writeProtection }
      : {}),
  };
}

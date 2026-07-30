export type ObjectLockMode = "COMPLIANCE" | "GOVERNANCE";

export type PrivateBucketInput = {
  /** A globally unique, account-owned bucket name. */
  name: string;
  /** Required for durable data; do not disable when Object Lock is enabled. */
  versioning?: boolean;
  tags?: Record<string, string>;
  /** Enables default WORM retention for append-only audit or event data. */
  objectLockRetentionDays?: number;
  /** Defaults to GOVERNANCE. COMPLIANCE requires an explicit acknowledgement. */
  objectLockMode?: ObjectLockMode;
  /** Required because COMPLIANCE retention cannot be shortened or bypassed. */
  acknowledgeComplianceRetention?: boolean;
};

export type ResolvedPrivateBucketConfig = {
  objectLock?: {
    mode: ObjectLockMode;
    retentionDays: number;
  };
  versioningStatus: "Enabled" | "Suspended";
};

/**
 * Resolves irreversible bucket choices before any AWS resources are declared.
 */
export function resolvePrivateBucketConfig(
  input: PrivateBucketInput,
): ResolvedPrivateBucketConfig {
  const retentionDays = input.objectLockRetentionDays;
  const hasObjectLock = retentionDays !== undefined;

  if (!hasObjectLock) {
    if (input.objectLockMode !== undefined) {
      throw new Error(
        "objectLockMode requires objectLockRetentionDays to be configured",
      );
    }
    return {
      versioningStatus: input.versioning === false ? "Suspended" : "Enabled",
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
    objectLock: {
      mode,
      retentionDays,
    },
    versioningStatus: "Enabled",
  };
}

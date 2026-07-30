import { describe, expect, it } from "vitest";

import { resolveS3PrimaryDataConfig } from "./s3-primary-data-config";

const base = {
  ledgerBucketName: "acme-ledger-production",
  ledgerRetentionDays: 365,
  stateBucketName: "acme-state-production",
};

describe("resolveS3PrimaryDataConfig", () => {
  it("uses recoverable production-safe defaults", () => {
    expect(resolveS3PrimaryDataConfig(base)).toEqual({
      acknowledgeComplianceRetention: false,
      ledgerBucketName: "acme-ledger-production",
      ledgerObjectLockMode: "GOVERNANCE",
      ledgerRetentionDays: 365,
      prefix: "v1",
      stateBucketName: "acme-state-production",
      stateNoncurrentVersionExpirationDays: 90,
    });
  });

  it("accepts explicitly acknowledged compliance retention", () => {
    expect(
      resolveS3PrimaryDataConfig({
        ...base,
        acknowledgeComplianceRetention: true,
        ledgerObjectLockMode: "COMPLIANCE",
        prefix: "application/v2",
      }),
    ).toMatchObject({
      acknowledgeComplianceRetention: true,
      ledgerObjectLockMode: "COMPLIANCE",
      prefix: "application/v2",
    });
  });

  it("requires different state and ledger buckets", () => {
    expect(() =>
      resolveS3PrimaryDataConfig({
        ...base,
        ledgerBucketName: base.stateBucketName,
      }),
    ).toThrow("separate buckets");
  });

  it.each(["/v1", "v1/", "v1 with spaces", "../v1"])(
    "rejects an unsafe prefix: %s",
    (prefix) => {
      expect(() =>
        resolveS3PrimaryDataConfig({ ...base, prefix }),
      ).toThrow("prefix");
    },
  );

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid ledger retention: %s",
    (ledgerRetentionDays) => {
      expect(() =>
        resolveS3PrimaryDataConfig({ ...base, ledgerRetentionDays }),
      ).toThrow("ledgerRetentionDays must be a positive integer");
    },
  );

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid noncurrent-version retention: %s",
    (stateNoncurrentVersionExpirationDays) => {
      expect(() =>
        resolveS3PrimaryDataConfig({
          ...base,
          stateNoncurrentVersionExpirationDays,
        }),
      ).toThrow(
        "stateNoncurrentVersionExpirationDays must be a positive integer",
      );
    },
  );

  it("requires explicit acknowledgement for compliance retention", () => {
    expect(() =>
      resolveS3PrimaryDataConfig({
        ...base,
        ledgerObjectLockMode: "COMPLIANCE",
      }),
    ).toThrow("acknowledgeComplianceRetention=true");
  });
});

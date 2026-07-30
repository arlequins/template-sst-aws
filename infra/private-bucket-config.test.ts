import { describe, expect, it } from "vitest";

import { resolvePrivateBucketConfig } from "./private-bucket-config";

describe("resolvePrivateBucketConfig", () => {
  it("enables versioning by default without Object Lock", () => {
    expect(resolvePrivateBucketConfig({ name: "acme-data" })).toEqual({
      versioningStatus: "Enabled",
    });
  });

  it("allows versioning to be suspended for non-durable buckets", () => {
    expect(
      resolvePrivateBucketConfig({
        name: "acme-cache",
        versioning: false,
      }),
    ).toEqual({ versioningStatus: "Suspended" });
  });

  it("retains noncurrent versions and conditional-write protection", () => {
    expect(
      resolvePrivateBucketConfig({
        name: "acme-state",
        noncurrentVersionExpirationDays: 90,
        writeProtection: "conditional",
      }),
    ).toEqual({
      noncurrentVersionExpirationDays: 90,
      versioningStatus: "Enabled",
      writeProtection: "conditional",
    });
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid noncurrent-version retention: %s",
    (noncurrentVersionExpirationDays) => {
      expect(() =>
        resolvePrivateBucketConfig({
          name: "acme-state",
          noncurrentVersionExpirationDays,
        }),
      ).toThrow("noncurrentVersionExpirationDays must be a positive integer");
    },
  );

  it("requires versioning for noncurrent-version retention", () => {
    expect(() =>
      resolvePrivateBucketConfig({
        name: "acme-state",
        noncurrentVersionExpirationDays: 90,
        versioning: false,
      }),
    ).toThrow(
      "noncurrentVersionExpirationDays requires versioning to remain enabled",
    );
  });

  it("uses governance retention as the recoverable Object Lock default", () => {
    expect(
      resolvePrivateBucketConfig({
        name: "acme-events",
        objectLockRetentionDays: 30,
      }),
    ).toEqual({
      objectLock: {
        mode: "GOVERNANCE",
        retentionDays: 30,
      },
      versioningStatus: "Enabled",
    });
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid retention days: %s",
    (objectLockRetentionDays) => {
      expect(() =>
        resolvePrivateBucketConfig({
          name: "acme-events",
          objectLockRetentionDays,
        }),
      ).toThrow("positive integer");
    },
  );

  it("rejects Object Lock when versioning is disabled", () => {
    expect(() =>
      resolvePrivateBucketConfig({
        name: "acme-events",
        objectLockRetentionDays: 30,
        versioning: false,
      }),
    ).toThrow("requires versioning");
  });

  it("requires an explicit acknowledgement for compliance retention", () => {
    expect(() =>
      resolvePrivateBucketConfig({
        name: "acme-events",
        objectLockMode: "COMPLIANCE",
        objectLockRetentionDays: 365,
      }),
    ).toThrow("acknowledgeComplianceRetention=true");

    expect(
      resolvePrivateBucketConfig({
        acknowledgeComplianceRetention: true,
        name: "acme-events",
        objectLockMode: "COMPLIANCE",
        objectLockRetentionDays: 365,
      }),
    ).toMatchObject({
      objectLock: { mode: "COMPLIANCE", retentionDays: 365 },
    });
  });

  it("rejects a retention mode without a retention period", () => {
    expect(() =>
      resolvePrivateBucketConfig({
        name: "acme-events",
        objectLockMode: "GOVERNANCE",
      }),
    ).toThrow("requires objectLockRetentionDays");
  });
});

/// <reference path="./.sst/platform/config.d.ts" />

import { createAccountBaseline } from "./infra/baseline";

const region = process.env.AWS_REGION ?? "ap-northeast-1";

export default $config({
  app(input) {
    return {
      name: "aws-account-baseline",
      home: "aws",
      providers: {
        aws: { region },
      },
      // Account-level security resources must never be accidentally discarded.
      removal: "retain-all",
    };
  },
  async run() {
    if (process.env.ACKNOWLEDGE_ACCOUNT_BASELINE !== "true") {
      throw new Error(
        "Set ACKNOWLEDGE_ACCOUNT_BASELINE=true only after reviewing docs/initial-setup.md.",
      );
    }

    return createAccountBaseline({
      stage: $app.stage,
      region,
      alertEmail: requiredEnv("BUDGET_ALERT_EMAIL"),
      monthlyBudgetUsd: requiredPositiveNumber("MONTHLY_BUDGET_USD"),
      enableAuditTrail: process.env.ENABLE_AUDIT_TRAIL === "true",
    });
  },
});

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requiredPositiveNumber(name: string): number {
  const value = Number(requiredEnv(name));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return value;
}

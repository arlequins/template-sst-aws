type AccountBaselineInput = {
  stage: string;
  region: string;
  alertEmail: string;
  monthlyBudgetUsd: number;
  enableAuditTrail: boolean;
};

export function createAccountBaseline(input: AccountBaselineInput) {
  const caller = aws.getCallerIdentityOutput({});
  const tags = {
    ManagedBy: "SST",
    Purpose: "account-baseline",
    Stage: input.stage,
  };

  // The email address must be confirmed through the AWS subscription email
  // before budget notifications can be delivered.
  const budget = new aws.budgets.Budget("MonthlyCostBudget", {
    budgetType: "COST",
    limitAmount: input.monthlyBudgetUsd.toString(),
    limitUnit: "USD",
    timeUnit: "MONTHLY",
    timePeriodStart: currentMonthStart(),
    notifications: [
      {
        comparisonOperator: "GREATER_THAN",
        notificationType: "ACTUAL",
        threshold: 0,
        thresholdType: "ABSOLUTE_VALUE",
        subscriberEmailAddresses: [input.alertEmail],
      },
      ...[50, 80, 100].map((threshold) => ({
        comparisonOperator: "GREATER_THAN",
        notificationType: "ACTUAL" as const,
        threshold,
        thresholdType: "PERCENTAGE" as const,
        subscriberEmailAddresses: [input.alertEmail],
      })),
      {
        comparisonOperator: "GREATER_THAN",
        notificationType: "FORECASTED",
        threshold: 100,
        thresholdType: "PERCENTAGE",
        subscriberEmailAddresses: [input.alertEmail],
      },
    ],
    tags,
  });

  const publicAccessBlock = new aws.s3control.AccountPublicAccessBlock(
    "AccountPublicAccessBlock",
    {
      accountId: caller.accountId,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    },
  );

  const ebsEncryption = new aws.ec2.EbsEncryptionByDefault(
    "EbsEncryptionByDefault",
    { enabled: true },
  );

  const passwordPolicy = new aws.iam.AccountPasswordPolicy("PasswordPolicy", {
    minimumPasswordLength: 14,
    requireLowercaseCharacters: true,
    requireNumbers: true,
    requireSymbols: true,
    requireUppercaseCharacters: true,
    maxPasswordAge: 90,
    passwordReusePrevention: 24,
    allowUsersToChangePassword: true,
    hardExpiry: false,
  });

  const auditTrail = input.enableAuditTrail
    ? createAuditTrail({ stage: input.stage, region: input.region, tags })
    : undefined;

  return {
    accountId: caller.accountId,
    region: input.region,
    budgetName: budget.name,
    accountPublicAccessBlockId: publicAccessBlock.id,
    ebsEncryptionEnabled: ebsEncryption.enabled,
    passwordPolicyId: passwordPolicy.id,
    auditTrailName: auditTrail?.name ?? "disabled (set ENABLE_AUDIT_TRAIL=true)",
  };
}

function createAuditTrail(input: {
  stage: string;
  region: string;
  tags: Record<string, string>;
}) {
  const bucket = new aws.s3.BucketV2("AuditLogBucket", { tags: input.tags });
  new aws.s3.BucketPublicAccessBlock("AuditLogBucketPublicAccess", {
    bucket: bucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  });
  new aws.s3.BucketVersioningV2("AuditLogBucketVersioning", {
    bucket: bucket.id,
    versioningConfiguration: { status: "Enabled" },
  });
  new aws.s3.BucketServerSideEncryptionConfigurationV2("AuditLogBucketEncryption", {
    bucket: bucket.id,
    rules: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" } }],
  });

  const policy = aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        effect: "Allow",
        principals: [{ type: "Service", identifiers: ["cloudtrail.amazonaws.com"] }],
        actions: ["s3:GetBucketAcl"],
        resources: [bucket.arn],
      },
      {
        effect: "Allow",
        principals: [{ type: "Service", identifiers: ["cloudtrail.amazonaws.com"] }],
        actions: ["s3:PutObject"],
        resources: [
          $interpolate`${bucket.arn}/AWSLogs/${aws.getCallerIdentityOutput({}).accountId}/*`,
        ],
        conditions: [
          {
            test: "StringEquals",
            variable: "s3:x-amz-acl",
            values: ["bucket-owner-full-control"],
          },
        ],
      },
    ],
  });
  const bucketPolicy = new aws.s3.BucketPolicy("AuditLogBucketPolicy", {
    bucket: bucket.id,
    policy: policy.json,
  });

  return new aws.cloudtrail.Trail("ManagementEventsTrail", {
    s3BucketName: bucket.id,
    enableLogFileValidation: true,
    includeGlobalServiceEvents: true,
    isMultiRegionTrail: true,
    eventSelectors: [
      {
        includeManagementEvents: true,
        readWriteType: "All",
      },
    ],
    tags: input.tags,
  }, { dependsOn: [bucketPolicy] });
}

function currentMonthStart(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01_00:00`;
}

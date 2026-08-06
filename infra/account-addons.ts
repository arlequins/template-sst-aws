export type Tags = Record<string, string>;

export function standardTags(input: {
  project: string;
  stage: string;
  owner: string;
}): Tags {
  return {
    Project: input.project,
    Stage: input.stage,
    Owner: input.owner,
    ManagedBy: "sst",
  };
}

/** Detect public and cross-account access in this AWS account and Region. */
export function createAccessAnalyzer(name: string, tags: Tags) {
  return new aws.accessanalyzer.Analyzer(name, {
    analyzerName: name,
    type: "ACCOUNT",
    tags,
  });
}

/** GitHub Actions trust only; attach deployment permissions in the consumer. */
export function createGitHubOidcProvider(tags: Tags) {
  return new aws.iam.OpenIdConnectProvider("GitHubOidcProvider", {
    clientIdLists: ["sts.amazonaws.com"],
    url: "https://token.actions.githubusercontent.com",
    tags,
  });
}

export function createGitHubOidcRole(input: {
  name: string;
  repository: string;
  environment: string;
  providerArn: string;
  tags: Tags;
}) {
  const trust = aws.iam.getPolicyDocumentOutput({
    statements: [{
      effect: "Allow",
      actions: ["sts:AssumeRoleWithWebIdentity"],
      principals: [{ type: "Federated", identifiers: [input.providerArn] }],
      conditions: [
        { test: "StringEquals", variable: "token.actions.githubusercontent.com:aud", values: ["sts.amazonaws.com"] },
        { test: "StringEquals", variable: "token.actions.githubusercontent.com:sub", values: [`repo:${input.repository}:environment:${input.environment}`] },
      ],
    }],
  });
  return new aws.iam.Role(input.name, {
    assumeRolePolicy: trust.json,
    tags: input.tags,
  });
}

/** Creates only an empty secret container. Values are populated outside IaC. */
export function createRuntimeSecret(input: {
  name: string;
  readerRoleArn: string;
  tags: Tags;
}) {
  const secret = new aws.secretsmanager.Secret("RuntimeSecret", {
    name: input.name,
    recoveryWindowInDays: 30,
    tags: input.tags,
  });
  const policy = aws.iam.getPolicyDocumentOutput({
    statements: [{
      effect: "Allow",
      principals: [{ type: "AWS", identifiers: [input.readerRoleArn] }],
      actions: ["secretsmanager:GetSecretValue"],
      resources: [secret.arn],
    }],
  });
  new aws.secretsmanager.SecretPolicy("RuntimeSecretReaderPolicy", {
    secretArn: secret.arn,
    policy: policy.json,
  });
  return secret;
}

/** A service-wide Cost Anomaly monitor and daily email subscription. */
export function createCostAnomalyAlerts(input: {
  email: string;
  thresholdUsd?: number;
}) {
  const monitor = new aws.costexplorer.AnomalyMonitor("ServiceCostAnomalyMonitor", {
    name: "all-aws-services",
    monitorType: "DIMENSIONAL",
    monitorDimension: "SERVICE",
  });
  return new aws.costexplorer.AnomalySubscription("CostAnomalySubscription", {
    name: "cost-anomaly-email",
    frequency: "DAILY",
    monitorArnLists: [monitor.arn],
    subscribers: [{ type: "EMAIL", address: input.email }],
    thresholdExpression: {
      dimension: {
        key: "ANOMALY_TOTAL_IMPACT_ABSOLUTE",
        values: [(input.thresholdUsd ?? 3).toString()],
        matchOptions: ["GREATER_THAN_OR_EQUAL"],
      },
    },
  });
}

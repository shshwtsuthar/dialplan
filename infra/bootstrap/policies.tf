data "aws_caller_identity" "current" {}

# Naming contract with infra/: every resource the app creates is named
# "dialplan-*", and its IAM roles live under the workload path.
locals {
  account = data.aws_caller_identity.current.account_id
  region  = var.region

  state_key = "infra/terraform.tfstate"

  workload_roles = "arn:aws:iam::${local.account}:role/dialplan/workload/*"
  tables         = "arn:aws:dynamodb:${local.region}:${local.account}:table/dialplan-*"
  functions      = "arn:aws:lambda:${local.region}:${local.account}:function:dialplan-*"
  log_groups = [
    "arn:aws:logs:${local.region}:${local.account}:log-group:/aws/lambda/dialplan-*",
    "arn:aws:logs:${local.region}:${local.account}:log-group:/aws/apigateway/dialplan-*",
  ]
  http_apis = [
    "arn:aws:apigateway:${local.region}::/apis",
    "arn:aws:apigateway:${local.region}::/apis/*",
    "arn:aws:apigateway:${local.region}::/tags/*",
  ]
  amplify_apps = "arn:aws:amplify:${local.region}:${local.account}:apps/*"
  schedules    = "arn:aws:scheduler:${local.region}:${local.account}:schedule/default/dialplan-*"
  alarms       = "arn:aws:cloudwatch:${local.region}:${local.account}:alarm:dialplan-*"
  topics       = "arn:aws:sns:${local.region}:${local.account}:dialplan-*"
}

# ---------------------------------------------------------------------------
# Permissions boundary for every role the app creates (Lambda, Scheduler).
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "workload_boundary" {
  statement {
    sid = "TableItems"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:ConditionCheckItem",
    ]
    resources = [local.tables, "${local.tables}/index/*"]
  }

  statement {
    sid       = "FunctionLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${local.region}:${local.account}:log-group:/aws/lambda/dialplan-*"]
  }

  statement {
    sid       = "InvokeFunctions"
    actions   = ["lambda:InvokeFunction"]
    resources = [local.functions]
  }
}

resource "aws_iam_policy" "workload_boundary" {
  name        = "dialplan-workload-boundary"
  description = "Upper bound for roles created by the dialplan deploy role"
  policy      = data.aws_iam_policy_document.workload_boundary.json
}

# ---------------------------------------------------------------------------
# Read access: everything terraform plan needs to refresh state.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "infra_read" {
  statement {
    sid       = "DynamoDB"
    actions   = ["dynamodb:Describe*", "dynamodb:ListTagsOfResource"]
    resources = [local.tables]
  }

  statement {
    sid       = "Lambda"
    actions   = ["lambda:Get*", "lambda:List*"]
    resources = [local.functions, "${local.functions}:*"]
  }

  statement {
    sid = "IAM"
    actions = [
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:ListRoleTags",
    ]
    resources = [local.workload_roles]
  }

  statement {
    sid       = "ApiGateway"
    actions   = ["apigateway:GET"]
    resources = local.http_apis
  }

  statement {
    sid       = "Amplify"
    actions   = ["amplify:Get*", "amplify:List*"]
    resources = [local.amplify_apps]
  }

  statement {
    sid       = "Scheduler"
    actions   = ["scheduler:GetSchedule"]
    resources = [local.schedules]
  }

  statement {
    sid       = "CloudWatch"
    actions   = ["cloudwatch:DescribeAlarms", "cloudwatch:ListTagsForResource"]
    resources = [local.alarms]
  }

  statement {
    sid = "SNS"
    actions = [
      "sns:GetTopicAttributes",
      "sns:GetSubscriptionAttributes",
      "sns:ListSubscriptionsByTopic",
      "sns:ListTagsForResource",
    ]
    resources = [local.topics, "${local.topics}:*"]
  }

  statement {
    sid       = "LogGroupList"
    actions   = ["logs:DescribeLogGroups"]
    resources = ["arn:aws:logs:${local.region}:${local.account}:log-group:*"]
  }

  statement {
    sid       = "LogGroupTags"
    actions   = ["logs:ListTagsForResource", "logs:ListTagsLogGroup"]
    resources = local.log_groups
  }
}

resource "aws_iam_policy" "infra_read" {
  name        = "dialplan-infra-read"
  description = "Read the dialplan app's infrastructure (terraform plan)"
  policy      = data.aws_iam_policy_document.infra_read.json
}

# ---------------------------------------------------------------------------
# Write access: create, update and delete the app's infrastructure.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "infra_write" {
  statement {
    sid = "DynamoDB"
    actions = [
      "dynamodb:CreateTable",
      "dynamodb:UpdateTable",
      "dynamodb:DeleteTable",
      "dynamodb:UpdateContinuousBackups",
      "dynamodb:UpdateTimeToLive",
      "dynamodb:TagResource",
      "dynamodb:UntagResource",
    ]
    resources = [local.tables]
  }

  statement {
    sid = "Lambda"
    actions = [
      "lambda:CreateFunction",
      "lambda:DeleteFunction",
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:PublishVersion",
      "lambda:AddPermission",
      "lambda:RemovePermission",
      "lambda:InvokeFunction",
      "lambda:TagResource",
      "lambda:UntagResource",
    ]
    resources = [local.functions]
  }

  statement {
    sid = "WorkloadRolesWithBoundary"
    actions = [
      "iam:CreateRole",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePermissionsBoundary",
    ]
    resources = [local.workload_roles]

    condition {
      test     = "StringEquals"
      variable = "iam:PermissionsBoundary"
      values   = [aws_iam_policy.workload_boundary.arn]
    }
  }

  statement {
    sid = "WorkloadRoles"
    actions = [
      "iam:DeleteRole",
      "iam:UpdateRole",
      "iam:UpdateRoleDescription",
      "iam:UpdateAssumeRolePolicy",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:ListInstanceProfilesForRole",
    ]
    resources = [local.workload_roles]
  }

  statement {
    sid       = "PassWorkloadRoles"
    actions   = ["iam:PassRole"]
    resources = [local.workload_roles]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["lambda.amazonaws.com", "scheduler.amazonaws.com"]
    }
  }

  statement {
    sid       = "ApiGateway"
    actions   = ["apigateway:POST", "apigateway:PUT", "apigateway:PATCH", "apigateway:DELETE"]
    resources = local.http_apis
  }

  statement {
    sid = "LogGroups"
    actions = [
      "logs:CreateLogGroup",
      "logs:DeleteLogGroup",
      "logs:PutRetentionPolicy",
      "logs:DeleteRetentionPolicy",
      "logs:TagResource",
      "logs:UntagResource",
      "logs:TagLogGroup",
      "logs:UntagLogGroup",
    ]
    resources = local.log_groups
  }

  # API Gateway access logging is configured through CloudWatch Logs
  # deliveries, which do not support resource-level permissions.
  statement {
    sid = "ApiAccessLogDelivery"
    actions = [
      "logs:CreateLogDelivery",
      "logs:GetLogDelivery",
      "logs:UpdateLogDelivery",
      "logs:DeleteLogDelivery",
      "logs:ListLogDeliveries",
      "logs:PutResourcePolicy",
      "logs:DescribeResourcePolicies",
    ]
    resources = ["*"]
  }

  statement {
    sid = "Amplify"
    actions = [
      "amplify:CreateApp",
      "amplify:UpdateApp",
      "amplify:DeleteApp",
      "amplify:CreateBranch",
      "amplify:UpdateBranch",
      "amplify:DeleteBranch",
      "amplify:CreateDeployment",
      "amplify:StartDeployment",
      "amplify:StopJob",
      "amplify:TagResource",
      "amplify:UntagResource",
    ]
    resources = [local.amplify_apps]
  }

  statement {
    sid       = "Scheduler"
    actions   = ["scheduler:CreateSchedule", "scheduler:UpdateSchedule", "scheduler:DeleteSchedule"]
    resources = [local.schedules]
  }

  statement {
    sid       = "CloudWatch"
    actions   = ["cloudwatch:PutMetricAlarm", "cloudwatch:DeleteAlarms", "cloudwatch:TagResource", "cloudwatch:UntagResource"]
    resources = [local.alarms]
  }

  statement {
    sid = "SNS"
    actions = [
      "sns:CreateTopic",
      "sns:DeleteTopic",
      "sns:SetTopicAttributes",
      "sns:Subscribe",
      "sns:Unsubscribe",
      "sns:TagResource",
      "sns:UntagResource",
    ]
    resources = [local.topics, "${local.topics}:*"]
  }
}

resource "aws_iam_policy" "infra_write" {
  name        = "dialplan-infra-write"
  description = "Create, update and delete the dialplan app's infrastructure (terraform apply)"
  policy      = data.aws_iam_policy_document.infra_write.json
}

# ---------------------------------------------------------------------------
# Terraform state. Plans may take the lock but never write state.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "state" {
  for_each = {
    plan   = ["s3:GetObject"]
    deploy = ["s3:GetObject", "s3:PutObject"]
  }

  statement {
    sid       = "ListStateBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.state.arn]
  }

  statement {
    sid       = "StateFile"
    actions   = each.value
    resources = ["${aws_s3_bucket.state.arn}/${local.state_key}"]
  }

  statement {
    sid       = "LockFile"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.state.arn}/${local.state_key}.tflock"]
  }
}

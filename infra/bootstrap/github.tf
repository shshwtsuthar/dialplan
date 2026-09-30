# GitHub Actions authenticates with short-lived OIDC tokens; there are no
# long-lived access keys anywhere. Two roles:
#
#   dialplan-github-plan    pull requests: read-only, can take the state lock
#   dialplan-github-deploy  the "production" environment (main only): apply
#
# The deploy role can create IAM roles for the app, but only under
# /dialplan/workload/ and only with the workload permissions boundary
# attached, so it cannot mint a role more powerful than the app needs.

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_trust" {
  for_each = {
    plan   = "repo:${var.github_repository}:pull_request"
    deploy = "repo:${var.github_repository}:environment:${var.github_environment}"
  }

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [each.value]
    }
  }
}

resource "aws_iam_role" "plan" {
  name               = "dialplan-github-plan"
  description        = "GitHub Actions: terraform plan on pull requests"
  assume_role_policy = data.aws_iam_policy_document.github_trust["plan"].json
}

resource "aws_iam_role" "deploy" {
  name               = "dialplan-github-deploy"
  description        = "GitHub Actions: terraform apply and web deploys from main"
  assume_role_policy = data.aws_iam_policy_document.github_trust["deploy"].json
}

resource "aws_iam_role_policy_attachment" "plan_infra_read" {
  role       = aws_iam_role.plan.name
  policy_arn = aws_iam_policy.infra_read.arn
}

resource "aws_iam_role_policy_attachment" "deploy_infra_read" {
  role       = aws_iam_role.deploy.name
  policy_arn = aws_iam_policy.infra_read.arn
}

resource "aws_iam_role_policy_attachment" "deploy_infra_write" {
  role       = aws_iam_role.deploy.name
  policy_arn = aws_iam_policy.infra_write.arn
}

resource "aws_iam_role_policy" "plan_state" {
  name   = "terraform-state"
  role   = aws_iam_role.plan.id
  policy = data.aws_iam_policy_document.state["plan"].json
}

resource "aws_iam_role_policy" "deploy_state" {
  name   = "terraform-state"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.state["deploy"].json
}

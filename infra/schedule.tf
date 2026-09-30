# Put the demo back the way it started every night, San Diego time.

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name                 = "dialplan-scheduler"
  path                 = local.workload_role_path
  assume_role_policy   = data.aws_iam_policy_document.scheduler_assume.json
  permissions_boundary = local.workload_boundary_arn
}

data "aws_iam_policy_document" "scheduler" {
  statement {
    sid       = "InvokeReset"
    actions   = ["lambda:InvokeFunction"]
    resources = [module.reset_function.arn]
  }
}

resource "aws_iam_role_policy" "scheduler" {
  name   = "invoke-reset"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler.json
}

resource "aws_scheduler_schedule" "nightly_reset" {
  name                         = "dialplan-nightly-reset"
  description                  = "Restore the Harbor Auto demo dialplans"
  schedule_expression          = "cron(0 3 * * ? *)"
  schedule_expression_timezone = "America/Los_Angeles"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = module.reset_function.arn
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ source = "schedule" })

    retry_policy {
      maximum_retry_attempts = 2
    }
  }
}

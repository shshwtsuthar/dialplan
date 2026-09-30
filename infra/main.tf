data "aws_caller_identity" "current" {}

locals {
  # Created by infra/bootstrap. The deploy role may only create IAM roles
  # that carry this boundary, under this path.
  workload_boundary_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/dialplan-workload-boundary"
  workload_role_path    = "/dialplan/workload/"

  lambda_dist = "${path.module}/../api/dist"
  table_arn   = aws_dynamodb_table.main.arn
  table_env   = { TABLE_NAME = aws_dynamodb_table.main.name }
}

# Each function gets exactly the DynamoDB actions its code uses.

module "route_function" {
  source = "./modules/function"

  name                 = "route"
  description          = "POST /v1/route: decide where an inbound call should ring"
  zip_path             = "${local.lambda_dist}/route.zip"
  permissions_boundary = local.workload_boundary_arn
  memory_size          = 1024
  environment          = local.table_env

  policy_statements = [
    { sid = "ReadDialplans", actions = ["dynamodb:GetItem"], resources = [local.table_arn] },
  ]
}

module "rules_function" {
  source = "./modules/function"

  name                 = "rules"
  description          = "Read and edit dialplans, and read their audit log"
  zip_path             = "${local.lambda_dist}/rules.zip"
  permissions_boundary = local.workload_boundary_arn
  environment          = local.table_env

  policy_statements = [
    # PutItem covers both halves of the rules + audit transaction.
    { sid = "ReadWriteDialplans", actions = ["dynamodb:GetItem", "dynamodb:PutItem"], resources = [local.table_arn] },
    { sid = "QueryAuditAndTenants", actions = ["dynamodb:Query"], resources = [local.table_arn, "${local.table_arn}/index/gsi1"] },
  ]
}

module "reset_function" {
  source = "./modules/function"

  name                 = "reset"
  description          = "Restore the demo dialplans and clear their audit logs"
  zip_path             = "${local.lambda_dist}/reset.zip"
  permissions_boundary = local.workload_boundary_arn
  timeout              = 30
  environment          = local.table_env

  policy_statements = [
    {
      sid       = "RestoreDialplans"
      actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query", "dynamodb:BatchWriteItem"]
      resources = [local.table_arn]
    },
  ]
}

# Seed the table on first deploy, and again whenever the seed data changes.
resource "aws_lambda_invocation" "seed" {
  function_name = module.reset_function.function_name
  input         = jsonencode({ source = "deploy" })

  triggers = {
    table = aws_dynamodb_table.main.arn
    seed  = filesha256("${path.module}/../api/src/seed.ts")
  }
}

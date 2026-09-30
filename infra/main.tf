data "aws_caller_identity" "current" {}

locals {
  # Created by infra/bootstrap. The deploy role may only create IAM roles
  # that carry this boundary, under this path.
  workload_boundary_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/dialplan-workload-boundary"

  lambda_dist = "${path.module}/../api/dist"
}

module "route_function" {
  source = "./modules/function"

  name                 = "route"
  description          = "POST /v1/route: decide where an inbound call should ring"
  zip_path             = "${local.lambda_dist}/route.zip"
  permissions_boundary = local.workload_boundary_arn
}

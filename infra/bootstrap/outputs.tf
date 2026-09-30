output "state_bucket" {
  description = "Put this in infra/versions.tf (backend \"s3\" bucket)."
  value       = aws_s3_bucket.state.id
}

output "plan_role_arn" {
  description = "GitHub repository variable AWS_PLAN_ROLE_ARN."
  value       = aws_iam_role.plan.arn
}

output "deploy_role_arn" {
  description = "GitHub repository variable AWS_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.deploy.arn
}

output "workload_boundary_arn" {
  description = "Permissions boundary infra/ must attach to every role it creates."
  value       = aws_iam_policy.workload_boundary.arn
}

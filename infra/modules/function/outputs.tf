output "function_name" {
  value = aws_lambda_function.this.function_name
}

output "arn" {
  value = aws_lambda_function.this.arn
}

output "invoke_arn" {
  value = aws_lambda_function.this.invoke_arn
}

output "policy_json" {
  description = "The role's inline policy, for resources that must wait for it to propagate."
  value       = aws_iam_role_policy.this.policy
}

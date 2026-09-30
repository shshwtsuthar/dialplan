output "api_url" {
  value = aws_apigatewayv2_api.http.api_endpoint
}

output "web_url" {
  value = local.web_url
}

output "amplify_app_id" {
  value = aws_amplify_app.web.id
}

output "amplify_branch" {
  value = aws_amplify_branch.main.branch_name
}

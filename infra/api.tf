locals {
  # Function each route is served by.
  api_routes = {
    "GET /v1/health" = "route"
  }

  api_functions = {
    route = module.route_function
  }
}

resource "aws_apigatewayv2_api" "http" {
  name          = "dialplan-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = concat([local.web_url], var.local_web_origins)
    allow_methods = ["GET", "POST", "PUT"]
    allow_headers = ["content-type"]
    max_age       = 3600
  }
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = "/aws/apigateway/dialplan-api"
  retention_in_days = 14
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = 50
    throttling_burst_limit = 100
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      time             = "$context.requestTime"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      latencyMs        = "$context.responseLatency"
      integrationMs    = "$context.integrationLatency"
      integrationError = "$context.integrationErrorMessage"
      error            = "$context.error.message"
      sourceIp         = "$context.identity.sourceIp"
    })
  }
}

resource "aws_apigatewayv2_integration" "function" {
  for_each = local.api_functions

  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "this" {
  for_each = local.api_routes

  api_id    = aws_apigatewayv2_api.http.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.function[each.value].id}"
}

resource "aws_lambda_permission" "api" {
  for_each = local.api_functions

  statement_id  = "AllowHttpApiInvoke"
  action        = "lambda:InvokeFunction"
  function_name = each.value.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# One table for everything. Access patterns (see api/src/store.ts):
#
#   Route a call           GetItem   pk = DID#<number>, sk = RULES   (consistent read)
#   Read / edit rules      GetItem, then TransactWrite: RULES (version check) + AUDIT
#   Audit log, newest first Query    pk = DID#<number>, sk begins_with AUDIT#
#   A tenant's numbers     Query gsi1 gsi1pk = TENANT#<id>          (sparse: RULES only)

resource "aws_dynamodb_table" "main" {
  name                        = "dialplan-data"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"
  deletion_protection_enabled = true

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "S"
  }

  global_secondary_index {
    name               = "gsi1"
    projection_type    = "INCLUDE"
    non_key_attributes = ["did", "name", "timezone"]

    key_schema {
      attribute_name = "gsi1pk"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "gsi1sk"
      key_type       = "RANGE"
    }
  }

  # Audit entries carry expiresAt; the nightly reset clears them sooner.
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }
}

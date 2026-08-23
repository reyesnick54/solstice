# Provider-neutral network zones. No commercial cloud is assumed.

variable "environment" {
  type = string
}

variable "zones" {
  type    = list(string)
  default = [
    "PUBLIC_EDGE",
    "PUBLIC_RPC",
    "SENTRY",
    "VALIDATOR_PRIVATE",
    "SIGNER_PRIVATE",
    "CUSTODY_PRIVATE",
    "DATA_PRIVATE",
    "OPERATIONS_PRIVATE",
    "OBSERVABILITY",
    "BACKUP",
  ]
}

locals {
  subnets = {
    PUBLIC_EDGE         = { cidr_hint = "10.20.1.0/24", public = true }
    PUBLIC_RPC          = { cidr_hint = "10.20.2.0/24", public = true }
    SENTRY              = { cidr_hint = "10.20.3.0/24", public = false }
    VALIDATOR_PRIVATE   = { cidr_hint = "10.20.4.0/24", public = false }
    SIGNER_PRIVATE      = { cidr_hint = "10.20.5.0/24", public = false }
    CUSTODY_PRIVATE     = { cidr_hint = "10.20.6.0/24", public = false }
    DATA_PRIVATE        = { cidr_hint = "10.20.7.0/24", public = false }
    OPERATIONS_PRIVATE  = { cidr_hint = "10.20.8.0/24", public = false }
    OBSERVABILITY       = { cidr_hint = "10.20.9.0/24", public = false }
    BACKUP              = { cidr_hint = "10.20.10.0/24", public = false }
  }
  firewall_default = "DENY"
}

output "denied_by_default" {
  value = true
}

output "vpc_name" {
  value = "sunrey-${lower(var.environment)}"
}

output "subnets" {
  value = local.subnets
}

output "firewall_default" {
  value = local.firewall_default
}

output "geographic_ha_claimed" {
  value = false
}

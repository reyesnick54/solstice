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

output "denied_by_default" {
  value = true
}

# Public RPC in PUBLIC_RPC. Immutable artifact digest required.

variable "environment" {
  type = string
}

variable "artifact_digest" {
  type = string
}

output "floating_tags_allowed" {
  value = false
}

output "mutates_without_plan" {
  value = false
}

# Exchange services in DATA_PRIVATE. Live trading remains independently gated.

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

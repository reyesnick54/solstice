# Durable event/job/workflow/dead-letter transport. Not process memory.

variable "environment" {
  type = string
}

variable "credential_ref" {
  type = string
}

locals {
  channels = ["events", "jobs", "workflows", "dead-letters"]
  persistent = true
  process_memory_forbidden_for_critical = true
}

output "channels" {
  value = local.channels
}

output "persistent" {
  value = local.persistent
}

output "process_memory_forbidden_for_critical" {
  value = local.process_memory_forbidden_for_critical
}

output "credential_ref" {
  value = var.credential_ref
}

variable "environment" {
  type = string
}

variable "container_digest" {
  type = string
}

output "floating_tags_allowed" {
  value = false
}

output "runtime" {
  value = "kubernetes"
}

output "rolling_update" {
  value = true
}

output "autoscaling_hooks" {
  value = true
}

output "resource_limits_required" {
  value = true
}

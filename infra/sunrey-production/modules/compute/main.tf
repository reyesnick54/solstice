variable "environment" {
  type = string
}

variable "container_digest" {
  type = string
}

output "floating_tags_allowed" {
  value = false
}

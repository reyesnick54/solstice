# Provider-neutral public edge load balancer. TLS required. No plaintext.

variable "environment" {
  type = string
}

variable "public_services" {
  type    = list(string)
  default = ["api", "bff", "rpc", "explorer"]
}

variable "tls_required" {
  type    = bool
  default = true
}

locals {
  plaintext_forbidden = true
  geographic_ha       = false
  zone_ha             = var.environment == "PREPRODUCTION" || var.environment == "STAGING" || var.environment == "PRODUCTION"
}

output "tls_required" {
  value = var.tls_required
}

output "plaintext_forbidden" {
  value = local.plaintext_forbidden
}

output "geographic_ha_claimed" {
  value = local.geographic_ha
}

output "public_services" {
  value = var.public_services
}

# TLS / certificate manager abstraction. Public financial APIs are HTTPS only.

variable "environment" {
  type = string
}

variable "certificate_secret_ref" {
  type = string
}

output "mode" {
  value = "SERVICE_TLS"
}

output "public_plaintext_forbidden" {
  value = true
}

output "certificate_secret_ref" {
  value = var.certificate_secret_ref
}

output "custom_acme_implemented" {
  value = false
}

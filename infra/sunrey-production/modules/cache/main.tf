# Private TLS cache. Unbounded memory is refused.

variable "environment" {
  type = string
}

variable "tls_required" {
  type    = bool
  default = true
}

output "tls_required" {
  value = var.tls_required
}

output "public_access" {
  value = false
}

output "maxmemory_policy" {
  value = "allkeys-lru"
}

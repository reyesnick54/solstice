# DNS abstraction. Final production hosts are not confirmed here.

variable "environment" {
  type = string
}

variable "dns_zone" {
  type    = string
  default = ""
}

locals {
  templates = {
    api      = "api.$${dnsZone}"
    bff      = "app.$${dnsZone}"
    rpc      = "rpc.$${dnsZone}"
    explorer = "explorer.$${dnsZone}"
  }
  future_hosts = ["api.sunrey.xyz"]
  confirmed    = false
}

output "domain_templates" {
  value = local.templates
}

output "future_hosts" {
  value = local.future_hosts
}

output "confirmed_dns" {
  value = local.confirmed
}

output "dns_zone" {
  value = var.dns_zone
}

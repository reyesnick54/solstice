variable "environment" {
  type = string
}

variable "services" {
  type = list(string)
  default = [
    "validator",
    "sentry",
    "rpc",
    "explorer",
    "exchange",
    "custody",
    "oracle_collector",
    "relayer",
    "monitoring",
    "backup",
    "release_service",
  ]
}

output "shared_global_credential" {
  value = false
}

variable "environment" {
  type = string
}

variable "secret_reference_scheme" {
  type    = string
  default = "secret://"
}

output "raw_config_file_secrets" {
  value = false
}

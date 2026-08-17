variable "environment" {
  type = string
}

variable "require_integrity_hash" {
  type    = bool
  default = true
}

output "object_classes" {
  value = ["VERIFIED_SNAPSHOT", "BACKUP", "RELEASE_BUNDLE", "AUDIT_BUNDLE", "DR_ARTIFACT"]
}

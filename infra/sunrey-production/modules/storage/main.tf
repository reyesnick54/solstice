variable "environment" {
  type = string
}

variable "require_integrity_hash" {
  type    = bool
  default = true
}

output "object_classes" {
  value = ["VERIFIED_SNAPSHOT", "BACKUP", "RELEASE_BUNDLE", "AUDIT_BUNDLE", "DR_ARTIFACT", "EVIDENCE", "EXPORTS", "VAULT_OBJECTS"]
}

output "encryption" {
  value = "required"
}

output "public_access" {
  value = false
}

output "versioning" {
  value = true
}

output "retention_days" {
  value = 90
}

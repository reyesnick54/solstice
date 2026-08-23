# Chunk 67 PostgreSQL profile. PRIMARY plus replicas, PITR, TLS, SecretReference credentials.

variable "environment" {
  type = string
}

variable "artifact_digest" {
  type = string
}

output "floating_tags_allowed" {
  value = false
}

output "mutates_without_plan" {
  value = false
}

output "tls_required" {
  value = true
}

output "backup_enabled" {
  value = true
}

output "connection_pooling" {
  value = "pgbouncer"
}

output "roles" {
  value = ["MIGRATOR", "APP_READWRITE", "APP_READONLY", "BACKUP"]
}

output "ha_model" {
  value = var.environment == "LOCAL" || var.environment == "TEST" ? "SINGLE_NODE_REHEARSAL" : "PRIMARY_SYNC_REPLICA"
}

output "migrate_before_incompatible_rollout" {
  value = true
}

output "private_network" {
  value = true
}

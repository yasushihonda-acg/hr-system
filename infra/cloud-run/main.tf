terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = "hr-system-487809"
  region  = "asia-northeast1"
}

# ---------------------------------------------------------------------------
# 1. Cloud Run 用サービスアカウント
# ---------------------------------------------------------------------------

resource "google_service_account" "hr_system_cloud_run" {
  account_id   = "hr-system-cloud-run"
  display_name = "HR System Cloud Run"
  description  = "API / Web / Worker 共通のサービスアカウント"
}

# ---------------------------------------------------------------------------
# 2. IAM ロール付与
# ---------------------------------------------------------------------------

resource "google_project_iam_member" "vertex_ai_user" {
  project = "hr-system-487809"
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.hr_system_cloud_run.email}"
}

resource "google_project_iam_member" "firestore_user" {
  project = "hr-system-487809"
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.hr_system_cloud_run.email}"
}

resource "google_project_iam_member" "chat_service_agent" {
  project = "hr-system-487809"
  role    = "roles/chat.serviceAgent"
  member  = "serviceAccount:${google_service_account.hr_system_cloud_run.email}"
}

resource "google_project_iam_member" "sa_token_creator" {
  project = "hr-system-487809"
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:${google_service_account.hr_system_cloud_run.email}"
}

# ---------------------------------------------------------------------------
# 3. Artifact Registry リポジトリ
# ---------------------------------------------------------------------------

resource "google_artifact_registry_repository" "hr_system" {
  location      = "asia-northeast1"
  repository_id = "hr-system"
  description   = "HR System Docker images"
  format        = "DOCKER"
}

# ---------------------------------------------------------------------------
# 4. Cloud Run サービス (3つ)
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "api" {
  name     = "hr-api"
  location = "asia-northeast1"

  template {
    service_account = google_service_account.hr_system_cloud_run.email

    containers {
      image = "asia-northeast1-docker.pkg.dev/hr-system-487809/hr-system/api:latest"

      ports {
        container_port = 8080
      }

      env {
        name = "CEO_EMAIL"
        value_source {
          secret_key_ref {
            secret  = "ceo-email"
            version = "latest"
          }
        }
      }

      env {
        name = "HR_MANAGER_EMAILS"
        value_source {
          secret_key_ref {
            secret  = "hr-manager-emails"
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service" "web" {
  name     = "hr-web"
  location = "asia-northeast1"

  template {
    service_account = google_service_account.hr_system_cloud_run.email

    containers {
      image = "asia-northeast1-docker.pkg.dev/hr-system-487809/hr-system/web:latest"

      ports {
        container_port = 3000
      }

      env {
        name = "AUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = "auth-secret"
            version = "latest"
          }
        }
      }

      env {
        name = "GOOGLE_CLIENT_ID"
        value_source {
          secret_key_ref {
            secret  = "google-client-id"
            version = "latest"
          }
        }
      }

      env {
        name = "GOOGLE_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = "google-client-secret"
            version = "latest"
          }
        }
      }

      env {
        name  = "API_BASE_URL"
        value = "https://${google_cloud_run_v2_service.api.uri}"
      }
    }
  }
}

variable "worker_url" {
  description = "Worker Cloud Run URL（初回 apply 後に設定）"
  type        = string
  default     = "https://hr-worker-placeholder.run.app"
}

resource "google_cloud_run_v2_service" "worker" {
  name     = "hr-worker"
  location = "asia-northeast1"

  template {
    service_account = google_service_account.hr_system_cloud_run.email

    containers {
      image = "asia-northeast1-docker.pkg.dev/hr-system-487809/hr-system/worker:latest"

      ports {
        container_port = 8080
      }

      env {
        name  = "PUBSUB_SERVICE_ACCOUNT"
        value = google_service_account.hr_system_cloud_run.email
      }

      env {
        name  = "WORKER_URL"
        value = var.worker_url
      }
    }
  }
}

# ---------------------------------------------------------------------------
# 5. Workload Identity Federation (GitHub Actions 認証)
# ---------------------------------------------------------------------------

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions Pool"
  description               = "GitHub Actions 用 Workload Identity Pool"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Actions Provider"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == 'yasushihonda-acg/hr-system'"
}

resource "google_service_account" "github_actions" {
  account_id   = "github-actions"
  display_name = "GitHub Actions"
  description  = "CI/CD パイプライン用サービスアカウント"
}

resource "google_service_account_iam_member" "github_wif_binding" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/yasushihonda-acg/hr-system"
}

resource "google_project_iam_member" "github_ar_writer" {
  project = "hr-system-487809"
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_run_developer" {
  project = "hr-system-487809"
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_sa_user" {
  project = "hr-system-487809"
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "cloud_run_sa_email" {
  description = "Cloud Run サービスアカウントのメールアドレス"
  value       = google_service_account.hr_system_cloud_run.email
}

output "github_actions_sa_email" {
  description = "GitHub Actions サービスアカウントのメールアドレス"
  value       = google_service_account.github_actions.email
}

output "workload_identity_provider" {
  description = "GitHub Actions 用 Workload Identity Provider のリソース名"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "artifact_registry_url" {
  description = "Artifact Registry の Docker リポジトリ URL"
  value       = "asia-northeast1-docker.pkg.dev/hr-system-487809/hr-system"
}

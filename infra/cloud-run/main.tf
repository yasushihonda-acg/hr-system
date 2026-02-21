terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

locals {
  project = "hr-system-487809"
  region  = "asia-northeast1"
}

provider "google" {
  project = local.project
  region  = local.region
}

# ---------------------------------------------------------------------------
# 1. Cloud Run 用サービスアカウント（個別 SA）
#
# NOTE: 本番リソースと同期済み。初回 terraform apply 前に以下を実行:
#   terraform import google_service_account.hr_api \
#     projects/hr-system-487809/serviceAccounts/hr-api@hr-system-487809.iam.gserviceaccount.com
#   terraform import google_service_account.hr_web \
#     projects/hr-system-487809/serviceAccounts/hr-web@hr-system-487809.iam.gserviceaccount.com
#   terraform import google_service_account.hr_worker \
#     projects/hr-system-487809/serviceAccounts/hr-worker@hr-system-487809.iam.gserviceaccount.com
#   terraform import google_service_account.hr_pubsub_push \
#     projects/hr-system-487809/serviceAccounts/hr-pubsub-push@hr-system-487809.iam.gserviceaccount.com
# ---------------------------------------------------------------------------

resource "google_service_account" "hr_api" {
  account_id   = "hr-api"
  display_name = "HR System API"
  description  = "API サーバー用サービスアカウント"
}

resource "google_service_account" "hr_web" {
  account_id   = "hr-web"
  display_name = "HR System Web"
  description  = "Web（Next.js）用サービスアカウント"
}

resource "google_service_account" "hr_worker" {
  account_id   = "hr-worker"
  display_name = "HR System Worker"
  description  = "Chat Worker（Pub/Sub 処理）用サービスアカウント"
}

resource "google_service_account" "hr_pubsub_push" {
  account_id   = "hr-pubsub-push"
  display_name = "HR System Pub/Sub Push"
  description  = "Pub/Sub push サブスクリプション認証用サービスアカウント"
}

# ---------------------------------------------------------------------------
# 2. IAM ロール付与
# ---------------------------------------------------------------------------

# API: Firestore + Secret Manager
resource "google_project_iam_member" "api_firestore" {
  project = local.project
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.hr_api.email}"
}

resource "google_project_iam_member" "api_secret" {
  project = local.project
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.hr_api.email}"
}

# Web: Secret Manager
resource "google_project_iam_member" "web_secret" {
  project = local.project
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.hr_web.email}"
}

# Worker: Firestore + Vertex AI + Secret Manager + Chat Agent
resource "google_project_iam_member" "worker_firestore" {
  project = local.project
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.hr_worker.email}"
}

resource "google_project_iam_member" "worker_vertex_ai" {
  project = local.project
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.hr_worker.email}"
}

resource "google_project_iam_member" "worker_secret" {
  project = local.project
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.hr_worker.email}"
}

resource "google_project_iam_member" "worker_chat_agent" {
  project = local.project
  role    = "roles/chat.serviceAgent"
  member  = "serviceAccount:${google_service_account.hr_worker.email}"
}

# ---------------------------------------------------------------------------
# 3. Artifact Registry リポジトリ
#
# NOTE: terraform import:
#   terraform import google_artifact_registry_repository.hr_system \
#     projects/hr-system-487809/locations/asia-northeast1/repositories/hr-system
# ---------------------------------------------------------------------------

resource "google_artifact_registry_repository" "hr_system" {
  location      = local.region
  repository_id = "hr-system"
  description   = "HR System Docker images"
  format        = "DOCKER"

  # 最新 2 件を保持し、それ以外を自動削除（ストレージコスト抑制）
  cleanup_policies {
    id     = "keep-latest-2"
    action = "KEEP"
    most_recent_versions {
      keep_count = 2
    }
  }

  cleanup_policies {
    id     = "delete-all-others"
    action = "DELETE"
  }

  cleanup_policy_dry_run = false
}

# ---------------------------------------------------------------------------
# 4. Cloud Run サービス (3つ)
#
# NOTE: terraform import:
#   terraform import google_cloud_run_v2_service.api \
#     projects/hr-system-487809/locations/asia-northeast1/services/hr-api
#   terraform import google_cloud_run_v2_service.web \
#     projects/hr-system-487809/locations/asia-northeast1/services/hr-web
#   terraform import google_cloud_run_v2_service.worker \
#     projects/hr-system-487809/locations/asia-northeast1/services/hr-worker
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "api" {
  name     = "hr-api"
  location = local.region

  template {
    service_account = google_service_account.hr_api.email

    containers {
      image = "asia-northeast1-docker.pkg.dev/${local.project}/hr-system/api:latest"

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
  location = local.region

  template {
    service_account = google_service_account.hr_web.email

    containers {
      image = "asia-northeast1-docker.pkg.dev/${local.project}/hr-system/web:latest"

      ports {
        container_port = 8080
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
        # uri には https:// が含まれるためプレフィックス不要
        name  = "API_BASE_URL"
        value = google_cloud_run_v2_service.api.uri
      }
    }
  }
}

resource "google_cloud_run_v2_service" "worker" {
  name     = "hr-worker"
  location = local.region

  template {
    service_account = google_service_account.hr_worker.email

    containers {
      image = "asia-northeast1-docker.pkg.dev/${local.project}/hr-system/worker:latest"

      ports {
        container_port = 8080
      }

      env {
        name  = "PUBSUB_SERVICE_ACCOUNT"
        value = google_service_account.hr_pubsub_push.email
      }
    }
  }
}

# ---------------------------------------------------------------------------
# 5. Workload Identity Federation (GitHub Actions 認証)
#
# NOTE: terraform import:
#   terraform import google_iam_workload_identity_pool.github \
#     projects/hr-system-487809/locations/global/workloadIdentityPools/github-pool
#   terraform import google_iam_workload_identity_pool_provider.github \
#     projects/hr-system-487809/locations/global/workloadIdentityPools/github-pool/providers/github-provider
#   terraform import google_service_account.github_actions \
#     projects/hr-system-487809/serviceAccounts/github-actions@hr-system-487809.iam.gserviceaccount.com
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
  project = local.project
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_run_developer" {
  project = local.project
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_sa_user" {
  project = local.project
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "hr_api_sa_email" {
  description = "API サービスアカウントのメールアドレス"
  value       = google_service_account.hr_api.email
}

output "hr_web_sa_email" {
  description = "Web サービスアカウントのメールアドレス"
  value       = google_service_account.hr_web.email
}

output "hr_worker_sa_email" {
  description = "Worker サービスアカウントのメールアドレス"
  value       = google_service_account.hr_worker.email
}

output "hr_pubsub_push_sa_email" {
  description = "Pub/Sub Push サービスアカウントのメールアドレス"
  value       = google_service_account.hr_pubsub_push.email
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
  value       = "asia-northeast1-docker.pkg.dev/${local.project}/hr-system"
}

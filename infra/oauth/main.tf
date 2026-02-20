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

# OAuth 同意画面ブランド（IAP ブランド = OAuth consent screen）
resource "google_iap_brand" "hr_system" {
  support_email     = "yasushi.honda@aozora-cg.com"
  application_title = "HR-AI Agent Dashboard"
  project           = "hr-system-487809"
}

# OAuth 2.0 クライアント（Web Application 用）
resource "google_iap_client" "hr_dashboard" {
  display_name = "hr-dashboard"
  brand        = google_iap_brand.hr_system.name
}

output "client_id" {
  value     = google_iap_client.hr_dashboard.client_id
  sensitive = false
}

output "client_secret" {
  value     = google_iap_client.hr_dashboard.secret
  sensitive = true
}

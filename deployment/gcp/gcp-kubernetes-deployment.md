# GCP Kubernetes Deployment Guide

## Overview

This guide provides a comprehensive approach to deploying microservices on Google Cloud Platform (GCP) using Kubernetes. It covers authentication, API gateway, storage, secrets management, and database deployment.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GCP Project                                      │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        VPC Network                                    │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │                    GKE Cluster (Private)                       │   │   │
│  │  │                                                                │   │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │   │
│  │  │  │  API Gateway │  │  Auth Server │  │ Microservices│        │   │   │
│  │  │  │  (Istio/GKE) │  │  (Keycloak)  │  │  (Spring Boot)│        │   │   │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │   │   │
│  │  │         │                  │                  │                │   │   │
│  │  │  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐        │   │   │
│  │  │  │ Service A    │  │ Service B    │  │ Service C    │        │   │   │
│  │  │  │ (Pods)       │  │ (Pods)       │  │ (Pods)       │        │   │   │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘        │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                              │                                          │   │
│  │  ┌───────────────────────────▼────────────────────────────────────┐     │   │
│  │  │                   Cloud SQL (PostgreSQL)                       │     │   │
│  │  │                   - Primary Instance                           │     │   │
│  │  │                   - Read Replicas                              │     │   │
│  │  └────────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     GCP Services                                      │   │
│  │                                                                        │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │   │
│  │  │  Cloud Storage   │  │  Secret Manager  │  │  Cloud Pub/Sub   │    │   │
│  │  │  (Buckets)       │  │  (API Keys)      │  │  (Event Bus)     │    │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘    │   │
│  │                                                                        │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │   │
│  │  │  Cloud Load      │  │  Cloud Armor    │  │  Cloud CDN       │    │   │
│  │  │  Balancing       │  │  (WAF/DDoS)      │  │  (Static Assets) │    │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘    │   │
│  │                                                                        │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │   │
│  │  │  Cloud Logging   │  │  Cloud Monitoring │  │  Cloud Build     │    │   │
│  │  │  (Logs)          │  │  (Metrics)       │  │  (CI/CD)         │    │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Service Selection Matrix

| Component | GCP Service | Alternative | Selection Criteria |
|-----------|-------------|-------------|-------------------|
| **Kubernetes** | GKE (Google Kubernetes Engine) | Anthos GKE, Self-managed | Managed, auto-upgrade, integrated services |
| **API Gateway** | API Gateway + Cloud Run | Istio Ingress, NGINX Ingress | Managed, serverless, pay-per-use |
| **Authentication** | Cloud Identity Platform | Auth0, Keycloak on GKE | Managed, integrated with GCP IAM |
| **Database** | Cloud SQL | Cloud Spanner, AlloyDB | Managed PostgreSQL/MySQL, backups, HA |
| **Storage** | Cloud Storage | Persistent Disks, Filestore | Object storage, scalable, CDN integration |
| **Secrets** | Secret Manager | KMS, HashiCorp Vault | Managed, IAM integration, versioning |
| **Message Queue** | Cloud Pub/Sub | Cloud Tasks, Kafka | Scalable, pub/sub pattern |
| **Logging** | Cloud Logging | ELK Stack on GKE | Native integration, query capabilities |
| **Monitoring** | Cloud Monitoring | Prometheus + Grafana | Native integration, alerting |
| **CI/CD** | Cloud Build + Cloud Deploy | GitHub Actions, GitLab CI | Native integration, triggers |

## 1. GKE (Google Kubernetes Engine) Setup

### 1.1 Project Setup

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable container.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable iam.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 1.2 Create GKE Cluster

```bash
# Create a private GKE cluster
gcloud container clusters create book-town-cluster \
  --project=YOUR_PROJECT_ID \
  --region=us-central1 \
  --num-nodes=3 \
  --machine-type=e2-medium \
  --enable-private-nodes \
  --enable-private-endpoint \
  --master-ipv4-cidr=10.0.0.0/28 \
  --enable-ip-alias \
  --create-subnetwork="" \
  --network=book-town-vpc \
  --subnetwork=book-town-subnet \
  --enable-autoscaling \
  --min-nodes=2 \
  --max-nodes=10 \
  --enable-autorepair \
  --enable-auto-upgrade \
  --enable-vertical-pod-autoscaling \
  --workload-pool=YOUR_PROJECT_ID.svc.id.goog
```

### 1.3 Configure Node Pools

```bash
# Create a node pool for stateless services
gcloud container node-pools create stateless-pool \
  --cluster=book-town-cluster \
  --region=us-central1 \
  --machine-type=e2-standard-4 \
  --num-nodes=2 \
  --enable-autoscaling \
  --min-nodes=2 \
  --max-nodes=8 \
  --node-labels=workload=stateless

# Create a node pool for stateful services
gcloud container node-pools create stateful-pool \
  --cluster=book-town-cluster \
  --region=us-central1 \
  --machine-type=e2-highmem-4 \
  --num-nodes=2 \
  --enable-autoscaling \
  --min-nodes=2 \
  --max-nodes=4 \
  --node-labels=workload=stateful
```

### 1.4 Configure Workload Identity

```bash
# Create IAM service account
gcloud iam service-accounts create book-town-sa \
  --display-name="Book Town Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:book-town-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:book-town-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:book-town-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Configure Workload Identity
gcloud iam service-accounts add-iam-policy-binding \
  book-town-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="serviceAccount:YOUR_PROJECT_ID.svc.id.goog[default/book-town-sa]"

# Annotate Kubernetes service account
kubectl annotate serviceaccount book-town-sa \
  iam.gke.io/gcp-service-account=book-town-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## 2. Authentication Server Setup

### 2.1 Option 1: Cloud Identity Platform (Recommended)

```bash
# Enable Cloud Identity Platform
gcloud services enable identitytoolkit.googleapis.com

# Configure identity platform
gcloud auth application-default login
```

**Configuration Example:**

```yaml
# application.yml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://securetoken.google.com/YOUR_PROJECT_ID
google:
  cloud:
    project-id: YOUR_PROJECT_ID
    firebase:
      database-url: https://YOUR_PROJECT_ID.firebaseio.com
```

### 2.2 Option 2: Keycloak on GKE

```yaml
# keycloak-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: keycloak
  namespace: auth
spec:
  replicas: 2
  selector:
    matchLabels:
      app: keycloak
  template:
    metadata:
      labels:
        app: keycloak
    spec:
      containers:
      - name: keycloak
        image: quay.io/keycloak/keycloak:latest
        ports:
        - containerPort: 8080
        env:
        - name: KEYCLOAK_ADMIN
          valueFrom:
            secretKeyRef:
              name: keycloak-secrets
              key: admin-user
        - name: KEYCLOAK_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: keycloak-secrets
              key: admin-password
        - name: DB_VENDOR
          value: postgres
        - name: DB_ADDR
          value: keycloak-db
        - name: DB_DATABASE
          value: keycloak
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: keycloak-db-secrets
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: keycloak-db-secrets
              key: password
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: keycloak
  namespace: auth
spec:
  selector:
    app: keycloak
  ports:
  - port: 8080
    targetPort: 8080
  type: LoadBalancer
```

## 3. API Gateway Setup

### 3.1 Option 1: GCP API Gateway (Recommended)

```bash
# Enable API Gateway
gcloud services enable apigateway.googleapis.com

# Create API config
gcloud api-gateway api-configs create book-town-config \
  --api=book-town-api \
  --project=YOUR_PROJECT_ID \
  --location=us-central1 \
  --grpc-methods-config=api-config.yaml
```

### 3.2 Option 2: Istio Ingress Gateway

```yaml
# istio-gateway.yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: book-town-gateway
  namespace: istio-system
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: book-town-cert
    hosts:
    - api.book-town.com
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: book-town-vs
  namespace: default
spec:
  hosts:
  - api.book-town.com
  gateways:
  - istio-system/book-town-gateway
  http:
  - match:
    - uri:
        prefix: /v1/orders
    route:
    - destination:
        host: order-service
        port:
          number: 8080
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
```

## 4. Cloud Storage Setup

### 4.1 Create Storage Buckets

```bash
# Create bucket for static assets
gsutil mb -p YOUR_PROJECT_ID -l us-central1 \
  -b on -r us-central1 \
  gs://book-town-static-assets

# Create bucket for user uploads
gsutil mb -p YOUR_PROJECT_ID -l us-central1 \
  -b on -r us-central1 \
  gs://book-town-uploads

# Create bucket for backups
gsutil mb -p YOUR_PROJECT_ID -l us-central1 \
  -b on -r us-central1 \
  --lifecycle \
  gs://book-town-backups
```

### 4.2 Configure Bucket Lifecycle

```json
// lifecycle.json
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 30,
          "matchesStorageClass": ["NEARLINE"]
        }
      },
      {
        "action": {
          "type": "SetStorageClass",
          "storageClass": "NEARLINE"
        },
        "condition": {
          "age": 90
        }
      }
    ]
  }
}
```

## 5. Secret Management

### 5.1 Enable Secret Manager

```bash
gcloud services enable secretmanager.googleapis.com
```

### 5.2 Create Secrets

```bash
# Create database password secret
echo -n "your-db-password" | gcloud secrets create db-password \
  --data-file=- \
  --replication-policy=automatic

# Create API key secret
echo -n "your-api-key" | gcloud secrets create external-api-key \
  --data-file=- \
  --replication-policy=automatic
```

### 5.3 Access Secrets in Kubernetes

```yaml
# secret-manager-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: default
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: gcp-secret-store
    kind: SecretStore
  target:
    name: db-credentials
    creationPolicy: Owner
  data:
  - secretKey: password
    remoteRef:
      key: db-password
  - secretKey: username
    remoteRef:
      key: db-username
```

## 6. Database Deployment (Cloud SQL)

### 6.1 Create Cloud SQL Instance

```bash
# Create PostgreSQL instance
gcloud sql instances create book-town-db \
  --project=YOUR_PROJECT_ID \
  --database-version=POSTGRES_14 \
  --tier=db-custom-2-3840 \
  --cpu=2 \
  --memory=3840MB \
  --region=us-central1 \
  --storage-size=100GB \
  --storage-auto-increase \
  --storage-auto-increase-limit=500GB \
  --availability-type=REGIONAL \
  --backup-start-time=03:00 \
  --backup-retention-days=7 \
  --enable-bin-log \
  --database-flags=cloudsql.iam_authentication=on,max_connections=200
```

### 6.2 Create Read Replicas

```bash
# Create read replica
gcloud sql instances create book-town-db-replica \
  --project=YOUR_PROJECT_ID \
  --master-instance-name=book-town-db \
  --tier=db-custom-2-3840 \
  --cpu=2 \
  --memory=3840MB \
  --region=us-central1 \
  --availability-type=REGIONAL
```

## 7. CI/CD with Cloud Build

### 7.1 Cloud Build Configuration

```yaml
# cloudbuild.yaml
steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
    - 'build'
    - '-t'
    - 'gcr.io/$PROJECT_ID/order-service:$SHORT_SHA'
    - '-t'
    - 'gcr.io/$PROJECT_ID/order-service:latest'
    - '.'

  # Push Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
    - 'push'
    - 'gcr.io/$PROJECT_ID/order-service:$SHORT_SHA'

  # Deploy to GKE
  - name: 'gcr.io/cloud-builders/gke-deploy'
    args:
    - 'run'
    - '--filename=k8s/'
    - '--image=gcr.io/$PROJECT_ID/order-service:$SHORT_SHA'
    - '--location=us-central1'
    - '--cluster=book-town-cluster'
```

## Further Reading

- **GKE Documentation:** https://cloud.google.com/kubernetes-engine/docs
- **Cloud SQL Documentation:** https://cloud.google.com/sql/docs
- **Secret Manager Documentation:** https://cloud.google.com/secret-manager/docs

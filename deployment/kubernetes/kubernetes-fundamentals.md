# Kubernetes Fundamentals

## Cluster Hierarchy

```text
┌───────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                     │
│                                                           │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  │
│  │      Worker Node 1       │  │      Worker Node 2       │  │
│  │                          │  │                          │  │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │  │
│  │  │       Pod A        │  │  │  │       Pod C        │  │  │
│  │  │ ┌────────────────┐ │  │  │  │ ┌────────────────┐ │  │  │
│  │  │ │  Container 1   │ │  │  │  │ │  Container 3   │ │  │  │
│  │  │ └────────────────┘ │  │  │  │ └────────────────┘ │  │  │
│  │  └────────────────────┘  │  │  └────────────────────┘  │  │
│  │                          │  │                          │  │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │  │
│  │  │       Pod B        │  │  │  │       Pod D        │  │  │
│  │  │ ┌────────────────┐ │  │  │  │ ┌────────────────┐ │  │  │
│  │  │ │  Container 2   │ │  │  │  │ │  Container 4   │ │  │  │
│  │  │ └────────────────┘ │  │  │  │ └────────────────┘ │  │  │
│  │  └────────────────────┘  │  │  └────────────────────┘  │  │
│  └──────────────────────────┘  └──────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

Kubernetes (K8s) is an open-source system for automating deployment, scaling, and management of containerized applications.

## Key Components

- **Pod:** The smallest deployable unit.
- **Service:** An abstract way to expose an application running on a set of Pods.
- **Deployment:** Provides declarative updates for Pods and ReplicaSets.
- **Ingress:** Manages external access to services, typically HTTP.
- **ConfigMap & Secret:** Manage configuration data and sensitive information.

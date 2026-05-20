# Frontend Architecture Guide

## Big Picture

```
Users (Browser / Mobile)
        │
        ▼
┌───────────────────────────────────────────────┐
│  CDN (Content Delivery Network)               │
│  Serves React/Angular/Vue static files        │
│  from nearest edge location globally          │
└───────────────────┬───────────────────────────┘
                    │ user interacts, makes API calls
                    ▼
┌───────────────────────────────────────────────┐
│  API Gateway                                  │
│  Single entry point for all backend calls     │
│  Handles auth, CORS, routing, rate limiting   │
└───────────────────┬───────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────┐
│  Backend Services (Kubernetes)                │
│  Book Service, Order Service, User Service    │
└───────────────────────────────────────────────┘
```

## What is a Frontend App?

```
Traditional web (old):
  Server renders HTML → sends full page → browser displays it
  Every click → new request → new full page load

Modern SPA (Single Page Application):
  Server sends ONE HTML file + JS bundle → browser runs the app
  Every click → JavaScript updates the page (no full reload)
  API calls fetch only DATA (JSON), not HTML

Frameworks:
├── React     ← most popular, component-based
├── Angular   ← enterprise-heavy, full framework
└── Vue       ← lighter, easier learning curve
```

## How a React App Gets to the User

```
Developer writes React code (.jsx / .tsx)
        │
        ▼
npm run build
        │ compiles + bundles everything
        ▼
/dist or /build folder:
├── index.html      ← one HTML file
├── main.js         ← all your JavaScript bundled
├── styles.css      ← all your styles
└── assets/         ← images, fonts

These are STATIC FILES — no server logic, just files
        │
        ▼
Upload to CDN / Object Storage
        │
        ▼
CDN serves files from nearest edge node to user
```

## CDN — Why It Matters

```
Without CDN:
User in Tokyo → request → your server in US East → response
Latency: 200ms+ 😬

With CDN:
User in Tokyo → request → CDN edge node in Tokyo → response
Latency: 5ms ✅

CDN caches your static files globally:
├── North America edge nodes
├── Europe edge nodes
├── Asia edge nodes
└── South America edge nodes
```

## Deployment Patterns

### Pattern 1 — Static Files on CDN (Recommended)

```
React build output (HTML/CSS/JS)
        │
        ▼
Object Storage (vendor-neutral: S3, Blob, GCS)
        │
        ▼
CDN layer sits in front
        │
        ▼
Users get files from nearest edge ✅

Cost:    very cheap (pennies per GB)
Scale:   infinite (CDN handles it)
Servers: zero needed for frontend ✅
```

### Pattern 2 — Frontend Container in Kubernetes

```
React build output
        │
        ▼
Nginx container serves the static files
        │
        ▼
Kubernetes Deployment (just like your backend)
        │
        ▼
Exposed via Ingress Controller

Use when:
→ Need server-side rendering (Next.js, Nuxt)
→ Everything must live inside the cluster
→ Complex routing logic at server level
```

### Pattern 3 — Server-Side Rendering (SSR)

```
Next.js / Nuxt.js runs on a server
        │
        ▼
Server renders HTML per request (better SEO)
        │
        ▼
Browser receives ready-to-display HTML
        │
        ▼
JavaScript hydrates → becomes interactive SPA

Use when:
→ SEO is critical (e-commerce, public content)
→ First page load speed is critical
→ Social media previews must work
```

## How Frontend Talks to Backend

```
React (running in browser)
        │
        │ HTTP fetch / axios
        ▼
API Gateway  ←── single endpoint your frontend knows about
        │
        ├── /api/books   → Book Service
        ├── /api/orders  → Order Service
        └── /api/users   → User Service
```

```javascript
// React — calling your BookTown API
const getBooks = async () => {
    const response = await fetch('https://api.booktown.com/books', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    return response.json();
};
```

## CORS — The Cross-Origin Problem

```
Frontend lives at:  https://booktown.com
Backend lives at:   https://api.booktown.com

Browser security rule:
"A page at domain A cannot call domain B without permission"

Without CORS config:
fetch('https://api.booktown.com/books') → ❌ blocked by browser

Solution — API Gateway adds CORS headers to every response:
Access-Control-Allow-Origin: https://booktown.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
```

```
CORS is enforced by the BROWSER — not the server
Server just declares who is allowed
API Gateway is the right place to configure it (once, for all services) ✅
```

## Authentication Flow — Frontend + Backend

```
1. User logs in on React UI
        │
        ▼
2. POST /api/auth/login  {username, password}
        │
        ▼
3. Auth Service validates credentials
        │
        ▼
4. Returns JWT token
        │
        ▼
5. React stores token (memory or httpOnly cookie)
        │
        ▼
6. Every subsequent request:
   GET /api/books
   Authorization: Bearer <jwt-token>
        │
        ▼
7. API Gateway validates JWT
        │ valid → forward request
        │ invalid → 401 Unauthorized
        ▼
8. Backend service receives request
   (no auth logic needed — gateway handled it ✅)
```

## CI/CD — How Code Reaches Production

```
Developer pushes to GitHub
        │
        ├── Frontend pipeline:
        │   ├── npm install
        │   ├── npm test
        │   ├── npm run build
        │   └── upload /dist to CDN storage
        │       CDN cache invalidated → users get new version ✅
        │
        └── Backend pipeline:
            ├── ./gradlew test
            ├── ./gradlew build
            ├── docker build + push to registry
            └── kubectl apply → Kubernetes rolling update ✅
```

## Environment Configuration

```
Frontend needs to know backend URL per environment:

Development:   REACT_APP_API_URL=http://localhost:8080
Staging:       REACT_APP_API_URL=https://staging-api.booktown.com
Production:    REACT_APP_API_URL=https://api.booktown.com

// React reads from environment at build time
const API_URL = process.env.REACT_APP_API_URL;
```

## Full Abstract Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS                                    │
└──────────────────┬──────────────────┬───────────────────┘
                   │                  │
                   ▼                  ▼
        ┌──────────────────┐      ┌───────────────────────┐
        │       CDN        │      │    DNS / Load Balancer │
        │  Static Files    │      │    (routes /api/*)     │
        │  React App       │      └───────────┬───────────┘
        │  HTML/CSS/JS     │                  │
        └──────────────────┘                  ▼
                   │                 ┌──────────────────┐
                   │ API calls       │   API Gateway    │
                   └────────────────►│   Auth / CORS    │
                                     │   Rate Limiting  │
                                     └────────┬─────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                        Book Service    Order Service   User Service
                              │               │               │
                              └───────────────┼───────────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                           SQL DB         NoSQL DB        Cache
                        (relational)   (documents)      (Redis)
```

## Technology Choices (Vendor-Neutral)

```
Layer               Options
────────────────────────────────────────────────────────────────
Frontend Framework  React, Angular, Vue, Svelte
SSR Framework       Next.js (React), Nuxt (Vue), Angular Universal
Object Storage      AWS S3, Azure Blob, GCP Cloud Storage, MinIO
CDN                 Cloudflare, AWS CloudFront, Azure Front Door, Fastly
API Gateway         Kong, AWS API GW, Azure APIM, Spring Cloud Gateway
Auth                Auth0, Keycloak, AWS Cognito, Azure AD B2C
Container Registry  Docker Hub, AWS ECR, Azure ACR, GCP Artifact Registry
Kubernetes          AKS (Azure), EKS (AWS), GKE (GCP), self-hosted
```

## Summary — Key Decisions

```
Static SPA (React/Vue/Angular)
→ Build → CDN → zero servers needed for UI ✅

Server-Side Rendering (Next.js)
→ Build → Container → Kubernetes ✅

API calls always go through API Gateway
→ single URL frontend needs to know ✅

JWT auth validated at Gateway
→ backend services stay clean ✅

CORS configured at Gateway
→ not repeated in every service ✅
```

## Further Reading

- **React Documentation:** https://react.dev/
- **Next.js Documentation:** https://nextjs.org/docs
- **MDN Web Docs:** https://developer.mozilla.org/

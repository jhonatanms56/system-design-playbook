# OAuth2 and JWT Authentication Guide

## Big Picture

```
User
  │
  │ 1. Login (credentials)
  ▼
Identity Provider (Auth Server)
  │
  │ 2. Returns JWT token
  ▼
User stores token
  │
  │ 3. Every request carries token
  ▼
API Gateway
  │ validates token
  │ extracts user identity
  ▼
Microservices (trust the gateway)
  │
  ▼
Database (encrypted at rest)

Rule: Authenticate ONCE at the edge, trust inside the cluster
```

## 1. Authentication vs Authorization

```
Authentication  → WHO are you?        (identity)
Authorization   → WHAT can you do?    (permissions)

Authentication:
"I am John, here is my password" → verified ✅

Authorization:
"John wants to DELETE a book" → is John an ADMIN? 
Yes → allowed ✅
No  → 403 Forbidden ❌
```

## 2. JWT — JSON Web Token

A self-contained token that proves who you are and what you can do.

### Structure — 3 parts separated by dots

```
eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.signature

Header.Payload.Signature
```

### Header — algorithm used

```json
{
  "alg": "RS256",
  "typ": "JWT"
}
```

### Payload — the claims (user data)

```json
{
  "sub": "user123",           // subject (user id)
  "name": "John Doe",
  "email": "john@example.com",
  "roles": ["USER", "ADMIN"],
  "iat": 1716300000,          // issued at (timestamp)
  "exp": 1716386400           // expiration (timestamp)
}
```

### Signature — tamper protection

```
HMAC_SHA256(
  base64(header) + "." + base64(payload),
  secret_key
)

If payload is modified → signature won't match → rejected ✅
```

### JWT is NOT encrypted — it's encoded!

```
base64 is reversible — anyone can read the payload
Never put sensitive data (passwords, card numbers) in JWT ❌

JWT guarantees:
✅ the token was issued by YOUR auth server (signature)
✅ the token hasn't been tampered with (signature)
✅ the token hasn't expired (exp claim)
❌ the content is NOT secret (base64 is readable)
```

## 3. OAuth2 — The Authorization Framework

OAuth2 is a protocol that lets users grant apps access to their data WITHOUT sharing their password.

### The Four Roles

```
Resource Owner   → the user (owns the data)
Client           → your React app (wants access)
Authorization Server → the identity provider (issues tokens)
Resource Server  → your API (protected resource)
```

### Common Grant Types

#### Authorization Code Flow (most secure — for web/mobile apps)

```
1. User clicks "Login with Google"
2. Browser redirects to Google login page
3. User logs in at Google (your app never sees password ✅)
4. Google redirects back with authorization CODE
5. Your backend exchanges code for ACCESS TOKEN + REFRESH TOKEN
6. Access token used for API calls
```

```
React App → redirect → Google Auth Server
                              │ user logs in
                              ▼
React App ← redirect ← authorization code
    │
    │ POST /token  (code + client_secret)
    ▼
Auth Server → ACCESS TOKEN + REFRESH TOKEN
    │
    ▼
React stores tokens, uses access token for API calls
```

#### Client Credentials Flow (service-to-service)

```
No user involved — machine to machine

Book Service → POST /token (client_id + client_secret)
            ← ACCESS TOKEN

Book Service → GET /orders (Authorization: Bearer token)
Order Service validates token → serves response ✅
```

### Token Types

```
Access Token   → short-lived (15 min - 1 hour)
                 used for API calls
                 if stolen → expires quickly

Refresh Token  → long-lived (days/weeks)
                 used ONLY to get new access tokens
                 stored securely, never sent to APIs
                 if stolen → revocable at auth server
```

```
Access token expires:
Client → POST /token (refresh_token)
       ← new access token ✅
No need to login again ✅
```

## 4. The Full Auth Flow in Your Architecture

```
1. User opens React app (not logged in)

2. React redirects to Auth Server login page
   GET https://auth.booktown.com/login

3. User enters credentials at Auth Server
   (React NEVER sees password ✅)

4. Auth Server validates, issues tokens
   access_token: eyJ...  (expires in 1h)
   refresh_token: abc...  (expires in 30d)

5. React stores tokens
   access_token  → memory (safest) or sessionStorage
   refresh_token → httpOnly cookie (JS can't read it ✅)

6. React calls API
   GET /api/books
   Authorization: Bearer eyJ...

7. API Gateway receives request
   ├── decode JWT (base64)
   ├── verify signature (public key from Auth Server)
   ├── check expiration (exp claim)
   ├── extract roles (roles claim)
   └── forward to Book Service with user context header:
       X-User-Id: user123
       X-User-Roles: USER,ADMIN

8. Book Service receives request
   ├── trusts API Gateway ✅ (no re-validation needed)
   └── checks X-User-Roles for authorization
```

## 5. Securing APIs — Layers of Defense

### Layer 1 — Transport Security (HTTPS / TLS)

```
HTTP  → data travels in plain text → anyone can intercept 💥
HTTPS → data encrypted in transit → intercepted = unreadable ✅

TLS (Transport Layer Security):
├── encrypts data between client and server
├── verifies server identity (certificate)
└── prevents man-in-the-middle attacks

Always use HTTPS in production — no exceptions ✅
```

### Layer 2 — Authentication (JWT at API Gateway)

```
Every request must have a valid token
Invalid/missing token → 401 Unauthorized
Expired token → 401 Unauthorized
```

### Layer 3 — Authorization (Roles & Scopes)

```
Role-based:
USER  → can read books
ADMIN → can create, update, delete books

@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<Book> delete(@PathVariable Long id) { ... }

Scope-based (OAuth2):
books:read  → GET /books
books:write → POST, PUT, DELETE /books
```

### Layer 4 — Rate Limiting (at API Gateway)

```
Prevent abuse:
Free tier:   100 requests/minute
Pro tier:    1000 requests/minute
Over limit → 429 Too Many Requests
```

### Layer 5 — Input Validation (at Service layer)

```
Never trust client input:
├── validate all fields (@Valid, @NotNull, @Size)
├── sanitize strings (prevent SQL injection)
├── validate content type
└── reject unexpected fields
```

## 6. Service-to-Service Security

```
Inside the cluster — two options:

Option 1: Mutual TLS (mTLS)
Both services present certificates
Each verifies the other's identity
"I am Book Service, prove you are Order Service"
→ used by service meshes (Istio) ✅

Option 2: JWT (Client Credentials)
Service A gets a token from Auth Server
Sends it to Service B
Service B validates token
→ simpler, no service mesh needed
```

## 7. Data Encryption

### Encryption in Transit (TLS/HTTPS)

```
Data moving between systems → always encrypted
Client → API Gateway:           HTTPS ✅
API Gateway → Microservice:     HTTPS ✅ (even inside cluster)
Microservice → Database:        TLS ✅
```

### Encryption at Rest

```
Data stored on disk → encrypted

Database encryption:
→ Transparent Data Encryption (TDE) — DB engine handles it
→ Your app reads/writes normally, disk is encrypted ✅

File/blob storage:
→ AES-256 encryption standard
→ Cloud providers handle it by default ✅

Backups:
→ Must also be encrypted ✅
```

### Password Hashing

```
Passwords — NEVER stored, only hashed
BCrypt:
"password123" → "$2a$12$xyz..." ← stored in DB
Login attempt: "password123" → hash → compare → match ✅
DB compromised → hashes useless without brute force ✅
```

### Secrets Management

```
Never hardcode secrets in code or config files ❌
git push → secret exposed to everyone with repo access 💥

Use a secrets manager:
├── HashiCorp Vault       ← open source, vendor-neutral
├── AWS Secrets Manager
├── Azure Key Vault
└── GCP Secret Manager

Application starts → fetches secrets at runtime ✅
Secret rotated → app gets new value automatically ✅
No secret in code, config, or Docker image ✅
```

## 8. Spring Security — Quick Reference

```java
// Dependency
implementation 'org.springframework.boot:spring-boot-starter-security'
implementation 'org.springframework.boot:spring-boot-starter-oauth2-resource-server'

// Config
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())              // REST APIs don't need CSRF
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(GET, "/books/**").permitAll()        // public
                .requestMatchers(POST, "/books/**").hasRole("ADMIN")  // protected
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(Customizer.withDefaults()))       // validate JWT tokens
            .build();
    }
}

// Method-level authorization
@DeleteMapping("/{id}")
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<Void> delete(@PathVariable Long id) { ... }
```

## Security Checklist

```
Transport:
✅ HTTPS everywhere (TLS)
✅ Valid certificates (auto-renewed)

Authentication:
✅ OAuth2 + JWT
✅ Short-lived access tokens (1h)
✅ Refresh tokens in httpOnly cookies
✅ Auth server validates credentials (not your app)

Authorization:
✅ Role/scope-based at API Gateway
✅ Method-level in services (@PreAuthorize)
✅ Verify resource ownership

Data:
✅ Encryption at rest (TDE)
✅ Encryption in transit (TLS)
✅ Passwords hashed (BCrypt)
✅ Secrets in vault, never in code
✅ PII never in logs or URLs

Network:
✅ Rate limiting at API Gateway
✅ Network policies in Kubernetes
✅ mTLS between services (Istio)
✅ Input validation at service layer
```

## Further Reading

- **OAuth 2.0 Specification:** https://oauth.net/2/
- **JWT.io:** https://jwt.io/
- **Spring Security Reference:** https://docs.spring.io/spring-security/reference/

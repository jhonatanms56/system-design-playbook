# Request Lifecycle

Understanding the end-to-end journey of a request is crucial for identifying bottlenecks, ensuring security, and maintaining high availability.

## The Path of a Request

```text
      ┌─────────────┐
      │   Client    │
      └──────┬──────┘
             │
   1. DNS    │    2. HTTP
   Lookup    │    Request
 ┌───────────┴───────────┐
 ▼                       ▼
┌─────────────┐ ┌─────────────┐
│ DNS Server  │ │ CDN / Edge  │
└─────────────┘ └──────┬──────┘
                       │
                       │ 3. Forward
                       ▼
                ┌─────────────┐
                │Load Balancer│
                └──────┬──────┘
                       │
                       │ 4. Route
                       ▼
                ┌─────────────┐
                │ API Gateway │
                └──────┬──────┘
                       │
                       │ 5. Process
                       ▼
                ┌─────────────┐
                │   Backend   │
                │   Service   │
                └──────┬──────┘
                       │
                       │ 6. Query
                       ▼
                ┌─────────────┐
                │  Database/  │
                │    Cache    │
                └─────────────┘
```

1. **DNS Lookup:** Resolving the domain name to an IP address.
2. **CDN / Edge:** Serving static content or terminating SSL at the edge.
3. **Load Balancer:** Distributing incoming traffic across multiple backend servers.
4. **API Gateway:** Handling authentication, rate limiting, and request routing.
5. **Backend Service:** Executing business logic.
6. **Database / Cache:** Retrieving or persisting data.
7. **Response Path:** Sending the response back through the same layers.

## Key Metrics at Each Stage

- **Network Latency:** Time taken to transmit data between nodes.
- **Processing Time:** Time spent executing logic on a server.
- **Wait Time:** Time spent waiting for external resources (DB, third-party APIs).

## Common Bottlenecks

- Slow DNS resolution.
- Unoptimized SSL handshakes.
- Large payload sizes.
- Sub-optimal database queries.
- Thread exhaustion in backend services.

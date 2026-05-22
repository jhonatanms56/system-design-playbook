# Caching Strategies

Caching is one of the most effective ways to improve system performance and reduce load on backend resources.

## Caching Patterns

- **Cache-Aside:** Application checks cache first, if miss, reads from DB and updates cache.
- **Read-Through:** Application reads from cache, cache handles reading from DB on miss.
- **Write-Through:** Data is written to cache and DB simultaneously.
- **Write-Behind (Write-Back):** Data is written to cache, then asynchronously to DB.

## Multi-Level Caching

- **Browser Cache**
- **CDN Cache**
- **Reverse Proxy Cache (e.g., Varnish, Nginx)**
- **Application Cache (In-memory)**
- **Distributed Cache (e.g., Redis, Memcached)**

# Redis Fundamentals

Redis (Remote Dictionary Server) is an open-source, in-memory data structure store, used as a distributed, in-memory key–value database, cache, and message broker.

## Key Features
- **In-Memory:** High performance with sub-millisecond latency.
- **Data Structures:** Supports strings, hashes, lists, sets, sorted sets with range queries, bitmaps, hyperloglogs, geospatial indexes, and streams.
- **Persistence:** Offers RDB (point-in-time snapshots) and AOF (append-only file) for data durability.
- **High Availability:** Redis Sentinel and Redis Cluster provide automatic failover and sharding.

## Common Use Cases
1. **Caching:** Reducing database load by storing frequently accessed data.
2. **Session Management:** Storing user session data in a fast, volatile store.
3. **Real-time Analytics:** Using atomic counters and sorted sets for leaderboards and metrics.
4. **Message Queuing:** Using Pub/Sub or Streams for asynchronous communication.

## Redis vs. Memcached
- Redis supports complex data structures; Memcached is strictly key-value (strings).
- Redis offers persistence; Memcached is purely volatile.
- Redis is single-threaded (with some async I/O); Memcached is multi-threaded.

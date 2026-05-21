# CDN Strategies

Content Delivery Networks (CDNs) improve performance by serving content from edge locations closer to users.

## Key Benefits

- **Reduced Latency:** Content is served from the nearest edge node.
- **Improved Availability:** Distributed nature handles traffic spikes and failures.
- **Offloading Origin:** Reduces load on backend servers.

## Configuration

- **Cache TTL:** Setting appropriate time-to-live for different types of content.
- **Purge Policies:** Mechanism to clear stale content from the edge.
- **Edge Functions:** Running logic at the edge (e.g., Lambda@Edge, Cloudflare Workers).

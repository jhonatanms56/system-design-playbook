# Latency Fundamentals

## Definition

**Latency** is the time taken to process a single request from start to finish.

## Measurement

### Key Metrics
- **Milliseconds (ms)** for API calls
- **Percentiles**: p50, p95, p99 (critical for user experience)
  - p50: Median - 50% of requests complete faster than this
  - p95: 95th percentile - only 5% of requests are slower
  - p99: 99th percentile - only 1% of requests are slower

### Tools
- **Micrometer**: Metrics collection framework for Java
- **Prometheus**: Time-series database for metrics
- **Grafana**: Visualization and alerting platform
- **APM Tools**: Datadog, New Relic, Dynatrace

## Typical Targets

| Component | Target (p95) | Target (p99) |
|-----------|--------------|--------------|
| API calls | < 200ms | < 500ms |
| Database queries | < 50ms | < 100ms |
| Cache hits | < 5ms | < 10ms |
| External API calls | < 500ms | < 1000ms |

## Why Percentiles Matter

**Example:**
- Average latency: 100ms (looks good!)
- p95 latency: 800ms (5% of users experiencing slow responses)
- p99 latency: 2000ms (1% of users experiencing very slow responses)

**The problem with averages:** Averages hide outliers. Your slowest 1% of users can have a terrible experience even if the average looks good.

## Latency Budget

A latency budget allocates acceptable latency across different layers of your system:

```
Total Budget: 200ms (p95)
├── CDN: 20ms (10%)
├── API Gateway: 30ms (15%)
├── Application: 80ms (40%)
├── Database: 50ms (25%)
└── Network overhead: 20ms (10%)
```

If any component exceeds its budget, you know exactly where to optimize.

## Common Latency Issues

### 1. Network Latency
- **Symptoms:** High latency between services, geographic delays
- **Solutions:**
  - Deploy services closer to users (CDN, edge computing)
  - Use connection pooling
  - Enable HTTP/2 or gRPC
  - Use service mesh for optimized routing

### 2. Database Latency
- **Symptoms:** Slow queries, connection pool exhaustion
- **Solutions:**
  - Add appropriate indexes
  - Optimize queries
  - Use read replicas
  - Implement caching
  - Tune connection pool settings

### 3. Application Latency
- **Symptoms:** High CPU/memory usage, slow processing
- **Solutions:**
  - Profile application (Java Flight Recorder, VisualVM)
  - Optimize algorithms
  - Implement async processing
  - Reduce object creation
  - Tune JVM settings

### 4. External Service Latency
- **Symptoms:** Slow third-party API calls
- **Solutions:**
  - Implement circuit breakers
  - Add caching for external data
  - Use retry logic with exponential backoff
  - Consider alternative providers

## Measuring Latency

### Java/Spring Boot Example

```java
@RestController
public class BookController {
    
    private final MeterRegistry registry;
    private final Timer bookFetchTimer;
    
    public BookController(MeterRegistry registry) {
        this.registry = registry;
        this.bookFetchTimer = Timer.builder("book.fetch.duration")
            .description("Time taken to fetch books")
            .tag("operation", "getById")
            .register(registry);
    }
    
    @GetMapping("/books/{id}")
    public ResponseEntity<Book> getBook(@PathVariable Long id) {
        return bookFetchTimer.record(() -> {
            Book book = bookService.findById(id);
            return ResponseEntity.ok(book);
        });
    }
}
```

### Distributed Tracing

```java
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;

@RestController
public class OrderController {
    
    private final Tracer tracer;
    
    @PostMapping("/orders")
    public ResponseEntity<Order> createOrder(@RequestBody OrderRequest request) {
        Span span = tracer.spanBuilder("createOrder")
            .setAttribute("order.id", request.getOrderId())
            .setAttribute("order.amount", request.getAmount())
            .startSpan();
        
        try (Scope scope = span.makeCurrent()) {
            Order order = orderService.create(request);
            span.setStatus(StatusCode.OK);
            return ResponseEntity.ok(order);
        } catch (Exception e) {
            span.recordException(e);
            span.setStatus(StatusCode.ERROR, e.getMessage());
            throw e;
        } finally {
            span.end();
        }
    }
}
```

## Latency Optimization Checklist

- [ ] Measure p50, p95, p99 latencies for all endpoints
- [ ] Set up latency budget for each service
- [ ] Identify slow queries with database monitoring
- [ ] Implement caching for frequently accessed data
- [ ] Add distributed tracing to identify bottlenecks
- [ ] Profile application to find CPU/memory hotspots
- [ ] Optimize network calls (connection pooling, HTTP/2)
- [ ] Implement circuit breakers for external dependencies
- [ ] Set up alerts for p95/p99 latency thresholds
- [ ] Regularly review and optimize based on metrics

## Further Reading

- **Google SRE Book:** Latency Budgeting
- **Amazon Builders' Library:** Managing Latency
- **High Performance Browser Networking:** Network optimization techniques

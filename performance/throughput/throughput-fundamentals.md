# Throughput Fundamentals

## Definition

**Throughput** is the number of requests processed per unit time.

## Measurement

### Key Metrics
- **Requests Per Second (RPS):** Number of HTTP requests handled per second
- **Transactions Per Second (TPS):** Number of database transactions per second
- **Concurrent Users:** Number of simultaneous active users
- **Messages Per Second:** For event-driven systems (Kafka, RabbitMQ)

### Tools
- **Load Testing:** JMeter, Gatling, k6, Locust
- **Monitoring:** Prometheus, Grafana, Datadog
- **Application Metrics:** Micrometer, Spring Boot Actuator

## Typical Targets

| Component | Target | Notes |
|-----------|--------|-------|
| REST API (single instance) | 1,000-10,000 RPS | Depends on complexity |
| Database (PostgreSQL) | 5,000-50,000 TPS | Depends on query complexity |
| Cache (Redis) | 50,000-100,000 ops/sec | Simple operations |
| Message Queue (Kafka) | 100,000+ msgs/sec | Depends on configuration |

## Throughput vs Latency

**Important:** Throughput and latency are related but different:

```
High throughput + Low latency = Optimal ✅
High throughput + High latency = Queue buildup ⚠️
Low throughput + Low latency = Underutilized 💰
Low throughput + High latency = Performance issue ❌
```

**Little's Law:**
```
Throughput = Work in Progress / Lead Time

Example:
- 100 requests in system (WIP)
- 2 seconds average processing time (Lead Time)
- Throughput = 100 / 2 = 50 RPS
```

## Measuring Throughput

### Load Testing with k6

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

export default function () {
  let response = http.get('http://localhost:8080/api/books');
  check(response, {
    'status is 200': (r) => r.status == 200,
  });
  sleep(1);
}
```

```bash
# Run load test
k6 run load-test.js
```

### Java/Spring Boot Metrics

```java
@RestController
public class BookController {
    
    private final Counter requestCounter;
    
    public BookController(MeterRegistry registry) {
        this.requestCounter = Counter.builder("book.requests")
            .description("Number of book requests")
            .tag("endpoint", "getAll")
            .register(registry);
    }
    
    @GetMapping("/books")
    public ResponseEntity<List<Book>> getAllBooks() {
        requestCounter.increment();
        return ResponseEntity.ok(bookService.findAll());
    }
}
```

## Throughput Bottlenecks

### 1. CPU Bottleneck
**Symptoms:**
- High CPU utilization (>80%)
- Throughput plateaus despite increasing load
- Response times increase with load

**Solutions:**
- Profile application to find CPU-intensive operations
- Optimize algorithms (O(n²) → O(n))
- Horizontal scaling (add more instances)
- Use compiled languages for hot paths

### 2. Memory Bottleneck
**Symptoms:**
- High memory usage
- Frequent garbage collection pauses
- Out of memory errors

**Solutions:**
- Profile memory usage (VisualVM, YourKit)
- Fix memory leaks
- Increase heap size
- Optimize object creation
- Use object pools

### 3. Database Bottleneck
**Symptoms:**
- High database CPU
- Connection pool exhaustion
- Slow query times

**Solutions:**
- Add database indexes
- Optimize queries
- Increase connection pool size
- Implement read replicas
- Add caching layer
- Database sharding

### 4. Network Bottleneck
**Symptoms:**
- High network bandwidth usage
- Network latency spikes
- Packet loss

**Solutions:**
- Optimize payload sizes (compression)
- Use CDN for static content
- Implement HTTP/2
- Reduce external API calls
- Use connection pooling

### 5. Thread Pool Bottleneck
**Symptoms:**
- Requests queued in thread pool
- Timeout errors
- Rejected task exceptions

**Solutions:**
- Increase thread pool size
- Use async processing
- Implement proper thread pool sizing
- Monitor thread pool metrics

## Throughput Optimization Strategies

### 1. Horizontal Scaling

```yaml
# Kubernetes Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: book-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: book-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 2. Connection Pooling

```yaml
# application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 10
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

### 3. Caching

```java
@Service
public class BookService {
    
    @Cacheable(value = "books", key = "#id")
    public Book getBookById(Long id) {
        return bookRepository.findById(id);
    }
}
```

### 4. Async Processing

```java
@Service
public class OrderService {
    
    @Async
    public CompletableFuture<Void> processOrderAsync(Order order) {
        // Process order in background
        orderProcessor.process(order);
        return CompletableFuture.completedFuture(null);
    }
}
```

### 5. Batch Operations

```java
// BAD: Individual calls
for (Long id : bookIds) {
    Book book = bookRepository.findById(id);
}

// GOOD: Batch query
List<Book> books = bookRepository.findAllById(bookIds);
```

## Throughput Testing Strategy

### 1. Baseline Testing
- Test with low load (10 RPS)
- Establish baseline performance
- Verify system is healthy

### 2. Load Testing
- Gradually increase load
- Find breaking point
- Identify bottlenecks

### 3. Stress Testing
- Test beyond capacity
- Observe failure modes
- Test auto-scaling

### 4. Endurance Testing
- Sustained high load
- Test for memory leaks
- Verify stability

## Throughput Optimization Checklist

- [ ] Measure baseline throughput
- [ ] Identify bottlenecks with profiling
- [ ] Optimize database queries
- [ ] Implement caching
- [ ] Configure connection pools
- [ ] Add horizontal scaling with auto-scaling
- [ ] Implement async processing
- [ ] Use batch operations
- [ ] Optimize network calls
- [ ] Regular load testing
- [ ] Monitor throughput metrics
- [ ] Set up alerts for throughput drops

## Further Reading

- **Google SRE Book:** Capacity Planning
- **AWS Architecture Center:** Scaling Best Practices
- **The Art of Application Performance Testing:** Comprehensive guide

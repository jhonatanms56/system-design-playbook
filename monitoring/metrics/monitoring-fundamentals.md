# Monitoring and Observability Fundamentals

## Overview

Observability is the ability to understand what's happening inside your system based on external outputs. It consists of three pillars: **Metrics**, **Logs**, and **Tracing**.

## The Three Pillars of Observability

### 1. Metrics

**Definition:** Numeric measurements over time.

**Examples:**
- Request rate (RPS)
- Response time (p50, p95, p99)
- Error rate
- CPU utilization
- Memory usage

**Tools:** Prometheus, Grafana, Datadog, CloudWatch

### 2. Logs

**Definition:** Discrete events with timestamps.

**Examples:**
- Application logs
- Access logs
- Error logs
- Audit logs

**Tools:** ELK Stack, Loki, Splunk, Cloud Logging

### 3. Tracing

**Definition:** Understanding the path of a request through distributed systems.

**Examples:**
- End-to-end request latency
- Service dependency graph
- Bottleneck identification

**Tools:** Jaeger, Zipkin, AWS X-Ray, Datadog APM

## Golden Signals

Monitor these four key signals for system health:

### 1. Latency
**Time to service requests**

- Measure: p50, p95, p99 percentiles
- Target: p95 < 200ms for most APIs
- Alert: p95 > 500ms

### 2. Traffic
**Request volume**

- Measure: Requests per second (RPS)
- Target: Baseline established through load testing
- Alert: Significant deviation from baseline

### 3. Errors
**Rate of failed requests**

- Measure: Error rate percentage
- Target: < 1% for production
- Alert: Error rate > 5%

### 4. Saturation
**How full the system is**

- Measure: CPU, memory, disk, network utilization
- Target: < 70% for headroom
- Alert: > 90% utilization

## USE Method

For each resource, monitor:

### U - Utilization
Average time the resource is busy

**Example:**
```bash
# CPU utilization
mpstat 1 5

# Memory utilization
free -h
```

### S - Saturation
How much work is queued

**Example:**
```bash
# Load average
uptime

# Disk queue length
iostat -x 1
```

### E - Errors
Rate of errors

**Example:**
```bash
# Kernel errors
dmesg | grep -i error

# Application errors
grep ERROR /var/log/app.log
```

## RED Method

For each service, monitor:

### R - Rate
Requests per second

```java
// Spring Boot + Micrometer
@Autowired
private MeterRegistry registry;

private final Counter requestCounter = Counter.builder("http.requests")
    .tag("endpoint", "/books")
    .register(registry);

@GetMapping("/books")
public List<Book> getBooks() {
    requestCounter.increment();
    return bookService.findAll();
}
```

### E - Errors
Failed requests

```java
// Track errors
private final Counter errorCounter = Counter.builder("http.errors")
    .tag("endpoint", "/books")
    .tag("status", "500")
    .register(registry);

@ExceptionHandler(Exception.class)
public ResponseEntity handleError(Exception e) {
    errorCounter.increment();
    return ResponseEntity.status(500).build();
}
```

### D - Duration
Request processing time

```java
// Track request duration
private final Timer requestTimer = Timer.builder("http.request.duration")
    .tag("endpoint", "/books")
    .register(registry);

@GetMapping("/books")
public List<Book> getBooks() {
    return requestTimer.record(() -> bookService.findAll());
}
```

## Metrics Collection with Spring Boot

### Dependencies

```gradle
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-actuator'
    implementation 'io.micrometer:micrometer-registry-prometheus'
}
```

### Configuration

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus
  metrics:
    export:
      prometheus:
        enabled: true
    tags:
      application: ${spring.application.name}
      environment: ${spring.profiles.active}
```

### Custom Metrics

```java
@Component
public class BookMetrics {
    
    private final MeterRegistry registry;
    private final Counter bookFetchCounter;
    private final Timer bookFetchTimer;
    
    public BookMetrics(MeterRegistry registry) {
        this.registry = registry;
        this.bookFetchCounter = Counter.builder("book.fetch.count")
            .description("Number of books fetched")
            .tag("type", "all")
            .register(registry);
        
        this.bookFetchTimer = Timer.builder("book.fetch.duration")
            .description("Time taken to fetch books")
            .register(registry);
    }
    
    public void recordBookFetch() {
        bookFetchCounter.increment();
    }
    
    public Timer.Sample startTimer() {
        return Timer.start(registry);
    }
}
```

### Using Metrics in Service

```java
@Service
public class BookService {
    
    @Autowired
    private BookMetrics metrics;
    
    public Book getBookById(Long id) {
        Timer.Sample sample = metrics.startTimer();
        try {
            Book book = bookRepository.findById(id)
                .orElseThrow(() -> new BookNotFoundException(id));
            metrics.recordBookFetch();
            return book;
        } finally {
            sample.stop(metrics.bookFetchTimer);
        }
    }
}
```

## Distributed Tracing

### OpenTelemetry Setup

```gradle
dependencies {
    implementation 'io.opentelemetry:opentelemetry-api'
    implementation 'io.opentelemetry:opentelemetry-sdk'
    implementation 'io.opentelemetry:opentelemetry-exporter-jaeger'
}
```

### Creating Spans

```java
@RestController
public class OrderController {
    
    private final Tracer tracer;
    
    public OrderController(Tracer tracer) {
        this.tracer = tracer;
    }
    
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

## Logging Best Practices

### Structured Logging

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class BookService {
    
    private static final Logger logger = LoggerFactory.getLogger(BookService.class);
    
    public Book getBookById(Long id) {
        logger.info("Fetching book with id={}", id);
        
        try {
            Book book = bookRepository.findById(id)
                .orElseThrow(() -> new BookNotFoundException(id));
            
            logger.debug("Book found: title={}, author={}", 
                book.getTitle(), book.getAuthor());
            
            return book;
        } catch (BookNotFoundException e) {
            logger.error("Book not found with id={}", id);
            throw e;
        }
    }
}
```

### Log Levels

- **ERROR:** Error conditions that might still allow the application to continue
- **WARN:** Potentially harmful situations
- **INFO:** Interesting runtime events (startup, shutdown)
- **DEBUG:** Detailed information for debugging
- **TRACE:** Most detailed information (method entry/exit)

## Alerting Strategy

### Alert on Symptoms, Not Causes

**BAD:** Alert on CPU > 80%
**GOOD:** Alert on p95 latency > 500ms

### Alert Thresholds

```yaml
alerts:
  - name: HighLatency
    condition: p95_response_time > 500ms
    severity: warning
    
  - name: CriticalLatency
    condition: p95_response_time > 2000ms
    severity: critical
    
  - name: HighErrorRate
    condition: error_rate > 5%
    severity: warning
    
  - name: CriticalErrorRate
    condition: error_rate > 10%
    severity: critical
    
  - name: DatabaseConnectionPoolExhausted
    condition: db_connection_pool_usage > 90%
    severity: critical
    
  - name: HighGCPauses
    condition: gc_pause_time > 100ms
    severity: warning
```

## Monitoring Stack

### Prometheus + Grafana

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'spring-boot'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['localhost:8080']
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Application Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_errors_total[5m])"
          }
        ]
      }
    ]
  }
}
```

## Monitoring Checklist

- [ ] Install metrics collection (Prometheus)
- [ ] Set up visualization (Grafana)
- [ ] Configure application metrics (Micrometer)
- [ ] Create basic dashboards
- [ ] Set up alerting for critical metrics
- [ ] Implement distributed tracing
- [ ] Set up log aggregation
- [ ] Configure database monitoring
- [ ] Add external service monitoring
- [ ] Implement health checks
- [ ] Regular performance reviews

## Further Reading

- **Google SRE Book:** Monitoring
- **Observability Engineering:** Comprehensive guide
- **Prometheus Documentation:** https://prometheus.io/docs/

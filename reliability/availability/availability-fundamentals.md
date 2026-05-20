# Availability Fundamentals

## Definition

**Availability** is the percentage of time a system is operational and accessible.

## Measurement

### Key Metrics
- **Uptime Percentage:** Percentage of time system is available
- **MTTR (Mean Time To Recovery):** Average time to restore service after failure
- **MTBF (Mean Time Between Failures):** Average time between failures

### Availability Targets

| Availability | Downtime per Year | Downtime per Month | Use Case |
|-------------|-------------------|--------------------|----------|
| 99% (two nines) | 3.65 days | 7.2 hours | Non-critical internal tools |
| 99.9% (three nines) | 8.76 hours | 43.2 minutes | Most applications |
| 99.99% (four nines) | 52.56 minutes | 4.32 minutes | Critical business apps |
| 99.999% (five nines) | 5.26 minutes | 26 seconds | Life-critical systems |

### Calculating Availability

```
Availability = (Total Time - Downtime) / Total Time × 100%

Example:
- Month: 30 days = 720 hours
- Downtime: 1 hour
- Availability = (720 - 1) / 720 × 100% = 99.86%
```

## Availability Patterns

### 1. Redundancy

**Principle:** Have multiple instances of each component.

**Types:**
- **Active-Active:** All instances handle traffic
- **Active-Passive:** One instance handles traffic, others standby

**Implementation:**
```yaml
# Kubernetes deployment with multiple replicas
apiVersion: apps/v1
kind: Deployment
metadata:
  name: book-service
spec:
  replicas: 3  # Redundancy
  selector:
    matchLabels:
      app: book-service
  template:
    metadata:
      labels:
        app: book-service
    spec:
      containers:
      - name: book-service
        image: book-service:latest
```

### 2. Load Balancing

**Principle:** Distribute traffic across multiple instances.

**Implementation:**
```yaml
# NGINX load balancer with health checks
upstream book_service {
    least_conn;
    server book-service-1:8080 max_fails=3 fail_timeout=30s;
    server book-service-2:8080 max_fails=3 fail_timeout=30s;
    server book-service-3:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://book_service;
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }
}
```

### 3. Database High Availability

**Primary-Replica Setup:**
```
Application → Load Balancer → Primary (Write)
                           → Replica 1 (Read)
                           → Replica 2 (Read)
                           → Replica 3 (Read)
```

**Failover Configuration:**
```java
@Configuration
public class DataSourceConfig {
    
    @Bean
    @Primary
    public DataSource primaryDataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://primary-db:5432/booktown");
        config.setConnectionTimeout(5000);  // Quick failover
        return new HikariDataSource(config);
    }
    
    @Bean
    public DataSource replicaDataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://replica-db:5432/booktown");
        return new HikariDataSource(config);
    }
}
```

### 4. Geographic Distribution

**Multi-Region Deployment:**
```
User in US East → US East Region (primary)
User in Europe  → Europe Region (primary)
User in Asia    → Asia Region (primary)
```

**Implementation:**
```yaml
# Cloud DNS with routing policies
type: A
name: api.booktown.com
routing_policies:
  - type: GEOGRAPHICAL
    rules:
      - region: us-east-1
        endpoint: us-east-api.booktown.com
      - region: eu-west-1
        endpoint: eu-api.booktown.com
      - region: ap-northeast-1
        endpoint: asia-api.booktown.com
```

### 5. Graceful Degradation

**Principle:** Provide reduced functionality when components fail.

**Implementation:**
```java
@Service
public class BookService {
    
    @Autowired
    private BookRepository bookRepository;
    
    @Autowired
    private CacheManager cacheManager;
    
    public Book getBookById(Long id) {
        try {
            return bookRepository.findById(id)
                .orElseThrow(() -> new BookNotFoundException(id));
        } catch (DataAccessException e) {
            // Fallback to cache
            Cache cache = cacheManager.getCache("books");
            Book cached = cache.get(id, Book.class);
            if (cached != null) {
                return cached;
            }
            throw new ServiceUnavailableException("Service temporarily unavailable");
        }
    }
}
```

## Availability Strategies

### 1. Health Checks

**Implementation:**
```java
@RestController
public class HealthController {
    
    @Autowired
    private DataSource dataSource;
    
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    @GetMapping("/health/liveness")
    public ResponseEntity<Map<String, String>> liveness() {
        Map<String, String> health = new HashMap<>();
        health.put("status", "UP");
        return ResponseEntity.ok(health);
    }
    
    @GetMapping("/health/readiness")
    public ResponseEntity<Map<String, Object>> readiness() {
        Map<String, Object> health = new HashMap<>();
        
        // Check database
        boolean dbUp = checkDatabase();
        health.put("database", dbUp ? "UP" : "DOWN");
        
        // Check cache
        boolean cacheUp = checkCache();
        health.put("cache", cacheUp ? "UP" : "DOWN");
        
        boolean ready = dbUp && cacheUp;
        health.put("status", ready ? "READY" : "NOT_READY");
        
        return ResponseEntity
            .status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
            .body(health);
    }
    
    private boolean checkDatabase() {
        try (Connection conn = dataSource.getConnection()) {
            return conn.isValid(1);
        } catch (SQLException e) {
            return false;
        }
    }
    
    private boolean checkCache() {
        try {
            redisTemplate.opsForValue().set("health-check", "ok", 10, TimeUnit.SECONDS);
            return "ok".equals(redisTemplate.opsForValue().get("health-check"));
        } catch (Exception e) {
            return false;
        }
    }
}
```

**Kubernetes Probes:**
```yaml
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/readiness
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
```

### 2. Circuit Breakers

**Implementation:**
```java
@Configuration
public class CircuitBreakerConfig {
    
    @Bean
    public CircuitBreaker circuitBreaker() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
            .failureRateThreshold(50)
            .waitDurationInOpenState(Duration.ofSeconds(30))
            .permittedNumberOfCallsInHalfOpenState(5)
            .slidingWindowType(SlidingWindowType.COUNT_BASED)
            .slidingWindowSize(10)
            .build();
        
        return CircuitBreaker.of("bookService", config);
    }
}

@Service
public class ExternalBookService {
    
    @Autowired
    private CircuitBreaker circuitBreaker;
    
    public Book fetchBookFromExternalAPI(String isbn) {
        return circuitBreaker.executeSupplier(() -> {
            return externalAPIClient.getBook(isbn);
        });
    }
    
    @CircuitBreaker(name = "bookService", fallbackMethod = "getBookFromCache")
    public Book getBookWithFallback(String isbn) {
        return externalAPIClient.getBook(isbn);
    }
    
    public Book getBookFromCache(String isbn, Exception e) {
        // Fallback to cache or database
        return bookRepository.findByIsbn(isbn);
    }
}
```

### 3. Retry Logic

**Implementation:**
```java
@Service
public class PaymentService {
    
    @Retry(
        name = "paymentGateway",
        maxAttempts = 3,
        retryFor = {TransientException.class},
        backoff = @Backoff(delay = 1000, multiplier = 2)
    )
    public PaymentResult processPayment(PaymentRequest request) {
        return paymentGatewayClient.process(request);
    }
}
```

### 4. Graceful Shutdown

**Implementation:**
```java
@Configuration
public class ShutdownConfig {
    
    @Bean
    public TomcatServletWebServerFactory servletContainer() {
        TomcatServletWebServerFactory factory = new TomcatServletWebServerFactory();
        factory.setGracefulShutdown(Duration.ofSeconds(30));
        return factory;
    }
    
    @PreDestroy
    public void onShutdown() {
        // Clean up resources
        logger.info("Application shutting down gracefully");
    }
}
```

## Availability Monitoring

### Key Metrics

```yaml
metrics:
  availability:
    - uptime_percentage
    - mttr
    - mtbf
  
  component_health:
    - application_status
    - database_status
    - cache_status
    - external_service_status
  
  failover:
    - failover_count
    - failover_duration
    - failover_success_rate
```

### Alerting

```yaml
alerts:
  - name: ServiceDown
    condition: availability < 99.9%
    severity: critical
    
  - name: HighFailureRate
    condition: error_rate > 5%
    severity: critical
    
  - name: FailoverTriggered
    condition: failover_count > 0
    severity: warning
    
  - name: DegradedService
    condition: degraded_mode == true
    severity: warning
```

## Availability Best Practices

### 1. Design for Failure
- Assume components will fail
- Implement redundancy at all layers
- Test failure scenarios regularly

### 2. Implement Health Checks
- Liveness probes (is the service running?)
- Readiness probes (is the service ready to accept traffic?)
- Dependency health checks

### 3. Use Circuit Breakers
- Prevent cascading failures
- Fail fast when dependencies are down
- Implement fallback mechanisms

### 4. Graceful Degradation
- Provide reduced functionality when components fail
- Prioritize critical features
- Communicate status to users

### 5. Regular Testing
- Chaos engineering
- Failover testing
- Disaster recovery drills

### 6. Monitor Everything
- Track availability metrics
- Set up appropriate alerts
- Review incidents regularly

## Availability Checklist

- [ ] Implement redundancy at all layers
- [ ] Set up load balancing with health checks
- [ ] Configure database high availability
- [ ] Implement health check endpoints
- [ ] Add circuit breakers for external dependencies
- [ ] Implement retry logic with exponential backoff
- [ ] Configure graceful shutdown
- [ ] Implement graceful degradation
- [ ] Set up availability monitoring
- [ ] Configure appropriate alerts
- [ ] Regular failover testing
- [ ] Document incident response procedures

## Further Reading

- **"Release It!" by Michael Nygard**
- **Google SRE Book:** Availability
- **AWS Architecture Center:** High Availability

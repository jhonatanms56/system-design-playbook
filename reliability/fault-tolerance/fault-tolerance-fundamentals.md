# Fault Tolerance Fundamentals

## Definition

**Fault Tolerance** is the ability of a system to continue operating despite component failures.

## Key Strategies

### 1. Redundancy

**Principle:** Have multiple instances of each component.

**Types:**
- **Hardware Redundancy:** Multiple servers, disks, network paths
- **Software Redundancy:** Multiple instances of services
- **Data Redundancy:** Replicated databases, backups

**Implementation:**
```yaml
# Kubernetes deployment with anti-affinity
apiVersion: apps/v1
kind: Deployment
metadata:
  name: book-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: book-service
  template:
    metadata:
      labels:
        app: book-service
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - book-service
              topologyKey: kubernetes.io/hostname
      containers:
      - name: book-service
        image: book-service:latest
```

### 2. Circuit Breakers

**Principle:** Fail fast when dependencies are down to prevent cascading failures.

**States:**
- **Closed:** Normal operation, requests pass through
- **Open:** Circuit is open, requests fail immediately
- **Half-Open:** Testing if the dependency has recovered

**Implementation:**
```java
@Configuration
public class CircuitBreakerConfig {
    
    @Bean
    public CircuitBreaker circuitBreaker() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
            .failureRateThreshold(50)              // 50% failure rate triggers open
            .waitDurationInOpenState(Duration.ofSeconds(30))  // Wait 30s before trying
            .permittedNumberOfCallsInHalfOpenState(5)       // 5 calls to test recovery
            .slidingWindowType(SlidingWindowType.COUNT_BASED)
            .slidingWindowSize(10)                 // Last 10 calls
            .build();
        
        return CircuitBreaker.of("externalService", config);
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
    
    @CircuitBreaker(name = "externalService", fallbackMethod = "getBookFromCache")
    public Book getBookWithFallback(String isbn) {
        return externalAPIClient.getBook(isbn);
    }
    
    public Book getBookFromCache(String isbn, Exception e) {
        // Fallback to cache or database
        return bookRepository.findByIsbn(isbn);
    }
}
```

### 3. Retries with Exponential Backoff

**Principle:** Retry failed requests with increasing delays to handle transient failures.

**Implementation:**
```java
@Service
public class PaymentService {
    
    @Retry(
        name = "paymentGateway",
        maxAttempts = 3,
        retryFor = {TransientException.class, TimeoutException.class},
        backoff = @Backoff(
            delay = 1000,      // Initial delay: 1 second
            multiplier = 2,    // Double the delay each retry
            maxDelay = 10000    // Maximum delay: 10 seconds
        )
    )
    public PaymentResult processPayment(PaymentRequest request) {
        return paymentGatewayClient.process(request);
    }
}
```

**Retry Strategy:**
```
Attempt 1: Immediate
Attempt 2: Wait 1 second
Attempt 3: Wait 2 seconds
Attempt 4: Wait 4 seconds
Attempt 5: Wait 8 seconds
```

### 4. Bulkhead Pattern

**Principle:** Isolate failures to prevent them from spreading.

**Implementation:**
```java
@Configuration
public class BulkheadConfig {
    
    @Bean
    public Bulkhead bulkhead() {
        BulkheadConfig config = BulkheadConfig.custom()
            .maxConcurrentCalls(10)  // Max 10 concurrent calls
            .maxWaitDuration(Duration.ofSeconds(5))
            .build();
        
        return Bulkhead.of("externalService", config);
    }
}

@Service
public class ExternalBookService {
    
    @Autowired
    private Bulkhead bulkhead;
    
    @Bulkhead(name = "externalService", fallbackMethod = "getBookFromCache")
    public Book getBookWithBulkhead(String isbn) {
        return externalAPIClient.getBook(isbn);
    }
    
    public Book getBookFromCache(String isbn, Exception e) {
        return bookRepository.findByIsbn(isbn);
    }
}
```

### 5. Timeout Handling

**Principle:** Don't wait indefinitely for responses.

**Implementation:**
```java
@Configuration
public class WebClientConfig {
    
    @Bean
    public WebClient webClient() {
        HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
            .responseTimeout(Duration.ofSeconds(10))
            .doOnConnected(conn -> 
                conn.addHandlerLast(new ReadTimeoutHandler(10))
                   .addHandlerLast(new WriteTimeoutHandler(10)));
        
        return WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .build();
    }
}

@Service
public class ExternalBookService {
    
    @Autowired
    private WebClient webClient;
    
    @TimeOut(name = "externalService", fallbackMethod = "getBookFromCache")
    public Book fetchBookWithTimeout(String isbn) {
        return webClient.get()
            .uri("/books/{isbn}", isbn)
            .retrieve()
            .bodyToMono(Book.class)
            .block(Duration.ofSeconds(5));
    }
    
    public Book getBookFromCache(String isbn, Exception e) {
        return bookRepository.findByIsbn(isbn);
    }
}
```

### 6. Graceful Degradation

**Principle:** Provide reduced functionality when components fail.

**Implementation:**
```java
@Service
public class BookService {
    
    @Autowired
    private BookRepository bookRepository;
    
    @Autowired
    private CacheManager cacheManager;
    
    @Autowired
    private RecommendationService recommendationService;
    
    public BookDetails getBookDetails(Long id) {
        Book book = getBook(id);
        
        // Try to get recommendations, fail gracefully if unavailable
        try {
            List<Book> recommendations = recommendationService.getRecommendations(id);
            return new BookDetails(book, recommendations);
        } catch (Exception e) {
            logger.warn("Recommendation service unavailable, returning book only", e);
            return new BookDetails(book, Collections.emptyList());
        }
    }
    
    private Book getBook(Long id) {
        try {
            return bookRepository.findById(id)
                .orElseThrow(() -> new BookNotFoundException(id));
        } catch (DataAccessException e) {
            // Fallback to cache
            Cache cache = cacheManager.getCache("books");
            Book cached = cache.get(id, Book.class);
            if (cached != null) {
                logger.warn("Database unavailable, returning cached book");
                return cached;
            }
            throw new ServiceUnavailableException("Service temporarily unavailable");
        }
    }
}
```

## Fault Tolerance Patterns

### 1. Timeout Pattern

```java
@TimeOut(name = "externalAPI", duration = 3, fallbackMethod = "fallback")
public String callExternalAPI() {
    return externalAPIClient.call();
}

public String fallback(Exception e) {
    return "default value";
}
```

### 2. Retry Pattern

```java
@Retry(name = "externalAPI", maxAttempts = 3, backoff = @Backoff(delay = 1000))
public String callExternalAPI() {
    return externalAPIClient.call();
}
```

### 3. Circuit Breaker Pattern

```java
@CircuitBreaker(name = "externalAPI", fallbackMethod = "fallback")
public String callExternalAPI() {
    return externalAPIClient.call();
}

public String fallback(Exception e) {
    return "fallback value";
}
```

### 4. Bulkhead Pattern

```java
@Bulkhead(name = "externalAPI", maxConcurrentCalls = 10)
public String callExternalAPI() {
    return externalAPIClient.call();
}
```

### 5. Fallback Pattern

```java
@Fallback(fallbackMethod = "fallback")
public String callExternalAPI() {
    return externalAPIClient.call();
}

public String fallback(Exception e) {
    return "fallback value";
}
```

## Combined Fault Tolerance

```java
@Service
public class RobustService {
    
    @CircuitBreaker(name = "externalAPI", fallbackMethod = "fallback")
    @Retry(name = "externalAPI", maxAttempts = 3)
    @TimeOut(name = "externalAPI", duration = 5)
    @Bulkhead(name = "externalAPI", maxConcurrentCalls = 10)
    public String callExternalAPI(String request) {
        return externalAPIClient.call(request);
    }
    
    public String fallback(String request, Exception e) {
        logger.error("All fault tolerance mechanisms failed", e);
        return "default response";
    }
}
```

## Chaos Engineering

**Principle:** Proactively test system resilience by introducing failures.

### Examples

**1. Kill Pods**
```bash
# Randomly kill pods to test resilience
kubectl delete pod -l app=book-service --random
```

**2. Network Latency**
```bash
# Add network latency to test timeout handling
kubectl exec -it <pod> -- tc qdisc add dev eth0 root netem delay 100ms
```

**3. CPU Stress**
```bash
# Stress CPU to test auto-scaling
kubectl exec -it <pod> -- stress --cpu 4 --timeout 60s
```

**4. Memory Stress**
```bash
# Stress memory to test OOM handling
kubectl exec -it <pod> -- stress --vm 2 --vm-bytes 500M --timeout 60s
```

## Fault Tolerance Monitoring

### Key Metrics

```yaml
metrics:
  circuit_breaker:
    - state
    - failure_rate
    - success_rate
    - calls_total
  
  retry:
    - retry_attempts
    - retry_success
    - retry_failure
  
  bulkhead:
    - concurrent_calls
    - queue_size
    - rejected_calls
  
  timeout:
    - timeout_count
    - timeout_duration
  
  fallback:
    - fallback_calls
    - fallback_success
    - fallback_failure
```

### Alerting

```yaml
alerts:
  - name: CircuitBreakerOpen
    condition: circuit_breaker_state == OPEN
    severity: critical
    
  - name: HighRetryRate
    condition: retry_rate > 10%
    severity: warning
    
  - name: BulkheadRejection
    condition: bulkhead_rejection_rate > 5%
    severity: warning
    
  - name: HighTimeoutRate
    condition: timeout_rate > 5%
    severity: warning
```

## Fault Tolerance Best Practices

### 1. Design for Failure
- Assume components will fail
- Implement multiple layers of defense
- Test failure scenarios regularly

### 2. Use Circuit Breakers
- Prevent cascading failures
- Fail fast when dependencies are down
- Implement fallback mechanisms

### 3. Implement Retries
- Handle transient failures
- Use exponential backoff
- Limit retry attempts

### 4. Set Timeouts
- Don't wait indefinitely
- Set appropriate timeout values
- Implement timeout handling

### 5. Use Bulkheads
- Isolate failures
- Limit resource usage
- Prevent cascading failures

### 6. Implement Fallbacks
- Provide alternative behavior
- Graceful degradation
- Default values

### 7. Regular Testing
- Chaos engineering
- Failure injection
- Resilience testing

### 8. Monitor Everything
- Track fault tolerance metrics
- Set up appropriate alerts
- Review incidents regularly

## Fault Tolerance Checklist

- [ ] Implement circuit breakers for external dependencies
- [ ] Add retry logic with exponential backoff
- [ ] Set appropriate timeouts for all external calls
- [ ] Implement bulkhead pattern for resource isolation
- [ ] Add fallback mechanisms
- [ ] Implement graceful degradation
- [ ] Set up fault tolerance monitoring
- [ ] Configure appropriate alerts
- [ ] Regular chaos engineering tests
- [ ] Document failure scenarios
- [ ] Review and update fault tolerance strategies

## Further Reading

- **"Release It!" by Michael Nygard**
- **Google SRE Book:** Error Budgets
- **"Chaos Engineering" by Nelson, Rosenthal, et al.**

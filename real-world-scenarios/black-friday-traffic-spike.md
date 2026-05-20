# Real-World Scenario: Black Friday Traffic Spike

## Problem Statement

An e-commerce site experiences 10x normal traffic during Black Friday sales. Response times increase from 200ms to 5 seconds, and error rates increase to 15%.

## System Architecture

```
Users → CDN → Load Balancer → API Gateway → Microservices
                                       ├── Order Service
                                       ├── Inventory Service
                                       ├── Payment Service
                                       └── Notification Service
```

## Root Cause Analysis

### 1. Database Connection Pool Exhaustion
**Symptoms:**
- Connection timeout errors
- High database CPU usage (92%)
- Connection pool consistently at 100% utilization

**Root Cause:**
- Connection pool size: 20
- Concurrent requests: 500+
- Each request holding connection for 2-3 seconds

### 2. Cache Hit Ratio Drop
**Symptoms:**
- Cache hit ratio: 90% → 30%
- Increased load on database
- Slower response times

**Root Cause:**
- High user churn (new users, new products)
- Cache size insufficient for traffic spike
- No cache warming strategy

### 3. External Payment API Rate Limiting
**Symptoms:**
- Payment gateway timeout errors
- Rate limit errors (429)
- Checkout failures

**Root Cause:**
- Payment gateway limit: 100 requests/second
- Actual traffic: 500 requests/second
- No rate limiting at application level

### 4. CDN Cache Misses
**Symptoms:**
- High CDN cache miss rate
- Increased load on origin servers
- Slow static asset loading

**Root Cause:**
- High content churn (new products, updated images)
- Short cache TTL
- No cache warming for sale items

## Solutions Implemented

### Phase 1: Immediate (Hours)

#### 1.1 Scale Up Infrastructure

**Vertical Scaling:**
```yaml
# Database instance upgrade
# From: db-custom-2-3840 (2 vCPU, 3.8 GB RAM)
# To:   db-custom-8-15360 (8 vCPU, 15.3 GB RAM)
```

**Horizontal Scaling:**
```yaml
# Add application instances
# From: 3 instances
# To:   13 instances
```

**Auto-Scaling Configuration:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 5
  maxReplicas: 50
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

#### 1.2 Increase Connection Pool Size

```yaml
# application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 100  # Increased from 20
      minimum-idle: 50
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

#### 1.3 Enable Auto-Scaling Rules

```bash
# Enable cluster autoscaler
gcloud container clusters update book-town-cluster \
  --enable-autoscaling \
  --min-nodes=5 \
  --max-nodes=50
```

### Phase 2: Short-term (Days)

#### 2.1 Implement Rate Limiting

```java
@Configuration
public class RateLimiterConfig {
    
    @Bean
    public RateLimiter rateLimiter() {
        // 100 requests per minute per IP
        return RateLimiter.create(100.0 / 60.0);
    }
}

@ControllerAdvice
public class RateLimitExceptionHandler {
    
    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity handleRateLimit() {
        return ResponseEntity
            .status(429)
            .header("X-RateLimit-Limit", "100")
            .header("X-RateLimit-Remaining", "0")
            .header("Retry-After", "60")
            .body("Rate limit exceeded");
    }
}

@Component
public class RateLimitingFilter implements Filter {
    
    private final Cache<String, Bucket> bucketCache;
    
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, 
                         FilterChain chain) throws IOException, ServletException {
        
        String ip = getClientIP((HttpServletRequest) request);
        Bucket bucket = bucketCache.get(ip, () -> Bucket.builder()
            .addLimit(Bandwidth.classic(100, Refill.intervally(100, Duration.ofMinutes(1))))
            .build());
        
        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            ((HttpServletResponse) response).sendError(429, "Too Many Requests");
        }
    }
}
```

#### 2.2 Add Circuit Breaker for External APIs

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
        
        return CircuitBreaker.of("paymentGateway", config);
    }
}

@Service
public class PaymentService {
    
    @Autowired
    private CircuitBreaker circuitBreaker;
    
    @CircuitBreaker(name = "paymentGateway", fallbackMethod = "fallbackPayment")
    public PaymentResponse processPayment(PaymentRequest request) {
        return paymentGatewayClient.process(request);
    }
    
    public PaymentResponse fallbackPayment(PaymentRequest request, Exception e) {
        // Queue payment for later processing
        paymentQueue.enqueue(request);
        return PaymentResponse.queued();
    }
}
```

#### 2.3 Optimize Slow Queries

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);

-- Composite index for common query pattern
CREATE INDEX idx_orders_user_status_date ON orders(user_id, status, created_at DESC);

-- Analyze query performance
EXPLAIN ANALYZE 
SELECT * FROM orders 
WHERE user_id = 12345 
AND status = 'PENDING' 
ORDER BY created_at DESC 
LIMIT 20;
```

#### 2.4 Add Redis Cluster for Distributed Caching

```yaml
# Redis cluster configuration
spring:
  redis:
    cluster:
      nodes:
        - redis-node-1:6379
        - redis-node-2:6379
        - redis-node-3:6379
      max-redirects: 3
    lettuce:
      pool:
        max-active: 50
        max-idle: 20
        min-idle: 5
```

```java
@Service
public class BookService {
    
    @Cacheable(value = "books", key = "#id", unless = "#result == null")
    public Book getBookById(Long id) {
        return bookRepository.findById(id)
            .orElseThrow(() -> new BookNotFoundException(id));
    }
    
    @Cacheable(value = "products", key = "#categoryId")
    public List<Product> getProductsByCategory(Long categoryId) {
        return productRepository.findByCategoryId(categoryId);
    }
}
```

### Phase 3: Long-term (Weeks)

#### 3.1 Implement Queue-Based Checkout Processing

```java
@Service
public class OrderService {
    
    @Autowired
    private RabbitTemplate rabbitTemplate;
    
    @PostMapping("/orders")
    public ResponseEntity<OrderResponse> createOrder(@RequestBody OrderRequest request) {
        // Validate order
        validateOrder(request);
        
        // Create order record
        Order order = orderRepository.save(new Order(request));
        
        // Enqueue for processing
        rabbitTemplate.convertAndSend("order.queue", order);
        
        // Return immediately with order ID
        return ResponseEntity.accepted()
            .body(new OrderResponse(order.getId(), "PROCESSING"));
    }
    
    @RabbitListener(queues = "order.queue")
    public void processOrder(Order order) {
        try {
            // Process payment
            PaymentResult payment = paymentService.process(order.getPayment());
            
            // Reserve inventory
            inventoryService.reserve(order.getItems());
            
            // Update order status
            order.setStatus("COMPLETED");
            orderRepository.save(order);
            
            // Send notification
            notificationService.sendOrderConfirmation(order);
            
        } catch (Exception e) {
            order.setStatus("FAILED");
            orderRepository.save(order);
        }
    }
}
```

#### 3.2 Database Sharding

```
Shard Key: user_id
├── Shard 1: user_id 0-100000
├── Shard 2: user_id 100001-200000
├── Shard 3: user_id 200001-300000
└── Shard 4: user_id 300001-400000
```

**Routing Configuration:**
```java
@Configuration
public class ShardingConfig {
    
    @Bean
    public DataSource shardingDataSource() {
        Map<String, DataSource> dataSourceMap = new HashMap<>();
        dataSourceMap.put("shard1", dataSource1());
        dataSourceMap.put("shard2", dataSource2());
        dataSourceMap.put("shard3", dataSource3());
        dataSourceMap.put("shard4", dataSource4());
        
        ShardingRuleConfiguration shardingRuleConfig = new ShardingRuleConfiguration();
        shardingRuleConfig.getTableRuleConfigs().add(getOrderTableRule());
        
        return ShardingDataSourceFactory.createDataSource(
            dataSourceMap,
            shardingRuleConfig,
            new Properties()
        );
    }
    
    private TableRuleConfiguration getOrderTableRule() {
        TableRuleConfiguration rule = new TableRuleConfiguration();
        rule.setLogicTable("orders");
        rule.setActualDataNodes("shard${0..3}.orders");
        
        rule.setDatabaseShardingStrategyConfig(
            new StandardShardingStrategyConfiguration("user_id", new ModuloShardingAlgorithm())
        );
        
        return rule;
    }
}
```

#### 3.3 Geographic Distribution

```
User in US East → US East Region (primary)
User in Europe  → Europe Region (primary)
User in Asia    → Asia Region (primary)
```

**DNS Configuration:**
```yaml
# Route53 latency-based routing
type: A
name: api.booktown.com
routing_policies:
  - type: LATENCY
    records:
      - region: us-east-1
        endpoint: us-east-api.booktown.com
      - region: eu-west-1
        endpoint: eu-api.booktown.com
      - region: ap-northeast-1
        endpoint: asia-api.booktown.com
```

**Database Replication:**
```
Primary (US East) → Replica (Europe)
                   → Replica (Asia)
```

## Results

### Performance Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Response Time (p95) | 5000ms | 300ms | 94% |
| Error Rate | 15% | 0.1% | 99.3% |
| Throughput | 1,000 RPS | 15,000 RPS | 1400% |
| Database CPU | 92% | 45% | 51% |
| Cache Hit Ratio | 30% | 85% | 183% |

### Cost Impact

| Resource | Before | After | Cost Increase |
|----------|--------|-------|---------------|
| Application Instances | 3 | 13 | 333% |
| Database | db-custom-2-3840 | db-custom-8-15360 | 200% |
| Redis Cluster | Single instance | 3-node cluster | 200% |
| CDN | Standard | Premium + | 50% |

**Total Cost Increase:** ~200% during peak period
**Revenue Impact:** Prevented estimated $500K in lost sales

## Lessons Learned

### 1. Proactive Capacity Planning
- Load test before peak events
- Implement auto-scaling rules
- Have emergency scaling procedures ready

### 2. Monitoring and Alerting
- Set up comprehensive monitoring
- Alert on threshold breaches
- Have runbooks for common issues

### 3. Rate Limiting
- Implement rate limiting at multiple levels
- Protect external dependencies
- Communicate limits to users

### 4. Caching Strategy
- Warm cache before peak events
- Increase cache size for high-traffic periods
- Implement multi-level caching

### 5. Database Optimization
- Add appropriate indexes
- Implement read replicas
- Consider sharding for scale

### 6. Queue-Based Processing
- Move heavy processing to background
- Implement proper queue monitoring
- Have fallback mechanisms

## Prevention Checklist

- [ ] Regular load testing
- [ ] Implement auto-scaling
- [ ] Add rate limiting
- [ ] Implement circuit breakers
- [ ] Optimize database queries
- [ ] Add distributed caching
- [ ] Implement queue-based processing
- [ ] Set up comprehensive monitoring
- [ ] Document emergency procedures
- [ ] Regular disaster recovery drills

## Further Reading

- **Google SRE Book:** Handling Overload
- **AWS Architecture Center:** High Availability
- **"The Art of Scalability" by Abbott and Fisher**

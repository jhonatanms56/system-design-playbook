# Scalability Fundamentals

## Definition

**Scalability** is the ability to handle increased load by adding resources.

## Types of Scaling

### Vertical Scaling (Scale Up)

Add more CPU/RAM to a single instance.

**Pros:**
- Simple to implement
- No architecture changes
- No distributed system complexity
- Easier to maintain

**Cons:**
- Expensive (high-end hardware)
- Single point of failure
- Hardware limits exist
- Downtime during upgrades

**When to Use:**
- Small applications
- Simple workloads
- Limited budget for distributed systems
- Monolithic applications

**Example:**
```yaml
# Upgrade instance size
# From: e2-medium (2 vCPU, 4 GB RAM)
# To:   e2-highmem-8 (8 vCPU, 32 GB RAM)
```

### Horizontal Scaling (Scale Out)

Add more instances to handle increased load.

**Pros:**
- Cost-effective (commodity hardware)
- Fault tolerance (if one instance fails, others continue)
- Virtually unlimited scaling
- No single point of failure

**Cons:**
- Increased complexity
- State management challenges
- Load balancing required
- Data consistency across instances

**When to Use:**
- High availability requirements
- Variable/unpredictable load
- Large-scale applications
- Microservices architecture

**Example:**
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
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Scalability Patterns

### 1. Stateless Design

**Principle:** Applications should not store user session state locally.

**Why:** Enables any instance to handle any request.

**Implementation:**
```java
// BAD: State stored in memory
@RestController
public class CartController {
    private Map<String, Cart> sessions = new ConcurrentHashMap<>();
    
    @PostMapping("/cart/add")
    public void addToCart(@RequestBody Item item, HttpSession session) {
        Cart cart = sessions.get(session.getId());
        cart.add(item);
    }
}

// GOOD: State stored in external store
@RestController
public class CartController {
    
    @Autowired
    private RedisTemplate<String, Cart> redisTemplate;
    
    @PostMapping("/cart/add")
    public void addToCart(@RequestBody Item item, @RequestHeader("Session-Id") String sessionId) {
        Cart cart = redisTemplate.opsForValue().get(sessionId);
        if (cart == null) {
            cart = new Cart();
        }
        cart.add(item);
        redisTemplate.opsForValue().set(sessionId, cart);
    }
}
```

### 2. Load Balancing

Distribute incoming traffic across multiple instances.

**Algorithms:**
- **Round Robin:** Distributes evenly
- **Least Connections:** Routes to least busy instance
- **IP Hash:** Session affinity
- **Weighted:** Based on instance capacity

**Implementation:**
```yaml
# NGINX load balancer
upstream book_service {
    least_conn;
    server book-service-1:8080 weight=3;
    server book-service-2:8080 weight=2;
    server book-service-3:8080 weight=1;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://book_service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. Database Scaling

#### Read Replicas
```
Application → Load Balancer → Primary (Write)
                           → Replica 1 (Read)
                           → Replica 2 (Read)
                           → Replica 3 (Read)
```

**Implementation:**
```java
@Configuration
public class DataSourceConfig {
    
    @Bean
    @Primary
    public DataSource writeDataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://primary-db:5432/booktown");
        return new HikariDataSource(config);
    }
    
    @Bean
    public DataSource readDataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://replica-db:5432/booktown");
        return new HikariDataSource(config);
    }
}
```

#### Sharding
```
Shard Key: user_id
├── Shard 1: user_id 0-1000
├── Shard 2: user_id 1001-2000
├── Shard 3: user_id 2001-3000
└── Shard 4: user_id 3001-4000
```

**Considerations:**
- Choose shard key carefully (even distribution)
- Cross-shard queries are expensive
- Rebalancing is complex
- Consider managed solutions (MongoDB sharding, Citus for Postgres)

### 4. Caching

Reduce load on databases and services.

**Multi-Level Caching:**
```
L1: Application Cache (Caffeine) - 1ms
L2: Distributed Cache (Redis) - 5ms
L3: Database - 50ms
```

**Implementation:**
```java
@Configuration
@EnableCaching
public class CacheConfig {
    
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(10, TimeUnit.MINUTES)
            .maximumSize(1000));
        return cacheManager;
    }
}

@Service
public class BookService {
    
    @Cacheable(value = "books", key = "#id")
    public Book getBookById(Long id) {
        return bookRepository.findById(id);
    }
}
```

### 5. Asynchronous Processing

Offload heavy processing to background workers.

**Implementation:**
```java
@Service
public class OrderService {
    
    @Async
    public CompletableFuture<Void> processOrderAsync(Order order) {
        // Heavy processing
        orderProcessor.process(order);
        return CompletableFuture.completedFuture(null);
    }
}
```

**Message Queue:**
```
API → Message Queue (Kafka/RabbitMQ) → Worker Processes
```

## Auto-Scaling

### Kubernetes Horizontal Pod Autoscaler (HPA)

```yaml
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
  maxReplicas: 20
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
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
```

### Cloud Auto-Scaling Groups

```bash
# AWS Auto Scaling Group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name book-service-asg \
  --launch-template LaunchTemplateId=lt-1234567890abcdef0 \
  --min-size 3 \
  --max-size 20 \
  --desired-capacity 5 \
  --target-group-arns arn:aws:elasticloadbalancing:...:targetgroup/book-service/1234567890abcdef0
```

## Scalability Best Practices

### 1. Design for Statelessness
- Don't store session state in memory
- Use external stores (Redis, database)
- Enable any instance to handle any request

### 2. Use Distributed Caching
- Reduce database load
- Share cache across instances
- Implement cache invalidation strategy

### 3. Implement Circuit Breakers
- Prevent cascading failures
- Fail fast when dependencies are down
- Implement fallback mechanisms

### 4. Use Message Queues
- Decouple services
- Handle peak loads with queues
- Enable async processing

### 5. Monitor and Alert
- Track scaling events
- Monitor resource utilization
- Set up alerts for scaling limits

### 6. Test Scaling Behavior
- Load test before production
- Test auto-scaling policies
- Verify graceful degradation

## Scalability Checklist

- [ ] Design application to be stateless
- [ ] Implement load balancing
- [ ] Configure auto-scaling
- [ ] Use distributed caching
- [ ] Implement database read replicas
- [ ] Consider database sharding
- [ ] Use message queues for async processing
- [ ] Implement circuit breakers
- [ ] Monitor scaling metrics
- [ ] Regular load testing
- [ ] Document scaling procedures
- [ ] Test failure scenarios

## Further Reading

- **"The Art of Scalability" by Abbott and Fisher**
- **Google SRE Book:** Handling Overload
- **AWS Architecture Center:** Scaling Best Practices

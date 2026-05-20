# Database Optimization

## Connection Pool Management

### Optimal Pool Size Calculation

**Formula:**
```
pool_size = ((core_count * 2) + effective_spindle_count)
```

**Example:**
- 8-core CPU, SSD storage (no spindle limitation)
- pool_size = (8 * 2) + 0 = 16 connections

### HikariCP Configuration

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
      connection-test-query: SELECT 1
      pool-name: BookTownHikariCP
      leak-detection-threshold: 60000
```

**Configuration Guide:**
- **maximum-pool-size:** Maximum connections in pool (calculate based on CPU)
- **minimum-idle:** Minimum idle connections to maintain
- **connection-timeout:** Time to wait for connection (30s is reasonable)
- **idle-timeout:** Time before idle connection is closed (10 min)
- **max-lifetime:** Maximum time a connection can live (30 min)
- **leak-detection-threshold:** Detect connection leaks (60s for dev, disable in prod)

## Query Optimization

### 1. Use EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE 
SELECT b.*, a.name as author_name 
FROM books b 
JOIN authors a ON b.author_id = a.id 
WHERE b.category = 'FICTION' 
ORDER BY b.created_at DESC 
LIMIT 20;
```

**Key Metrics:**
- **Execution Time:** Total query time
- **Planning Time:** Time to plan the query
- **Rows:** Number of rows processed
- **Loops:** Number of iterations

### 2. Index Strategy

#### Single Column Index
```sql
CREATE INDEX idx_books_category ON books(category);
```

#### Composite Index (Order Matters!)
```sql
-- Good for queries filtering on both columns
CREATE INDEX idx_books_category_date ON books(category, created_at DESC);

-- Good for queries filtering on category only
-- Not optimal for queries filtering on created_at only
```

#### Covering Index
```sql
-- Includes all columns needed, avoids table lookup
CREATE INDEX idx_books_covering ON books(category, created_at) 
INCLUDE (title, author_id);
```

#### Partial Index
```sql
-- Index only active products
CREATE INDEX idx_active_products ON products(status) 
WHERE status = 'active';
```

#### Unique Index
```sql
-- Enforce uniqueness
CREATE UNIQUE INDEX idx_books_isbn ON books(isbn);
```

### 3. Avoid N+1 Queries

**BAD: N+1 Query Problem**
```java
List<Book> books = bookRepository.findAll();
for (Book book : books) {
    Author author = authorRepository.findById(book.getAuthorId());
    book.setAuthor(author);
}
```

**GOOD: Use JOIN FETCH**
```java
@Query("SELECT b FROM Book b JOIN FETCH b.author WHERE b.category = :category")
List<Book> findBooksWithAuthor(@Param("category") String category);
```

### 4. Query Batching

**BAD: Individual Queries**
```java
for (Long id : bookIds) {
    Book book = bookRepository.findById(id);
}
```

**GOOD: Batch Query**
```java
List<Book> books = bookRepository.findAllById(bookIds);
```

### 5. Pagination

**BAD: OFFSET Pagination**
```sql
-- Slow for large offsets
SELECT * FROM books ORDER BY created_at DESC LIMIT 20 OFFSET 10000;
```

**GOOD: Keyset Pagination**
```sql
-- Fast, uses index
SELECT * FROM books 
WHERE created_at < '2024-01-01 12:00:00' 
ORDER BY created_at DESC 
LIMIT 20;
```

## Schema Optimization

### 1. Data Types

**Choose Appropriate Types:**
```sql
-- BAD: Using TEXT for everything
CREATE TABLE books (
    id TEXT,
    price TEXT,
    created_at TEXT
);

-- GOOD: Using appropriate types
CREATE TABLE books (
    id BIGSERIAL PRIMARY KEY,
    price DECIMAL(10, 2),
    created_at TIMESTAMP
);
```

### 2. Normalization vs Denormalization

**Normalization (Write-Heavy):**
```sql
-- Normalized schema
CREATE TABLE books (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255),
    author_id BIGINT REFERENCES authors(id)
);

CREATE TABLE authors (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255)
);
```

**Denormalization (Read-Heavy):**
```sql
-- Denormalized for fast reads
CREATE TABLE books (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255),
    author_name VARCHAR(255)  -- Denormalized
);
```

### 3. Partitioning

```sql
-- Partition large table by date
CREATE TABLE orders (
    id BIGSERIAL,
    created_at TIMESTAMP,
    amount DECIMAL(10, 2),
    status VARCHAR(50)
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE orders_2024_q1 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE orders_2024_q2 PARTITION OF orders
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');
```

## Database Scaling Strategies

### 1. Read Replicas

**Architecture:**
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

// Use routing based on operation type
public class BookRepositoryImpl implements BookRepository {
    
    @Autowired
    @Qualifier("writeDataSource")
    private DataSource writeDataSource;
    
    @Autowired
    @Qualifier("readDataSource")
    private DataSource readDataSource;
    
    public Book findById(Long id) {
        // Use read replica
        return jdbcTemplate(readDataSource).queryForObject(...);
    }
    
    public void save(Book book) {
        // Use primary
        jdbcTemplate(writeDataSource).update(...);
    }
}
```

### 2. Sharding

**Architecture:**
```
Shard Key: user_id
├── Shard 1: user_id 0-100000
├── Shard 2: user_id 100001-200000
├── Shard 3: user_id 200001-300000
└── Shard 4: user_id 300001-400000
```

**Considerations:**
- Choose shard key carefully (even distribution)
- Cross-shard queries are expensive
- Rebalancing is complex
- Consider managed solutions (MongoDB sharding, Citus for Postgres)

### 3. Caching Layers

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
    
    @Bean
    public RedisCacheManager redisCacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(30))
            .disableCachingNullValues();
        
        return RedisCacheManager.builder(factory)
            .cacheDefaults(config)
            .build();
    }
}

@Service
public class BookService {
    
    @Cacheable(value = "books", key = "#id", unless = "#result == null")
    public Book getBookById(Long id) {
        return bookRepository.findById(id);
    }
    
    @CacheEvict(value = "books", allEntries = true)
    public Book save(Book book) {
        return bookRepository.save(book);
    }
}
```

## Monitoring

### Key Metrics

```yaml
metrics:
  connection_pool:
    - active_connections
    - idle_connections
    - waiting_threads
    - max_connections
  
  query_performance:
    - query_duration_p50
    - query_duration_p95
    - query_duration_p99
    - slow_query_count
  
  database_resources:
    - cpu_utilization
    - memory_utilization
    - disk_io
    - network_io
  
  replication:
    - replication_lag
    - replica_status
```

### Slow Query Logging

```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s

-- Reload configuration
SELECT pg_reload_conf();

-- View slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC
LIMIT 20;
```

## Optimization Checklist

- [ ] Calculate optimal connection pool size
- [ ] Configure HikariCP appropriately
- [ ] Add indexes for frequently queried columns
- [ ] Use EXPLAIN ANALYZE for slow queries
- [ ] Avoid N+1 queries
- [ ] Implement query batching
- [ ] Use keyset pagination
- [ ] Choose appropriate data types
- [ ] Consider normalization vs denormalization
- [ ] Partition large tables
- [ ] Implement read replicas
- [ ] Consider sharding for scale
- [ ] Add multi-level caching
- [ ] Enable slow query logging
- [ ] Monitor database metrics
- [ ] Regularly review and optimize

## Further Reading

- **"SQL Performance Explained" by Markus Winand**
- **"PostgreSQL: Up and Running" by Regina Obe and Leo Hsu**
- **"High Performance MySQL" by Baron Schwartz et al.**

# Kafka Fundamentals

Apache Kafka is a distributed event store and stream-processing platform. It is designed to handle high-volume, real-time data feeds.

## Core Concepts
- **Topic:** A category or feed name to which records are published.
- **Producer:** An application that sends records to one or more Kafka topics.
- **Consumer:** An application that reads records from one or more Kafka topics.
- **Broker:** A Kafka server that stores data and serves clients.
- **Partition:** Topics are divided into partitions for scalability and parallelism.
- **Consumer Group:** A set of consumers that cooperate to consume data from a topic.

## Key Architecture Patterns
1. **Pub/Sub:** Traditional many-to-many messaging.
2. **Log Aggregation:** Collecting logs from various services into a central store.
3. **Event Sourcing:** Storing every change to application state as a sequence of events.
4. **Stream Processing:** Transforming and analyzing data in real-time.

## Durability and Replication
Kafka replicates partitions across multiple brokers. If one broker fails, another can take over, ensuring zero data loss and high availability.

# RabbitMQ Fundamentals

RabbitMQ is a widely deployed open-source message broker that implements the Advanced Message Queuing Protocol (AMQP).

## Core Concepts
- **Producer:** Application that sends messages.
- **Exchange:** Receives messages from producers and pushes them to queues based on rules (Routing Keys).
- **Queue:** A buffer that stores messages.
- **Consumer:** Application that receives messages.
- **Binding:** A link between an exchange and a queue.

## Exchange Types
1. **Direct:** Message goes to the queue whose binding key exactly matches the routing key.
2. **Topic:** Message goes to one or many queues based on wildcard matching between routing key and binding pattern.
3. **Fanout:** Message is broadcast to all queues bound to the exchange.
4. **Headers:** Uses message headers for routing instead of routing keys.

## Kafka vs. RabbitMQ
- **RabbitMQ:** Smart broker, dumb consumer. Focuses on complex routing and guaranteed delivery.
- **Kafka:** Dumb broker, smart consumer. Focuses on high throughput, retention, and replaying history.
- **RabbitMQ:** Messages are deleted after acknowledgement.
- **Kafka:** Messages are persistent and can be replayed.

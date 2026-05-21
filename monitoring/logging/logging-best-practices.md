# Logging Best Practices

Logging is a fundamental part of observability. It provides a detailed record of events within an application.

## Principles of Good Logging

- **Structured Logging:** Use formats like JSON instead of plain text for easier parsing and analysis.
- **Log Levels:** Appropriately use levels like DEBUG, INFO, WARN, ERROR, and FATAL.
- **Contextual Information:** Include correlation IDs, user IDs, and request metadata.
- **No Sensitive Data:** Never log PII, passwords, or secrets.

## Tools

- **ELK Stack (Elasticsearch, Logstash, Kibana)**
- **Splunk**
- **Graylog**
- **CloudWatch (AWS) / Cloud Logging (GCP)**

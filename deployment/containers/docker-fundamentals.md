# Docker Fundamentals

## Definition

**Docker** is a platform for developing, shipping, and running applications in containers. Containers are lightweight, standalone, and executable packages that include everything needed to run an application: code, runtime, system tools, libraries, and settings.

## Core Concepts

### Images vs Containers
- **Image**: A read-only template with instructions for creating a container (like a class in programming)
- **Container**: A runnable instance of an image (like an object from a class)
- **Registry**: A storage and distribution system for Docker images (e.g., Docker Hub, AWS ECR)

### Dockerfile
A text file that contains instructions for building a Docker image:

```dockerfile
# Use official OpenJDK 17 runtime
FROM openjdk:17-jdk-slim

# Set working directory
WORKDIR /app

# Copy jar file
COPY target/myapp.jar /app/myapp.jar

# Expose port
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "myapp.jar"]
```

## Docker Workflow

The following diagram shows how Docker flows from development to production in real-world environments:

```
┌─────────────┐
│  Developer  │
└──────┬──────┘
       │ Writes
       ▼
┌─────────────┐
│  Dockerfile │
└──────┬──────┘
       │ docker build
       ▼
┌─────────────────┐
│ Docker Image    │
│    (Local)      │
└──────┬──────────┘
       │ docker push
       ▼
┌──────────────────┐
│ Docker Hub /     │
│    Registry      │
└──────┬───────────┘
       │ docker pull
       ▼
┌─────────────────┐
│ Docker Image    │
│  (Production)   │
└──────┬──────────┘
       │ docker run
       ▼
┌─────────────────┐
│ Docker Container│
└──────┬──────────┘
       │ Running
       ▼
┌─────────────┐
│ Application │
└─────────────┘
```

### Real-World Flow

1. **Development Phase**
   - Developer creates `Dockerfile` with build instructions
   - Runs `docker build -t myapp:1.0 .` to build image locally
   - Tests container with `docker run -p 8080:8080 myapp:1.0`

2. **Push to Registry**
   - Developer runs `docker tag myapp:1.0 myregistry/myapp:1.0`
   - Runs `docker push myregistry/myapp:1.0` to upload to Docker Hub or private registry

3. **Deployment Phase**
   - Production server runs `docker pull myregistry/myapp:1.0`
   - Deploys with `docker run -d -p 8080:8080 --name myapp myregistry/myapp:1.0`
   - Application is now running in production container

### CI/CD Integration

```
┌──────────┐
│ Git Push │
└────┬─────┘
     │
     ▼
┌─────────────────────┐
│ CI Server           │
│ (Jenkins/GitHub     │
│  Actions)           │
└────┬────────────────┘
     │ docker build
     ▼
┌─────────────────┐
│ Docker Image    │
└────┬────────────┘
     │ docker push
     ▼
┌─────────────────┐
│ Registry        │
└────┬────────────┘
     │ kubectl / docker-compose
     ▼
┌─────────────────────┐
│ Production          │
│ Environment         │
└────┬────────────────┘
     │
     ▼
┌─────────────────┐
│ Running         │
│ Containers     │
└─────────────────┘
```

## Key Docker Commands

### Image Management
```bash
# Build an image
docker build -t myapp:1.0 .

# Pull an image from registry
docker pull nginx:latest

# List local images
docker images

# Remove an image
docker rmi myapp:1.0
```

### Container Management
```bash
# Run a container
docker run -d -p 8080:8080 --name myapp myapp:1.0

# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Stop a container
docker stop myapp

# Start a stopped container
docker start myapp

# Remove a container
docker rm myapp

# View container logs
docker logs myapp

# Execute command in running container
docker exec -it myapp /bin/bash
```

### Volume Management
```bash
# Create a volume
docker volume create mydata

# Mount volume to container
docker run -v mydata:/app/data myapp:1.0

# List volumes
docker volume ls

# Remove volume
docker volume rm mydata
```

## Docker Compose

Docker Compose simplifies multi-container applications with a YAML configuration:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/mydb
    depends_on:
      - db
    networks:
      - app-network

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=mydb
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - app-network

volumes:
  db-data:

networks:
  app-network:
    driver: bridge
```

### Docker Compose Commands
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild and restart
docker-compose up -d --build

# Scale services
docker-compose up -d --scale app=3
```

## Best Practices

### 1. Use Official Base Images
```dockerfile
# Good - Official, minimal image
FROM node:18-alpine

# Avoid - Unofficial, potentially insecure
FROM random-user/node:18
```

### 2. Minimize Image Size
```dockerfile
# Use multi-stage builds
FROM maven:3.8-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM openjdk:17-jdk-slim
WORKDIR /app
COPY --from=build /app/target/myapp.jar myapp.jar
ENTRYPOINT ["java", "-jar", "myapp.jar"]
```

### 3. Leverage Build Cache
```dockerfile
# Copy dependencies first (changes less frequently)
COPY pom.xml .
RUN mvn dependency:go-offline

# Copy source code (changes more frequently)
COPY src ./src
```

### 4. Use .dockerignore
```
.git
.gitignore
target/
*.md
.env
node_modules/
```

### 5. Run as Non-Root User
```dockerfile
FROM openjdk:17-jdk-slim

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set permissions
WORKDIR /app
COPY --chown=appuser:appuser target/myapp.jar myapp.jar

# Switch to non-root user
USER appuser

ENTRYPOINT ["java", "-jar", "myapp.jar"]
```

## Common Patterns

### 1. Web Application
```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
```

### 2. API Service
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

### 3. Database
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
```

## Networking

### Bridge Network (Default)
```bash
# Create custom bridge network
docker network create my-network

# Connect containers to network
docker run --network my-network --name app1 myapp:1.0
docker run --network my-network --name app2 myapp:1.0

# Containers can communicate by name
```

### Host Network
```bash
# Container uses host's network stack (no isolation)
docker run --network host myapp:1.0
```

### None Network
```bash
# Container has no network access
docker run --network none myapp:1.0
```

## Volumes and Persistence

### Bind Mounts
```bash
# Mount host directory to container
docker run -v /host/path:/container/path myapp:1.0
```

### Named Volumes
```bash
# Create and use named volume
docker volume create mydata
docker run -v mydata:/container/path myapp:1.0
```

### Anonymous Volumes
```bash
# Docker creates volume with random name
docker run -v /container/path myapp:1.0
```

## Security Considerations

### 1. Scan Images for Vulnerabilities
```bash
# Use Trivy to scan images
trivy image myapp:1.0

# Use Docker Scout
docker scout quickview myapp:1.0
docker scout cves myapp:1.0
```

### 2. Use Specific Image Tags
```dockerfile
# Good - Specific version
FROM nginx:1.24-alpine

# Avoid - Latest tag (can change unexpectedly)
FROM nginx:latest
```

### 3. Don't Store Secrets in Images
```dockerfile
# Bad - Hardcoded secrets
ENV API_KEY=secret123

# Good - Use environment variables or secrets
ENV API_KEY=${API_KEY}
```

### 4. Limit Container Capabilities
```bash
# Drop all capabilities, add only what's needed
docker run --cap-drop ALL --cap-add NET_BIND_SERVICE myapp:1.0

# Run in read-only filesystem
docker run --read-only myapp:1.0
```

## Performance Optimization

### 1. Use Layer Caching
```dockerfile
# Order instructions from least to most frequently changing
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./          # Changes rarely
RUN npm ci                      # Expensive, cached
COPY . .                        # Changes frequently
```

### 2. Use .dockerignore
Exclude unnecessary files to reduce build context size and improve build speed.

### 3. Multi-Stage Builds
Separate build and runtime environments to minimize final image size.

### 4. Resource Limits
```bash
# Limit CPU and memory usage
docker run -m 512m --cpus="1.5" myapp:1.0
```

## Troubleshooting

### View Container Logs
```bash
# Follow logs in real-time
docker logs -f myapp

# Show last 100 lines
docker logs --tail 100 myapp

# Show timestamps
docker logs -t myapp
```

### Inspect Container
```bash
# View detailed container information
docker inspect myapp

# View container processes
docker top myapp

# View container resource usage
docker stats myapp
```

### Debug Container
```bash
# Start interactive shell in running container
docker exec -it myapp /bin/bash

# Start container with entrypoint override
docker run -it --entrypoint /bin/bash myapp:1.0
```

### Common Issues
- **Container won't start**: Check logs with `docker logs <container>`
- **Port already in use**: Find conflicting process with `lsof -i :<port>`
- **Image not found**: Verify image name and tag, check network connectivity
- **Permission denied**: Check file permissions on bind mounts

## Docker vs Virtual Machines

| Aspect | Docker Containers | Virtual Machines |
|--------|------------------|------------------|
| Size | MBs | GBs |
| Startup time | Seconds | Minutes |
| Performance | Near-native | Overhead from hypervisor |
| Isolation | Process-level | OS-level |
| Portability | High | Medium |
| Resource usage | Efficient | Less efficient |

## Further Reading

- **Docker Documentation**: https://docs.docker.com/
- **Docker Best Practices**: https://docs.docker.com/develop/dev-best-practices/
- **Docker Security**: https://docs.docker.com/engine/security/
- **Docker Compose Reference**: https://docs.docker.com/compose/compose-file/

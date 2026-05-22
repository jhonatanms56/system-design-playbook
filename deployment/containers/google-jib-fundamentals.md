# Google Jib Fundamentals

## Definition

**Google Jib** is a Java containerizer from Google that allows developers to build Docker and OCI-compliant container images without needing a Docker daemon. It's optimized for Java applications and can be used as a Maven or Gradle plugin, making it easy to integrate into existing build processes.

## Why Jib?

### Key Benefits
- **No Docker daemon required**: Build containers without installing Docker
- **Fast builds**: Jib organizes your application into distinct layers (dependencies, resources, classes) for better caching
- **Reproducible builds**: Same inputs always produce the same image
- **Simple integration**: Works with Maven and Gradle plugins
- **Optimized for Java**: Understands Java application structure

### Jib vs Docker

| Aspect | Jib | Docker |
|--------|-----|--------|
| Docker daemon required | No | Yes |
| Build speed | Faster (layer caching) | Slower |
| Java optimization | Yes | No |
| Reproducibility | High | Medium |
| Learning curve | Low | Medium |
| Flexibility | Java-focused | Universal |

## Installation

### Maven Plugin
Add to your `pom.xml`:

```xml
<plugin>
    <groupId>com.google.cloud.tools</groupId>
    <artifactId>jib-maven-plugin</artifactId>
    <version>3.4.0</version>
    <configuration>
        <to>
            <image>my-registry.com/myapp:1.0</image>
        </to>
    </configuration>
</plugin>
```

### Gradle Plugin
Add to your `build.gradle`:

```groovy
plugins {
    id 'com.google.cloud.tools.jib' version '3.4.0'
}

jib {
    to {
        image = 'my-registry.com/myapp:1.0'
    }
}
```

## Basic Usage

### Build to Docker Daemon
```bash
# Maven
mvn jib:dockerBuild

# Gradle
./gradlew jibDockerBuild
```

### Build to Registry
```bash
# Maven
mvn jib:build

# Gradle
./gradlew jib
```

### Build to Tar File
```bash
# Maven
mvn jib:buildTar

# Gradle
./gradlew jibBuildTar
```

## Configuration

### Maven Configuration
```xml
<plugin>
    <groupId>com.google.cloud.tools</groupId>
    <artifactId>jib-maven-plugin</artifactId>
    <version>3.4.0</version>
    <configuration>
        <from>
            <image>openjdk:17-jdk-slim</image>
        </from>
        <to>
            <image>my-registry.com/myapp:${project.version}</image>
            <auth>
                <username>${DOCKER_USERNAME}</username>
                <password>${DOCKER_PASSWORD}</password>
            </auth>
        </to>
        <container>
            <ports>8080</ports>
            <environment>
                <SPRING_PROFILES_ACTIVE>production</SPRING_PROFILES_ACTIVE>
            </environment>
            <jvmFlags>
                <jvmFlag>-Xms512m</jvmFlag>
                <jvmFlag>-Xmx1024m</jvmFlag>
            </jvmFlags>
        </container>
    </configuration>
</plugin>
```

### Gradle Configuration
```groovy
jib {
    from {
        image = 'openjdk:17-jdk-slim'
    }
    to {
        image = 'my-registry.com/myapp:' + project.version
        auth {
            username = System.getenv('DOCKER_USERNAME')
            password = System.getenv('DOCKER_PASSWORD')
        }
    }
    container {
        ports = ['8080']
        environment = [
            SPRING_PROFILES_ACTIVE: 'production'
        ]
        jvmFlags = ['-Xms512m', '-Xmx1024m']
    }
}
```

## Layer Optimization

Jib automatically organizes your application into layers for better caching:

### Default Layer Structure
1. **Dependencies** - JAR dependencies (change rarely)
2. **Snapshot Dependencies** - Snapshot dependencies (change occasionally)
3. **Resources** - Application resources (change occasionally)
4. **Classes** - Compiled classes (change frequently)

### Custom Layer Configuration
```xml
<configuration>
    <container>
        <extraClasspath>
            <!-- Add extra classpath entries -->
        </extraClasspath>
    </container>
    <extraDirectories>
        <paths>
            <path>
                <from>src/main/custom</path>
                <into>/app/custom</to>
                <excludes>
                    <exclude>**/*.tmp</exclude>
                </excludes>
            </path>
        </paths>
    </extraDirectories>
</configuration>
```

## Base Images

### Using Different Base Images
```xml
<configuration>
    <from>
        <image>openjdk:17-jdk-slim</image>
        <!-- or -->
        <image>eclipse-temurin:17-jre-alpine</image>
        <!-- or -->
        <image>amazoncorretto:17-alpine</image>
    </from>
</configuration>
```

### Custom Base Image
```xml
<configuration>
    <from>
        <image>my-custom-base:1.0</image>
    </from>
</configuration>
```

## Authentication

### Docker Hub Authentication
```xml
<configuration>
    <to>
        <image>docker.io/myusername/myapp:1.0</image>
        <auth>
            <username>${DOCKER_USERNAME}</username>
            <password>${DOCKER_PASSWORD}</password>
        </auth>
    </to>
</configuration>
```

### AWS ECR Authentication
```xml
<configuration>
    <to>
        <image>${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/myapp:1.0</image>
        <auth>
            <username>AWS</username>
            <password>${ECR_PASSWORD}</password>
        </auth>
    </to>
</configuration>
```

### Google GCR Authentication
```xml
<configuration>
    <to>
        <image>gcr.io/my-project/myapp:1.0</image>
        <credHelper>gcr</credHelper>
    </to>
</configuration>
```

## JVM Configuration

### JVM Flags
```xml
<configuration>
    <container>
        <jvmFlags>
            <jvmFlag>-Xms512m</jvmFlag>
            <jvmFlag>-Xmx1024m</jvmFlag>
            <jvmFlag>-XX:+UseG1GC</jvmFlag>
            <jvmFlag>-Djava.security.egd=file:/dev/./urandom</jvmFlag>
        </jvmFlags>
    </container>
</configuration>
```

### Main Class Configuration
```xml
<configuration>
    <container>
        <mainClass>com.example.MyApplication</mainClass>
    </container>
</configuration>
```

## Spring Boot Integration

### Spring Boot Maven Configuration
```xml
<plugin>
    <groupId>com.google.cloud.tools</groupId>
    <artifactId>jib-maven-plugin</artifactId>
    <version>3.4.0</version>
    <configuration>
        <from>
            <image>openjdk:17-jdk-slim</image>
        </from>
        <to>
            <image>my-registry.com/myapp:${project.version}</image>
        </to>
        <container>
            <mainClass>org.springframework.boot.loader.JarLauncher</mainClass>
        </container>
    </configuration>
</plugin>
```

### Spring Boot Gradle Configuration
```groovy
jib {
    from {
        image = 'openjdk:17-jdk-slim'
    }
    to {
        image = 'my-registry.com/myapp:' + project.version
    }
    container {
        mainClass = 'org.springframework.boot.loader.JarLauncher'
    }
}
```

## Multi-Module Projects

### Maven Multi-Module
```xml
<!-- In parent pom.xml -->
<pluginManagement>
    <plugins>
        <plugin>
            <groupId>com.google.cloud.tools</groupId>
            <artifactId>jib-maven-plugin</artifactId>
            <version>3.4.0</version>
        </plugin>
    </plugins>
</pluginManagement>

<!-- In module pom.xml -->
<plugin>
    <groupId>com.google.cloud.tools</groupId>
    <artifactId>jib-maven-plugin</artifactId>
    <configuration>
        <to>
            <image>my-registry.com/${project.artifactId}:${project.version}</image>
        </to>
    </configuration>
</plugin>
```

## CI/CD Integration

### Jenkins Pipeline
```groovy
pipeline {
    agent any
    stages {
        stage('Build with Jib') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-registry',
                    usernameVariable: 'DOCKER_USERNAME',
                    passwordVariable: 'DOCKER_PASSWORD'
                )]) {
                    sh 'mvn jib:build -Ddocker.username=$DOCKER_USERNAME -Ddocker.password=$DOCKER_PASSWORD'
                }
            }
        }
    }
}
```

### GitHub Actions
```yaml
name: Build and Push with Jib

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'
      - name: Build with Jib
        run: mvn jib:build
        env:
          DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
          DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
```

### GitLab CI
```yaml
build:
  image: maven:3.8-eclipse-temurin-17
  script:
    - mvn jib:build
  variables:
    DOCKER_USERNAME: $CI_REGISTRY_USER
    DOCKER_PASSWORD: $CI_REGISTRY_PASSWORD
```

## Advanced Features

### War Files
```xml
<configuration>
    <container>
        <appRoot>/usr/local/tomcat/webapps/ROOT</appRoot>
        <entrypoint>['java', '-jar', '/usr/local/tomcat/bin/bootstrap.jar']</entrypoint>
    </container>
</configuration>
```

### Custom Entrypoint
```xml
<configuration>
    <container>
        <entrypoint>['sh', '-c', 'java -jar /app/myapp.jar']</entrypoint>
    </container>
</configuration>
```

### Volume Configuration
```xml
<configuration>
    <container>
        <volumes>
            <volume>/data</volume>
            <volume>/logs</volume>
        </volumes>
    </container>
</configuration>
```

## Best Practices

### 1. Use Specific Base Image Versions
```xml
<from>
    <image>openjdk:17-jdk-slim</image>  <!-- Good -->
    <!-- Avoid -->
    <!-- <image>openjdk:latest</image> -->
</from>
```

### 2. Leverage Layer Caching
Jib automatically optimizes layers, but you can customize:
```xml
<configuration>
    <extraDirectories>
        <paths>
            <path>
                <from>src/main/resources</from>
                <into>/app/resources</into>
            </path>
        </paths>
    </extraDirectories>
</configuration>
```

### 3. Use Environment Variables for Secrets
```xml
<configuration>
    <container>
        <environment>
            <DB_PASSWORD>${DB_PASSWORD}</DB_PASSWORD>
            <API_KEY>${API_KEY}</API_KEY>
        </environment>
    </container>
</configuration>
```

### 4. Optimize JVM Settings
```xml
<configuration>
    <container>
        <jvmFlags>
            <jvmFlag>-Xms512m</jvmFlag>
            <jvmFlag>-Xmx1024m</jvmFlag>
            <jvmFlag>-XX:+UseContainerSupport</jvmFlag>
            <jvmFlag>-XX:MaxRAMPercentage=75.0</jvmFlag>
        </jvmFlags>
    </container>
</configuration>
```

### 5. Use Credential Helpers
```xml
<configuration>
    <to>
        <credHelper>ecr-login</credHelper>
        <!-- or -->
        <credHelper>gcr</credHelper>
    </to>
</configuration>
```

## Troubleshooting

### Common Issues

#### Authentication Failures
```bash
# Verify credentials
echo $DOCKER_USERNAME
echo $DOCKER_PASSWORD

# Test registry access
docker login my-registry.com
```

#### Build Failures
```bash
# Enable debug logging
mvn jib:build -X

# Clean build
mvn clean jib:build
```

#### Layer Caching Issues
```bash
# Skip layer caching
mvn jib:build -Djib.disableUpdateChecks=true
```

## Jib vs Other Container Tools

| Feature | Jib | Docker | Podman | Buildah |
|---------|-----|--------|--------|---------|
| Docker daemon | No | Yes | No | No |
| Java optimization | Yes | No | No | No |
| Layer caching | Automatic | Manual | Manual | Manual |
| Maven/Gradle integration | Yes | No | No | No |
| Reproducibility | High | Medium | High | High |
| Learning curve | Low | Medium | Medium | High |

## When to Use Jib

### Use Jib When:
- Building Java applications
- Want to avoid Docker daemon installation
- Need fast, reproducible builds
- Using Maven or Gradle build tools
- Deploying to Kubernetes or cloud platforms

### Consider Docker When:
- Building non-Java applications
- Need full Docker ecosystem features
- Want to use Docker Compose locally
- Need complex multi-stage builds

## Further Reading

- **Google Jib Documentation**: https://github.com/GoogleContainerTools/jib
- **Jib Maven Plugin**: https://github.com/GoogleContainerTools/jib/tree/master/jib-maven-plugin
- **Jib Gradle Plugin**: https://github.com/GoogleContainerTools/jib/tree/master/jib-gradle-plugin
- **Jib Best Practices**: https://github.com/GoogleContainerTools/jib/blob/master/docs/faq.md

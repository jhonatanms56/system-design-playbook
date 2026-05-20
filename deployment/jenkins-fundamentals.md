# Jenkins Fundamentals

## Definition

**Jenkins** is an open-source automation server that enables developers to build, test, and deploy applications reliably. It's the most popular continuous integration/continuous deployment (CI/CD) tool, providing hundreds of plugins to support building, deploying, and automating any project.

## CI/CD Concepts

### Continuous Integration (CI)
- Automatically integrate code changes from multiple contributors
- Run automated builds and tests on every commit
- Detect integration errors early
- Provide rapid feedback to developers

### Continuous Deployment (CD)
- Automatically deploy code changes to production
- Ensure all tests pass before deployment
- Enable frequent, reliable releases
- Reduce manual intervention and human error

### CI/CD Pipeline
A CI/CD pipeline is a series of automated steps that code goes through from commit to deployment:

```
Code Commit → Build → Test → Deploy to Staging → Integration Tests → Deploy to Production
```

## Jenkins Architecture

### Master-Agent Architecture
- **Master**: Orchestrates builds, schedules jobs, manages agents
- **Agent**: Executes build jobs (can be distributed across multiple machines)
- **Benefits**: Scalability, parallel execution, environment isolation

### Key Components
- **Jobs/Pipelines**: Define build and deployment processes
- **Builds**: Executions of jobs with specific parameters
- **Workspace**: Working directory for a job
- **Artifacts**: Files produced by builds (JARs, WARs, Docker images)
- **Credentials**: Secure storage for secrets (API keys, passwords)

## Installation

### Using Docker (Recommended)
```bash
# Pull Jenkins image
docker pull jenkins/jenkins:lts

# Run Jenkins container
docker run -d -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  --name jenkins \
  jenkins/jenkins:lts

# Get initial admin password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

### Traditional Installation
```bash
# Add Jenkins repository
wget -q -O - https://pkg.jenkins.io/debian-stable/jenkins.io.key | sudo apt-key add -
sudo sh -c 'echo deb https://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'

# Install Jenkins
sudo apt update
sudo apt install jenkins

# Start Jenkins
sudo systemctl start jenkins
sudo systemctl enable jenkins
```

## Jenkinsfile (Pipeline as Code)

A Jenkinsfile defines a CI/CD pipeline using Groovy syntax:

### Declarative Pipeline (Recommended)
```groovy
pipeline {
    agent any
    
    tools {
        maven 'Maven 3.8'
        jdk 'JDK 17'
    }
    
    environment {
        DOCKER_IMAGE = "myapp:${BUILD_NUMBER}"
        REGISTRY = "my-registry.com"
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Build') {
            steps {
                sh 'mvn clean package -DskipTests'
            }
        }
        
        stage('Unit Tests') {
            steps {
                sh 'mvn test'
            }
            post {
                always {
                    junit 'target/surefire-reports/*.xml'
                }
            }
        }
        
        stage('Code Quality') {
            steps {
                sh 'mvn sonar:sonar'
            }
        }
        
        stage('Build Docker Image') {
            steps {
                sh "docker build -t ${DOCKER_IMAGE} ."
            }
        }
        
        stage('Push to Registry') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-registry',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh """
                        echo ${DOCKER_PASS} | docker login -u ${DOCKER_USER} --password-stdin ${REGISTRY}
                        docker tag ${DOCKER_IMAGE} ${REGISTRY}/${DOCKER_IMAGE}
                        docker push ${REGISTRY}/${DOCKER_IMAGE}
                    """
                }
            }
        }
        
        stage('Deploy to Staging') {
            steps {
                sh "kubectl set image deployment/myapp myapp=${REGISTRY}/${DOCKER_IMAGE} --namespace=staging"
            }
        }
        
        stage('Integration Tests') {
            steps {
                sh 'mvn verify -Pintegration-tests'
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                input 'Deploy to Production?'
                sh "kubectl set image deployment/myapp myapp=${REGISTRY}/${DOCKER_IMAGE} --namespace=production"
            }
        }
    }
    
    post {
        success {
            echo 'Pipeline succeeded!'
            cleanWs()
        }
        failure {
            echo 'Pipeline failed!'
            mail to: 'team@example.com',
                 subject: "Build Failed: ${env.JOB_NAME} ${env.BUILD_NUMBER}",
                 body: "Check console output at ${env.BUILD_URL}"
        }
        always {
            echo 'Pipeline completed'
        }
    }
}
```

### Scripted Pipeline
```groovy
node {
    def mvnHome = tool 'Maven 3.8'
    
    stage('Checkout') {
        checkout scm
    }
    
    stage('Build') {
        sh "${mvnHome}/bin/mvn clean package"
    }
    
    stage('Test') {
        sh "${mvnHome}/bin/mvn test"
    }
    
    stage('Deploy') {
        if (env.BRANCH_NAME == 'main') {
            sh './deploy.sh'
        }
    }
}
```

## Key Jenkins Features

### 1. Multibranch Pipelines
Automatically create pipelines for each branch in your repository:

```groovy
// Jenkinsfile in repository
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                sh 'mvn clean package'
            }
        }
    }
}
```

### 2. Parallel Execution
Run stages in parallel to reduce pipeline time:

```groovy
pipeline {
    agent any
    stages {
        stage('Parallel Tests') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh 'mvn test'
                    }
                }
                stage('Integration Tests') {
                    steps {
                        sh 'mvn verify -Pintegration-tests'
                    }
                }
                stage('Security Scan') {
                    steps {
                        sh 'trivy image myapp:latest'
                    }
                }
            }
        }
    }
}
```

### 3. Matrix Builds
Test across multiple configurations:

```groovy
pipeline {
    agent any
    axes {
        axis {
            name 'JDK_VERSION'
            values '11', '17', '21'
        }
        axis {
            name 'OS'
            values 'linux', 'windows'
        }
    }
    stages {
        stage('Build and Test') {
            steps {
                sh "mvn clean test -Djdk.version=${JDK_VERSION}"
            }
        }
    }
}
```

### 4. Shared Libraries
Reuse common pipeline logic across projects:

```groovy
// In vars/myLibrary.groovy
def call(Map config) {
    pipeline {
        agent any
        stages {
            stage('Build') {
                steps {
                    sh "mvn clean package ${config.args}"
                }
            }
            stage('Test') {
                steps {
                    sh 'mvn test'
                }
            }
        }
    }
}

// In Jenkinsfile
@Library('my-shared-library') _
myLibrary(args: '-DskipTests')
```

## Essential Plugins

### Build Tools
- **Maven Integration**: Maven project support
- **Gradle Plugin**: Gradle build support
- **Node.js Plugin**: Node.js/npm support

### Source Code Management
- **Git Plugin**: Git integration
- **GitHub Plugin**: GitHub organization support
- **Bitbucket Plugin**: Bitbucket integration

### Build Triggers
- **GitLab Plugin**: GitLab webhooks and integration
- **GitHub Branch Source**: Multi-branch GitHub projects
- **Poll SCM**: Periodic SCM polling

### Deployment
- **Kubernetes Plugin**: Kubernetes deployment
- **Docker Plugin**: Docker build and publish
- **AWS Plugins**: AWS deployment tools

### Quality & Testing
- **JUnit Plugin**: Test result reporting
- **SonarQube Scanner**: Code quality analysis
- **Cobertura Plugin**: Code coverage

### Notifications
- **Email Extension**: Enhanced email notifications
- **Slack Notification**: Slack integration
- **Microsoft Teams Notification**: Teams integration

## Best Practices

### 1. Use Pipeline as Code
- Store Jenkinsfile in version control
- Treat pipeline configuration like application code
- Enable code review for pipeline changes

### 2. Secure Credentials
```groovy
// Use Jenkins credentials store
withCredentials([usernamePassword(
    credentialsId: 'aws-credentials',
    usernameVariable: 'AWS_ACCESS_KEY_ID',
    passwordVariable: 'AWS_SECRET_ACCESS_KEY'
)]) {
    sh 'aws s3 cp file.txt s3://my-bucket/'
}
```

### 3. Use Agents Wisely
```groovy
// Label agents for specific purposes
pipeline {
    agent { label 'docker' }
    stages {
        stage('Build') {
            agent { label 'maven' }
            steps {
                sh 'mvn clean package'
            }
        }
        stage('Docker Build') {
            agent { label 'docker' }
            steps {
                sh 'docker build -t myapp .'
            }
        }
    }
}
```

### 4. Implement Proper Cleanup
```groovy
post {
    always {
        cleanWs()  // Clean workspace after build
    }
}
```

### 5. Use Parameters for Flexibility
```groovy
pipeline {
    agent any
    parameters {
        string(name: 'VERSION', defaultValue: '1.0.0', description: 'Application version')
        choice(name: 'ENVIRONMENT', choices: ['staging', 'production'], description: 'Deployment environment')
        booleanParam(name: 'RUN_TESTS', defaultValue: true, description: 'Run tests?')
    }
    stages {
        stage('Deploy') {
            steps {
                sh "./deploy.sh ${params.VERSION} ${params.ENVIRONMENT}"
            }
        }
    }
}
```

## Triggers

### Webhook Triggers
```groovy
pipeline {
    agent any
    triggers {
        gitlab(
            triggerOnPush: true,
            triggerOnMergeRequest: true,
            branchFilterType: 'NameBasedFilter',
            includeBranches: ['main', 'develop']
        )
    }
    stages {
        stage('Build') {
            steps {
                sh 'mvn clean package'
            }
        }
    }
}
```

### Scheduled Triggers
```groovy
pipeline {
    agent any
    triggers {
        cron('H 2 * * *')  // Run daily at 2 AM
    }
    stages {
        stage('Nightly Build') {
            steps {
                sh 'mvn clean package'
            }
        }
    }
}
```

### Poll SCM
```groovy
pipeline {
    agent any
    triggers {
        pollSCM('H/5 * * * *')  // Poll every 5 minutes
    }
    stages {
        stage('Build') {
            steps {
                sh 'mvn clean package'
            }
        }
    }
}
```

## Monitoring and Reporting

### Build Status Badges
```
https://jenkins.example.com/job/myproject/badge/icon
```

### Build Metrics
- Build duration trends
- Success/failure rates
- Test pass rates
- Code coverage trends

### Notifications
```groovy
post {
    failure {
        slackSend(
            color: 'danger',
            message: "Build failed: ${env.JOB_NAME} ${env.BUILD_NUMBER}"
        )
    }
    success {
        slackSend(
            color: 'good',
            message: "Build succeeded: ${env.JOB_NAME} ${env.BUILD_NUMBER}"
        )
    }
}
```

## Security Considerations

### 1. Role-Based Access Control
- Configure matrix authorization
- Limit permissions by user/group
- Separate read/write/admin access

### 2. CSRF Protection
- Enable CSRF protection
- Use crumb tokens for API calls

### 3. Agent Security
- Use sandboxed agents
- Restrict agent permissions
- Isolate production environments

### 4. Secret Management
- Use Jenkins credentials store
- Never hardcode secrets in Jenkinsfile
- Rotate credentials regularly

### 5. Plugin Management
- Keep plugins updated
- Remove unused plugins
- Review plugin permissions

## Performance Optimization

### 1. Use Build Agents
- Distribute builds across multiple agents
- Use Docker agents for ephemeral builds
- Configure appropriate agent labels

### 2. Optimize Workspace Usage
- Clean workspaces after builds
- Use lightweight checkout
- Cache dependencies

### 3. Parallel Execution
- Run independent stages in parallel
- Use matrix builds for testing
- Optimize pipeline structure

### 4. Artifact Management
- Archive only necessary artifacts
- Use external artifact repositories
- Clean old artifacts regularly

## Troubleshooting

### View Logs
- Console output for each stage
- Agent logs
- Master system logs

### Common Issues
- **Workspace permission errors**: Check agent permissions
- **Plugin conflicts**: Review plugin versions
- **Memory issues**: Increase JVM heap size
- **Network timeouts**: Check connectivity to external services

### Debug Mode
```groovy
// Enable debug logging
options {
    timestamps()
    ansiColor('xterm')
    timeout(time: 1, unit: 'HOURS')
}
```

## Jenkins vs Other CI/CD Tools

| Feature | Jenkins | GitHub Actions | GitLab CI | CircleCI |
|---------|---------|----------------|-----------|----------|
| Open Source | Yes | No (limited) | Yes | No |
| Self-hosted | Yes | Yes (Enterprise) | Yes | No |
| Plugin Ecosystem | Extensive | Growing | Good | Limited |
| Learning Curve | Steep | Moderate | Moderate | Easy |
| Integration | Excellent | Excellent (GitHub) | Excellent (GitLab) | Good |
| Scalability | High | High | High | High |

## Further Reading

- **Jenkins Documentation**: https://www.jenkins.io/doc/
- **Jenkins Pipeline Syntax**: https://www.jenkins.io/doc/book/pipeline/syntax/
- **Jenkins Shared Libraries**: https://www.jenkins.io/doc/book/pipeline/shared-libraries/
- **Jenkins Security**: https://www.jenkins.io/doc/book/security/

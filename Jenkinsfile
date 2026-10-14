// Sagar Classes – CI/CD pipeline
// Jenkins machine par Docker + Docker Compose installed hona chahiye.
// Windows aur Linux dono par chalta hai.

pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 20, unit: 'MINUTES')
    }

    environment {
        COMPOSE_PROJECT_NAME = 'sagar'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Validate') {
            steps {
                run('docker --version')
                run('docker compose version')
                run('docker compose config -q')
            }
        }

        stage('Build Images') {
            steps {
                run('docker compose build')
            }
        }

        stage('Deploy') {
            steps {
                run('docker compose up -d')
            }
        }

        stage('Smoke Test') {
            steps {
                // backend health (container ke andar se, curl ki zaroorat nahi)
                retry(6) {
                    sleep(time: 5, unit: 'SECONDS')
                    run('docker compose exec -T backend wget -qO- http://127.0.0.1:3000/health')
                }
                // frontend (nginx) homepage
                run('docker compose exec -T frontend wget -qO- http://127.0.0.1/index.html')
                // prometheus ready
                run('docker compose exec -T prometheus wget -qO- http://127.0.0.1:9090/-/ready')
            }
        }
    }

    post {
        success {
            echo 'Deploy successful -> Website: http://localhost:8081 | Prometheus: http://localhost:9091'
        }
        failure {
            echo 'Build failed - last container logs:'
            run('docker compose logs --tail=50')
        }
    }
}

// Linux (sh) aur Windows (bat) dono ke liye ek helper
def run(String cmd) {
    if (isUnix()) {
        sh cmd
    } else {
        bat cmd
    }
}

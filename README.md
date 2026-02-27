# AI Tutor GIS

[![Vue.js](https://img.shields.io/badge/Vue.js-3-4FC08D?style=for-the-badge&logo=vue.js)](https://vuejs.org/)
[![Python](https://img.shields.io/badge/Python-3.x-3776AB?style=for-the-badge&logo=python)](https://www.python.org/)
[![n8n](https://img.shields.io/badge/n8n-Workflow_Automation-1A82E4?style=for-the-badge&logo=n8n)](https://n8n.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-336791?style=for-the-badge&logo=postgresql)](https://postgis.net/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)

An intelligent learning assistant for students of a PostGIS database course. Powered by an LLM-driven agentic workflow, it provides conceptual explanations and generates correct SQL solutions for exercises.

## Table of Contents

- [Project Vision](#-project-vision)
- [Core Features](#-core-features)
- [Architecture Overview](#-architecture-overview)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Developer Operations](#️-developer-operations)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## 🎯 Project Vision

The goal of the PostGIS AI Tutor is to act as an expert, 24/7 teaching assistant. Traditional learning can be frustrating when a student is stuck on a concept or a practical exercise outside of class hours. This application bridges that gap by understanding a student's questions and providing tailored assistance, whether they need a theoretical explanation or a practical SQL query.

## ✨ Core Features

- **Dual-Capability Agent:** An intelligent agent, orchestrated by **n8n**, that determines the user's intent.
- **Conceptual Q&A (RAG):** For theoretical questions, the agent uses Retrieval-Augmented Generation (RAG) to query a vector database (populated with course materials) and provide comprehensive, context-aware answers.
- **SQL Query Generation:** For practical exercises, the agent uses its knowledge of the course's PostGIS database schema to generate valid and accurate SQL queries.
- **Interactive Frontend:** A clean and modern web interface built with Vue 3 for a seamless user experience.

## 🏗️ Architecture Overview

The application is composed of several microservices that work together. The user interacts with the Vue.js frontend, which communicates with a Python backend. The backend then triggers an **n8n workflow**, which is the "brain" of the operation. This workflow uses an LLM to decide whether to fetch information from the **RAGFlow** knowledge base or to inspect the **PostGIS** database schema to help construct a SQL query.

## ⚙️ Tech Stack

- **Frontend:** [Vue 3](https://vuejs.org/)
- **Backend:** [Python](https://www.python.org/) (FastAPI)
- **Workflow Automation:** [n8n](https://n8n.io/)
- **RAG & Vector DB:** [RAGFlow](https://ragflow.io/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) with [PostGIS](https://postgis.net/) extension
- **Containerization:** [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

## 📁 Project Structure

```
.
├── n8n/                      # n8n workflow files and configurations
├── n8n_tutor_backend/        # Python FastAPI backend service
├── n8n_tutor_client/         # Vue 3 frontend application
├── architecture.md           # Detailed architecture documentation
├── docker-compose.yml        # Main application services
├── .env.example              # Environment variables template
├── LICENSE                   # MIT License
└── README.md                 # This file
```

**Key Directories:**

- **n8n/**: Contains workflow definitions used by the n8n automation engine
- **n8n_tutor_backend/**: FastAPI application that handles API requests and communicates with n8n
- **n8n_tutor_client/**: Vue 3 single-page application serving the web interface

For detailed architectural information, see [architecture.md](architecture.md).

---

## 🚀 Getting Started

Follow these steps to set up and run the entire application stack on your local machine. The installation is divided into setting up the dependencies (RAGFlow) and then setting up the main application.

### Prerequisites

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/products/docker-desktop/) & [Docker Compose](https://docs.docker.com/compose/install/) (v20.10+)
- [Node.js](https://nodejs.org/en/) (v18 or later) — for development only
- [Python](https://www.python.org/downloads/) (v3.9 or later) — for development only

> **Note:** Docker Desktop includes Docker Compose. If using Docker CLI directly, install [Docker Compose separately](https://docs.docker.com/compose/install/).

### Step 1: Clone Repositories

Clone this repository and RAGFlow into the same parent directory:

```bash
git clone <this-repository-url> ai-tutor-gis
git clone https://github.com/infiniflow/ragflow.git ragflow
cd ai-tutor-gis
```

**Directory structure after cloning:**

```
parent-directory/
├── ai-tutor-gis/      (this repository)
└── ragflow/           (RAGFlow dependency)
```

> All subsequent commands should be run from the `ai-tutor-gis` directory.

### Step 2: Create a Shared Docker Network

Services (RAGFlow, n8n, PostgreSQL) need to communicate with each other across containers. Create a shared Docker network:

```bash
docker network create shared-net
```

### Step 3: Configure and Launch RAGFlow

The RAG system is a dependency and must be configured to use our shared network.

1. **Modify RAGFlow's Docker Compose file:**
    Open `../ragflow/docker/docker-compose.yml` and `../ragflow/docker/docker-compose-base.yml`. In both files, find the `networks:` section and change `default` to `shared-net`. It should look like this:

    ```yaml
    networks:
      - shared-net
    ```

    Then, at the very bottom of both files, define the network as external:

    ```yaml
    networks:
      shared-net:
        external: true
    ```

2. **Launch RAGFlow:**
    Navigate to the RAGFlow docker directory and start its services.

    ```bash
    cd ../ragflow/docker
    docker-compose up -d
    ```

### Step 4: Configure the PostGIS AI Tutor

1. **Set Up Environment Variables:**
    Create a `.env` file from the example. This file holds all your credentials and keys.

    ```bash
    cp .env.example .env
    ```

2. **Get RAGFlow API Key:**
    - Open the RAGFlow UI in your browser: `http://localhost:80` (or the port you configured).
    - Navigate to **User Setting -> API Key** and create a new API key.
    - Copy the key.

3. **Update `.env` file:**
    - Open the `.env` file you created.
    - Paste the RAGFlow API key into the `RAGFLOW_API_KEY` variable.
    - Fill in the other required credentials (e.g., for PostgreSQL, n8n).

4. **Set up a default processing model:**
    - Open the **User Settings** in the RAGFlow UI.
    - Search for **Models**.
    - Fill in the your desired models and set up default models for each task.

### Step 5: Launch Core Services

Now, build and launch the main application's Docker containers (n8n, PostgreSQL).

```bash
# This command builds the custom images and starts all services in the background.
docker-compose up --build -d
```

### Step 6: Populate the Knowledge Base

You need to run a one-time setup workflow in n8n to upload your course documents and create the RAGFlow agent.

1. Open the n8n UI in your browser: `http://localhost:5678`.
2. Find and manually run the workflow named **`insert_documents_ragflow`**. This will:
    - Create a new dataset in RAGFlow.
    - Upload the course files.
    - Create the chat agent required by the application.

## 🛠️ Developer Operations

### Database Access

You can connect directly to the PostgreSQL instance to inspect data or debug issues.

- **Connect to the PostGIS subject database:**

    ```bash
    docker-compose exec postgres psql -U your_user_from_env -d geo
    ```

- **Connect to the n8n database:**

    ```bash
    docker-compose exec postgres psql -U your_user_from_env -d n8n_database
    ```

### Managing n8n Workflows

It's good practice to back up your n8n workflows and credentials.

- **Export all workflows to a JSON file:**

    ```bash
    docker-compose exec n8n n8n export:workflow --all --output=/data/workflows.json
    ```

- **Export all credentials (encrypted):**
    > **Note:** You need your `N8N_ENCRYPTION_KEY` from the `.env` file to restore these credentials on a new instance.

    ```bash
    docker-compose exec n8n n8n export:credentials --all --output=/data/credentials.json
    ```

### Stopping the Application

To stop all running services:

```bash
docker-compose down
```

To stop and remove all data volumes (e.g., to start fresh):

```bash
docker-compose down -v
```

### Quick Reference

**Essential URLs:**

- **Frontend:** `http://localhost:3000` (Vue.js app)
- **Backend API:** `http://localhost:8000` (FastAPI)
- **n8n:** `http://localhost:5678` (Workflow automation)
- **RAGFlow:** `http://localhost:80` (Knowledge base & RAG)
- **PostgreSQL:** `localhost:5432` (Database)

**Essential Commands:**

```bash
# Start all services
docker-compose up -d

# View logs for a service
docker-compose logs -f <service-name>

# Access database
docker-compose exec postgres psql -U <user> -d <database>

# Check service status
docker-compose ps

# Rebuild services
docker-compose up --build -d
```

## 🐛 Troubleshooting

### Common Issues and Solutions

#### Services can't communicate with each other

**Problem:** Services in different containers can't reach each other (e.g., backend can't reach n8n).

**Solution:** Verify the shared Docker network exists and all containers are connected:

```bash
docker network inspect shared-net
docker-compose ps  # Check that all services are running
```

#### RAGFlow not responding on localhost:80

**Problem:** Can't access RAGFlow at `http://localhost:80`.

**Solutions:**

- Check if RAGFlow containers are running: `docker ps | grep ragflow`
- Check RAGFlow logs: `cd ../ragflow/docker && docker-compose logs`
- Verify the port isn't in use: `lsof -i :80` (macOS/Linux) or `netstat -ano | findstr :80` (Windows)

#### n8n can't connect to RAGFlow

**Problem:** n8n workflows fail with RAGFlow connection errors.

**Solutions:**

- Verify your `RAGFLOW_API_KEY` in `.env` is correct
- Ensure RAGFlow is fully initialized (wait ~1-2 minutes after starting)
- Check that both services are on the `shared-net` network
- Test connectivity from n8n container: `docker-compose exec n8n curl http://ragflow:9380/health`

#### PostgreSQL connection failures

**Problem:** Backend can't connect to PostgreSQL database.

**Solutions:**

- Verify PostgreSQL credentials in `.env` match `docker-compose.yml`
- Check that PostgreSQL is running: `docker-compose ps postgres`
- Verify the PostGIS extension is installed:

  ```bash
  docker-compose exec postgres psql -U your_user -d geo -c "SELECT postgis_version();"
  ```

#### Port conflicts

**Problem:** Services fail to start due to port already in use.

**Solutions:**

- Identify what's using the port: `lsof -i :<port>` (macOS/Linux)
- Change the port in `docker-compose.yml` or `.env`
- Stop conflicting services and restart

### Getting Help

1. Check the detailed [architecture.md](architecture.md) for system design information
2. Review container logs: `docker-compose logs -f <service-name>`
3. Verify all `.env` variables are correctly set
4. Ensure RAGFlow is fully initialized before starting the main application

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Create a new branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Test thoroughly (especially workflows in n8n and backend API)
4. Commit with clear messages: `git commit -m "Add feature description"`
5. Push your branch: `git push origin feature/your-feature-name`
6. Open a Pull Request with a description of your changes

### Development Notes

- **n8n Workflows:** Test workflows in the n8n UI before committing
- **Backend:** Run tests and ensure API endpoints work correctly
- **Frontend:** Test UI responsiveness and functionality across browsers
- **Database:** Verify migrations and PostGIS functions work as expected

## 📚 Resources

### Documentation

- [Project Architecture](architecture.md) — Detailed system design and data flow
- [n8n Documentation](https://docs.n8n.io/)
- [RAGFlow Documentation](https://docs.ragflow.io/)
- [PostGIS Manual](https://postgis.net/documentation/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Vue 3 Guide](https://vuejs.org/guide/introduction.html)

### Related Repositories

- [RAGFlow](https://github.com/infiniflow/ragflow)
- [n8n](https://github.com/n8n-io/n8n)
- [PostGIS](https://github.com/PostGIS/postgis)

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

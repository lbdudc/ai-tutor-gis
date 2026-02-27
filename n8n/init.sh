#!/bin/bash

# Wait a bit for containers to settle
sleep 10

# Wait until Postgres is ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h "$POSTGRES_HOST" -p 5432 -U "$POSTGRES_USER"; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done
echo "PostgreSQL is ready."


# Import workflows
echo "Importing workflows..."
n8n import:workflow --input=/data/workflows.json
n8n update:workflow --id=grI4QevB8CqgdHRZ --active=true

# Import credentials
echo "Importing credentials..."
n8n import:credentials --input=/data/credentials.json

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

# Start n8n
echo "Starting n8n..."
n8n start

FROM n8nio/n8n:latest

USER root

# Install system dependencies and Python packages
RUN apk add --no-cache \
    python3 \
    py3-pip \
    postgresql-client \
    py3-psycopg2 \
    py3-dotenv \
    py3-passlib \
    py3-bcrypt \
    && pip3 install --no-cache-dir --break-system-packages -U pip

USER node
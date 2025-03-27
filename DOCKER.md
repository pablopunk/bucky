# Docker Support for Bucky Backup Manager

Bucky Backup Manager is available as a Docker image for easy deployment. This document provides instructions for using the Docker image.

## Available Images

Docker images are automatically built and published to GitHub Container Registry (GHCR) on each commit to the main branch.

- Latest version: `ghcr.io/pablopunk/bucky:latest`
- Specific commit: `ghcr.io/pablopunk/bucky:[commit-hash]`

## Usage

### Pull the Image

```bash
docker pull ghcr.io/pablopunk/bucky:latest
```

### Run the Container

Basic usage:

```bash
docker run -d \
  --name bucky \
  -p 3000:3000 \
  -v bucky-data:/app/data \
  ghcr.io/pablopunk/bucky:latest
```

### Environment Variables

You can configure the application using environment variables:

```bash
docker run -d \
  --name bucky \
  -p 3000:3000 \
  -v bucky-data:/app/data \
  -e DATABASE_PATH=/app/data/bucky.db \
  -e NODE_ENV=production \
  ghcr.io/pablopunk/bucky:latest
```

### Volumes

The application stores data in the `/app/data` directory. To persist this data, mount a volume to this path:

```bash
docker volume create bucky-data

docker run -d \
  --name bucky \
  -p 3000:3000 \
  -v bucky-data:/app/data \
  ghcr.io/pablopunk/bucky:latest
```

### Docker Compose

Here's an example `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  bucky:
    image: ghcr.io/pablopunk/bucky:latest
    container_name: bucky
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - bucky-data:/app/data
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/bucky.db

volumes:
  bucky-data:
```

Run with:

```bash
docker-compose up -d
```

## Building Locally

If you want to build the Docker image locally, you can use:

```bash
docker build -t bucky:local .
```

## Health Checks

The Docker image includes a health check that verifies the application is running properly by checking the `/api/health` endpoint every 30 seconds.

## Troubleshooting

If you encounter issues:

1. Check the container logs: `docker logs bucky`
2. Verify the volume permissions are correct
3. Ensure port 3000 is not already in use on your host machine 
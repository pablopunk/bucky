FROM oven/bun:1 AS builder

# Set timezone
RUN ln -snf /usr/share/zoneinfo/UTC /etc/localtime && echo UTC > /etc/timezone

WORKDIR /app

# Copy package files first for better caching
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy the rest of the application
COPY . .

# Build the application
RUN bun run build

FROM oven/bun:1

# We need rclone on the server, not the builder image
RUN apt-get update && apt-get install -y \
    rclone \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/app ./app
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/components ./components
COPY --from=builder /app/scripts ./scripts

# Create directory for logs and database
RUN mkdir -p /app/logs /app/db

# Create a non-root user and set permissions
RUN groupadd -g 1001 bucky && \
    useradd -u 1001 -g bucky -s /bin/sh -m bucky && \
    chown -R bucky:bucky /app

# Switch to non-root user
USER bucky

# Expose the port the app runs on
EXPOSE 3000

# Define volumes for persistence
VOLUME ["/app/logs", "/app/db"]

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Command to run the app
CMD ["bun", "start"] 
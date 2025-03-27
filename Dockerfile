FROM oven/bun:1 as builder

# Set timezone
RUN ln -snf /usr/share/zoneinfo/UTC /etc/localtime && echo UTC > /etc/timezone

# We don't need build dependencies anymore with Bun's SQLite

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

WORKDIR /app

# Copy built application and node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Create directory for logs and database
RUN mkdir -p /app/logs /app/db

# Expose the port the app runs on
EXPOSE 3000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Command to run the app
CMD ["bun", "start"] 
# Maritime CBOR Compression Service - Multi-stage Docker build
FROM node:18-alpine AS base

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    bash

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY . .

# Create data directory
RUN mkdir -p /app/data && chown -R node:node /app/data

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache sqlite bash

WORKDIR /app

# Copy from base stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./
COPY --from=base /app/*.js ./
COPY --from=base --chown=node:node /app/data ./data

# Switch to non-root user
USER node

# Environment variables
ENV NODE_ENV=production
ENV NODE_MODE=master
ENV PORT=3000

# Health check (commented out - like previous implementation)
# HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
#     CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "server.js"] 
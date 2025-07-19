# Multi-stage build for smaller final image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S maritime -u 1001

# Copy built dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY . .

# Create data directory for SQLite database with proper permissions
RUN mkdir -p /app/data && \
    chown -R maritime:nodejs /app

# Switch to non-root user
USER maritime

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"] 
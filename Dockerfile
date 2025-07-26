# ESP32 Hybrid TN/NTN IoT Pipeline Dockerfile
# Single Dockerfile for both Encoder (Local) and Decoder (VM) modes

FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy all application files
COPY *.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Default command - will be overridden by docker-compose
CMD ["node", "esp32-encoder.js"] 
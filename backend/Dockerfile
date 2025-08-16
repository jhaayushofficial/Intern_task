# Backend API Dockerfile
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files first to leverage layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production || npm ci

# Copy source
COPY . .

# Environment
ENV NODE_ENV=production
ENV PORT=3000
# Neo4j defaults can be overridden at runtime via env
ENV NEO4J_URI=bolt://neo4j:7687
ENV NEO4J_USERNAME=neo4j
ENV NEO4J_PASSWORD=test

# Expose API port
EXPOSE 3000

# Start the server
CMD ["node", "src/index.js"]

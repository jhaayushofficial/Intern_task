# Frontend Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
# Copy compiled static assets
COPY --from=build /app/dist /usr/share/nginx/html
# Default Nginx exposes 80
EXPOSE 80
# Healthcheck (optional)
HEALTHCHECK CMD wget -qO- http://localhost/ || exit 1

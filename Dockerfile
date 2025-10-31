# frontend
FROM node:18 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
RUN npm run build

# backend
FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY proxy_backend/requirements.txt .
RUN pip config set global.index-url https://pypi.org/simple \
 && pip config set global.timeout 120

RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY proxy_backend/ ./proxy_backend

# Copy frontend build into backend static dir
COPY --from=frontend-builder /app/frontend/dist ./static

# Expose the port Cloud Run expects. Use PORT environment at runtime.
ENV PORT=8080
EXPOSE 8080

# Use uvicorn to start FastAPI
CMD ["uvicorn", "proxy_backend.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--timeout-keep-alive", "5"]

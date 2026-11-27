# Step 1: build the React frontend
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Step 2: Python backend that also serves the built frontend
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=frontend /app/frontend/dist frontend/dist
WORKDIR /app/backend
ENV PORT=8000
EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}

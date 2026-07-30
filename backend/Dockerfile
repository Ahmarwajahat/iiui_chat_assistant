FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY backend /app/backend
COPY task/docs /app/task/docs
COPY task/scraped_output /app/task/scraped_output

# Hugging Face Spaces port requirement (7860)
EXPOSE 7860

# Run FastAPI app on port 7860
CMD ["uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "7860"]

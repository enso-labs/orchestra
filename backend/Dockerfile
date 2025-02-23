# Stage 1: Build stage
FROM python:3.11.2-slim AS builder

# Set work directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copy requirements file
COPY requirements.txt .

# Install system dependencies required for building Python packages
RUN apt-get update && apt-get install --no-install-recommends -y \
    wget build-essential python3-dev libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --upgrade pip \
    && pip install uv \
    && uv pip install -v --system --no-cache-dir -r requirements.txt

# Stage 2: Final stage
FROM python:3.11.2-slim

# Set work directory
WORKDIR /app

# Set environment variables; note that PLAYWRIGHT_BROWSERS_PATH=0 installs browsers into the project folder.
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_BROWSERS_PATH=0

# Install runtime dependencies plus minimal OS libraries required by Playwright browsers.
RUN apt-get update && apt-get install --no-install-recommends -y \
    libpq5 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Copy over the Python packages and binaries from the builder stage
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy the rest of your application code
COPY . .

# Install Playwright browsers (downloads Chromium, Firefox, and WebKit)
RUN playwright install

# Start the FastAPI application using uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

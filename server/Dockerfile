FROM runpod/base:0.4.0-cuda11.8.0

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libxi-dev \
    libglu1-mesa-dev \
    libglew-dev \
    pkg-config \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm ci --production

# Copy application code
COPY r10-server-renderer.js ./
COPY raptor-svg.svg ./

# Create temp directories
RUN mkdir -p /tmp/frames

# Expose port (if needed for health checks)
EXPOSE 8000

# RunPod handler
CMD ["python3", "-u", "/app/runpod_handler.py"]

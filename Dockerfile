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
    python3-pip \
    libpixman-1-dev \
    libpangocairo-1.0-0 \
    mesa-utils \
    xvfb \
    libgl1-mesa-dev \
    libgl1-mesa-dri \
    libglapi-mesa \
    libosmesa6 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

# Copy Python requirements and install
COPY server/requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy package files
COPY server/package.json server/package-lock.json ./

# Install Node dependencies
RUN npm install --production

# Copy application code
COPY server/renderer.js ./
COPY server/runpod_handler.py ./
COPY server/cloud_storage.py ./
COPY server/raptor-bw.png ./

# Create temp directories
RUN mkdir -p /tmp/frames

# Expose port (if needed for health checks)
EXPOSE 8000

# RunPod handler
CMD ["python3", "-u", "/app/runpod_handler.py"]

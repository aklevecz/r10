#!/bin/bash
# setup-server-rendering.sh
# This script sets up server-side rendering in your r10 project

set -e

echo "🚀 Setting up R10 Server-Side Rendering"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this from your project root."
    exit 1
fi

# Create server directory
echo "📁 Creating server directory..."
mkdir -p server
cd server

# Copy files from Claude's workspace
echo "📋 Copying server files..."

# You'll need to copy these files manually or I can create them inline
# For now, let's create a package.json for the server
cat > package.json << 'EOF'
{
  "name": "r10-server-renderer",
  "version": "1.0.0",
  "type": "module",
  "description": "Server-side audio-reactive WebGL renderer",
  "main": "renderer.js",
  "scripts": {
    "start": "node renderer.js",
    "test": "node test.js",
    "build": "docker build -t r10-renderer ."
  },
  "dependencies": {
    "gl": "^6.0.2",
    "canvas": "^2.11.2",
    "node-fetch": "^3.3.2",
    "fft.js": "^4.0.3"
  },
  "devDependencies": {
    "@types/node": "^20.10.0"
  }
}
EOF

echo "✅ Created server/package.json"

# Create .gitignore for server
cat > .gitignore << 'EOF'
node_modules/
*.log
/tmp/
test-output.mp4
.env
.env.local
EOF

echo "✅ Created server/.gitignore"

cd ..

# Update main project to include client API
echo "📦 Adding client API to main project..."

mkdir -p src/lib/api

cat > src/lib/api/server-renderer.ts << 'EOF'
/**
 * Client API for R10 Server-Side Rendering
 * Connects your Svelte app to the RunPod endpoint
 */

export interface RenderParams {
  audioUrl: string;
  distortionType: number;
  trailHue: number;
  trailSat: number;
  trailLight: number;
  svgUrl?: string;
}

export interface RenderResponse {
  status: 'success' | 'error';
  video?: string;
  message?: string;
  error?: string;
}

export class ServerRenderer {
  private endpoint: string;
  private apiKey: string;

  constructor(endpoint?: string, apiKey?: string) {
    this.endpoint = endpoint || import.meta.env.VITE_RUNPOD_ENDPOINT || '';
    this.apiKey = apiKey || import.meta.env.VITE_RUNPOD_API_KEY || '';
  }

  /**
   * Submit a render job to RunPod
   */
  async submitJob(params: RenderParams): Promise<{ jobId: string }> {
    if (!this.endpoint || !this.apiKey) {
      throw new Error('RunPod endpoint and API key must be configured');
    }

    const response = await fetch(`${this.endpoint}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ input: params })
    });

    if (!response.ok) {
      throw new Error(`RunPod API error: ${response.statusText}`);
    }

    const data = await response.json();
    return { jobId: data.id };
  }

  /**
   * Check job status
   */
  async checkStatus(jobId: string): Promise<RenderResponse> {
    const response = await fetch(`${this.endpoint}/status/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.status === 'COMPLETED') {
      return data.output;
    } else if (data.status === 'FAILED') {
      throw new Error(`Render failed: ${data.error || 'Unknown error'}`);
    }

    return { status: 'processing' as any };
  }

  /**
   * Wait for job to complete (with polling)
   */
  async waitForCompletion(jobId: string, maxWaitMs = 300000): Promise<RenderResponse> {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.checkStatus(jobId);
      
      if (result.status === 'success' || result.status === 'error') {
        return result;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Render timeout');
  }

  /**
   * Download video as file
   */
  downloadVideo(base64Video: string, filename = 'r10-visual.mp4') {
    const blob = this.base64ToBlob(base64Video, 'video/mp4');
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private base64ToBlob(base64: string, contentType: string): Blob {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: contentType });
  }
}
EOF

echo "✅ Created src/lib/api/server-renderer.ts"

# Create example .env file
cat > .env.example << 'EOF'
# RunPod Configuration
VITE_RUNPOD_ENDPOINT=https://api.runpod.ai/v2/YOUR_ENDPOINT_ID
VITE_RUNPOD_API_KEY=your_api_key_here
EOF

echo "✅ Created .env.example"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy the server files from Claude into the server/ directory"
echo "2. cd server && npm install"
echo "3. Copy your raptor-svg.svg into server/"
echo "4. Update your AudioVisualizerWebGL.svelte component (see below)"
echo "5. Add render button to your UI (see example below)"
echo ""
echo "Need the server files? They're in Claude's response above."

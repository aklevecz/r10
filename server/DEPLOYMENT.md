# R10 RunPod Deployment Guide

## Prerequisites

- Docker installed locally
- RunPod account with credits
- Docker Hub or other container registry account

## Step 1: Prepare Your Files

Ensure you have these files in your project directory:

```
r10-server/
├── r10-server-renderer.js    # Main renderer
├── package.json               # Dependencies
├── Dockerfile                 # Container definition
├── runpod_handler.py          # RunPod wrapper
├── raptor-svg.svg             # Your SVG asset (copy from your Svelte app)
└── README.md                  # Documentation
```

**Important**: Copy `raptor-svg.svg` from your Svelte app's `static/` folder to this directory.

## Step 2: Build Docker Image

```bash
# Build the image
docker build -t r10-renderer:latest .

# Test it works locally
docker run --rm \
  -v $(pwd)/test-input.json:/tmp/input.json \
  r10-renderer:latest \
  node /app/r10-server-renderer.js /tmp/input.json
```

## Step 3: Push to Registry

### Option A: Docker Hub

```bash
# Login
docker login

# Tag image
docker tag r10-renderer:latest YOUR_USERNAME/r10-renderer:latest

# Push
docker push YOUR_USERNAME/r10-renderer:latest
```

### Option B: GitHub Container Registry

```bash
# Login
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Tag image
docker tag r10-renderer:latest ghcr.io/YOUR_USERNAME/r10-renderer:latest

# Push
docker push ghcr.io/YOUR_USERNAME/r10-renderer:latest
```

## Step 4: Create RunPod Endpoint

1. Go to https://www.runpod.io/console/serverless
2. Click "New Endpoint"
3. Configure:

```
Name: r10-renderer
Container Image: YOUR_USERNAME/r10-renderer:latest
GPU Type: RTX 4090 or RTX A6000 (recommended for speed)
Max Workers: 3
Idle Timeout: 5 seconds
Execution Timeout: 300 seconds (5 minutes)
```

4. Under "Advanced":

```
Container Disk: 20GB
Environment Variables:
  - NODE_ENV=production
```

5. Click "Deploy"

## Step 5: Test Your Endpoint

Once deployed, note your:
- **Endpoint ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **API Key**: Get from RunPod settings

Test with curl:

```bash
curl -X POST https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "input": {
      "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      "distortionType": 4,
      "trailHue": 330,
      "trailSat": 100,
      "trailLight": 65,
      "svgUrl": "http://your-app.com/raptor-svg.svg"
    }
  }'
```

You'll get a response like:

```json
{
  "id": "job-xxxxx",
  "status": "IN_QUEUE"
}
```

Check status:

```bash
curl https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/status/job-xxxxx \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Step 6: Integrate with Your App

### Add Environment Variables

```bash
# .env.local
VITE_RUNPOD_ENDPOINT=https://api.runpod.ai/v2/YOUR_ENDPOINT_ID
VITE_RUNPOD_API_KEY=YOUR_API_KEY
```

### Update Your Svelte Component

```typescript
// src/lib/client-api.ts
export const renderer = new R10ServerRenderer(
  import.meta.env.VITE_RUNPOD_ENDPOINT,
  import.meta.env.VITE_RUNPOD_API_KEY
);
```

### Add Render Button to Your UI

```svelte
<script lang="ts">
  import { renderer } from '$lib/client-api';
  
  let isRendering = $state(false);
  let renderStatus = $state('');
  
  async function handleServerRender() {
    isRendering = true;
    renderStatus = 'Submitting...';
    
    try {
      const params = {
        audioUrl: currentSong.url,
        distortionType: visualizer.distortionType,
        trailHue: visualizer.trailHue,
        trailSat: 90,
        trailLight: 60,
        svgUrl: window.location.origin + '/raptor-svg.svg'
      };
      
      const { jobId } = await renderer.submitRenderJob(params);
      renderStatus = 'Rendering...';
      
      const result = await renderer.waitForCompletion(jobId);
      
      if (result.video) {
        renderStatus = 'Downloading...';
        renderer.downloadVideo(result.video);
        renderStatus = 'Complete!';
      }
    } catch (error) {
      renderStatus = `Error: ${error.message}`;
    } finally {
      setTimeout(() => {
        isRendering = false;
        renderStatus = '';
      }, 2000);
    }
  }
</script>

<button 
  onclick={handleServerRender} 
  disabled={isRendering}
  class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
>
  {#if isRendering}
    {renderStatus}
  {:else}
    Generate Video
  {/if}
</button>
```

## Step 7: Optimize Costs

### Auto-scaling Settings

```
Min Workers: 0    (scale to zero when idle)
Max Workers: 3    (limit concurrent jobs)
Idle Timeout: 5s  (shutdown quickly after job)
```

### Cost Monitoring

- RTX 4090: ~$0.60/hour = ~$0.005 per 30-second render
- RTX A6000: ~$0.80/hour = ~$0.007 per 30-second render
- RTX 3090: ~$0.40/hour = ~$0.003 per 30-second render

For 100 videos/month:
- 3-min songs × 100 = ~$0.50-1.00/month (RTX 4090)

## Troubleshooting

### Build Fails

```bash
# Check Docker logs
docker build --no-cache -t r10-renderer:latest .

# Common issues:
# - Missing raptor-svg.svg in directory
# - Node/npm version conflicts
# - Missing system dependencies
```

### Container Won't Start

```bash
# Test container locally
docker run -it --rm r10-renderer:latest /bin/bash

# Check if Node and packages are installed
node --version
npm list
```

### Jobs Timeout

Increase timeout in RunPod settings:
```
Execution Timeout: 300 → 600 seconds
```

Or optimize rendering:
- Use smaller resolution (720p → 540p)
- Reduce FPS (30 → 24)
- Use faster GPU (T4 → A6000)

### Jobs Fail with "Out of Memory"

Increase container disk:
```
Container Disk: 20GB → 40GB
```

Or reduce frame buffer:
```javascript
// In r10-server-renderer.js
const WIDTH = 720;  // Reduce to 540 or 480
const HEIGHT = 720;
```

## Monitoring

### RunPod Dashboard

Monitor:
- Active workers
- Queue depth  
- Average execution time
- Error rate

### Logs

Access logs in RunPod dashboard:
```
Endpoint → Logs → Filter by Job ID
```

### Webhooks (Optional)

Add webhook for job completion:

```bash
curl -X POST https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run \
  -d '{
    "input": {...},
    "webhook": "https://your-app.com/api/webhook"
  }'
```

## Scaling

### High Volume

For >1000 renders/day:

1. Increase max workers: `3 → 10`
2. Use faster GPUs: RTX 4090 or A6000
3. Enable regional distribution
4. Add caching for common parameters

### Load Testing

```bash
# Install k6
brew install k6  # macOS
# or download from k6.io

# Create test script
cat > load-test.js << 'EOF'
import http from 'k6/http';

export let options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 10 },
    { duration: '1m', target: 0 },
  ],
};

export default function () {
  http.post('https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run', 
    JSON.stringify({
      input: {
        audioUrl: '...',
        distortionType: 4,
        trailHue: 330,
        trailSat: 100,
        trailLight: 65
      }
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
      }
    }
  );
}
EOF

# Run test
k6 run load-test.js
```

## Security

### API Key Protection

**Never commit API keys to git!**

```bash
# .gitignore
.env
.env.local
.env.production

# Use environment variables only
```

### Rate Limiting

RunPod has built-in rate limiting. For additional protection:

```typescript
// Add rate limiting in your app
import { rateLimit } from '$lib/utils';

const limiter = rateLimit({
  max: 10,        // 10 renders
  window: 3600000 // per hour
});

async function handleServerRender() {
  if (!limiter.check(userId)) {
    throw new Error('Rate limit exceeded');
  }
  // ... render logic
}
```

### Input Validation

```typescript
function validateParams(params: RenderParams) {
  if (!params.audioUrl?.startsWith('https://')) {
    throw new Error('Invalid audio URL');
  }
  
  if (params.distortionType < 0 || params.distortionType > 4) {
    throw new Error('Invalid distortion type');
  }
  
  if (params.trailHue < 0 || params.trailHue > 360) {
    throw new Error('Invalid hue value');
  }
  
  return true;
}
```

## Next Steps

1. ✅ Deploy to RunPod
2. ✅ Test with sample audio
3. ✅ Integrate with your app
4. 📊 Monitor performance
5. 💰 Optimize costs
6. 🚀 Scale as needed

## Support

- RunPod Docs: https://docs.runpod.io/
- RunPod Discord: https://discord.gg/runpod
- Issues: File in your GitHub repo

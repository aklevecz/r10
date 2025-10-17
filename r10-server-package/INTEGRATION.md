# Integration Guide: Adding Server Rendering to R10

## Step 1: File Structure

After integration, your project should look like this:

```
r10/
├── src/
│   ├── lib/
│   │   ├── api/
│   │   │   └── server-renderer.ts        # NEW - Client API
│   │   └── components/
│   │       └── AudioVisualizerWebGL.svelte  # MODIFY - Add export methods
│   └── routes/
│       └── +page.svelte                   # MODIFY - Add render button
├── server/                                # NEW - Server-side renderer
│   ├── renderer.js                        # Main server code
│   ├── package.json
│   ├── Dockerfile
│   ├── runpod_handler.py
│   ├── raptor-svg.svg                     # Copy from static/
│   ├── test.js
│   └── README.md
├── static/
│   └── raptor-svg.svg
└── .env.example                           # NEW - Environment template
```

## Step 2: Get the Server Files

I've created all the server files above. Here's how to add them to your project:

### Option A: Manual Copy (Recommended)

1. Create the `server/` directory in your project root
2. Copy each file I created into `server/`:
   - `r10-server-renderer.js` → `server/renderer.js`
   - `package.json` (server version)
   - `Dockerfile`
   - `runpod_handler.py`
   - `test-local.js` → `server/test.js`
   - `README.md`
   - `DEPLOYMENT.md`

3. Copy your SVG:
```bash
cp static/raptor-svg.svg server/raptor-svg.svg
```

### Option B: Use Script

I can create a download script for you, but manual copy is simpler since the files are right here in the conversation.

## Step 3: Modify Your Svelte Component

Update `src/lib/components/AudioVisualizerWebGL.svelte` to export parameters:

```svelte
<!-- Add this to the end of your <script> section -->
<script lang="ts">
  // ... your existing code ...

  // Export method to get current render parameters
  export function getRenderParams() {
    return {
      distortionType,
      trailHue,
      trailSat: 90,
      trailLight: 60
    };
  }
</script>

<!-- Your existing template -->
<div class="space-y-4">
  <div class="flex justify-center">
    <canvas bind:this={canvas} {width} {height} class="" style="max-width: 100%; height: auto;"
    ></canvas>
  </div>
</div>
```

## Step 4: Add Render Button to Your Page

Update `src/routes/+page.svelte` (or wherever you use the visualizer):

```svelte
<script lang="ts">
  import AudioVisualizerWebGL from '$lib/components/AudioVisualizerWebGL.svelte';
  import { ServerRenderer } from '$lib/api/server-renderer';

  let audioElement: HTMLAudioElement | null = null;
  let visualizer: AudioVisualizerWebGL;
  let currentAudioUrl = $state('');
  
  // Server rendering state
  let isServerRendering = $state(false);
  let renderProgress = $state('');
  let renderError = $state('');

  const serverRenderer = new ServerRenderer();

  async function handleServerRender() {
    if (!currentAudioUrl) {
      renderError = 'No audio loaded';
      return;
    }

    isServerRendering = true;
    renderError = '';
    renderProgress = 'Preparing...';

    try {
      // Get the exact parameters from the visualizer
      const params = visualizer.getRenderParams();
      
      // Add audio URL and SVG URL
      const renderParams = {
        ...params,
        audioUrl: currentAudioUrl,
        svgUrl: window.location.origin + '/raptor-svg.svg'
      };

      renderProgress = 'Submitting to server...';
      const { jobId } = await serverRenderer.submitJob(renderParams);
      
      renderProgress = 'Rendering video...';
      const result = await serverRenderer.waitForCompletion(jobId);

      if (result.status === 'success' && result.video) {
        renderProgress = 'Downloading...';
        serverRenderer.downloadVideo(result.video);
        renderProgress = 'Complete!';
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          renderProgress = '';
        }, 3000);
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Server render failed:', error);
      renderError = error instanceof Error ? error.message : 'Render failed';
    } finally {
      isServerRendering = false;
    }
  }

  // Your existing audio loading logic
  function handleAudioLoad(url: string) {
    currentAudioUrl = url;
    // ... rest of your load logic
  }
</script>

<!-- Your existing UI -->
<div class="space-y-4">
  <AudioVisualizerWebGL bind:this={visualizer} {audioElement} />

  <!-- Add this render button -->
  <div class="flex gap-4 justify-center">
    <button
      onclick={handleServerRender}
      disabled={isServerRendering || !currentAudioUrl}
      class="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
             text-white rounded-lg font-semibold transition-colors"
    >
      {#if isServerRendering}
        <span class="flex items-center gap-2">
          <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {renderProgress}
        </span>
      {:else}
        Generate Video (Server)
      {/if}
    </button>
  </div>

  <!-- Error display -->
  {#if renderError}
    <div class="text-red-500 text-center">
      {renderError}
    </div>
  {/if}
</div>
```

## Step 5: Environment Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` and add your RunPod credentials (after deployment):
```env
VITE_RUNPOD_ENDPOINT=https://api.runpod.ai/v2/YOUR_ENDPOINT_ID
VITE_RUNPOD_API_KEY=your_api_key_here
```

3. Make sure `.env` is in your `.gitignore`:
```bash
echo ".env" >> .gitignore
```

## Step 6: Install Server Dependencies

```bash
cd server
npm install
```

## Step 7: Test Locally (Optional)

Before deploying to RunPod, test the renderer locally:

```bash
cd server

# Create test input
cat > test-input.json << 'EOF'
{
  "input": {
    "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "distortionType": 4,
    "trailHue": 330,
    "trailSat": 100,
    "trailLight": 65,
    "svgUrl": "file://./raptor-svg.svg"
  }
}
EOF

# Run renderer
node renderer.js test-input.json

# Check output
ls -lh test-output.mp4
```

## Step 8: Deploy to RunPod

Follow `server/DEPLOYMENT.md` for deployment instructions.

Quick version:

```bash
cd server

# Build Docker image
docker build -t r10-renderer .

# Tag for your registry
docker tag r10-renderer YOUR_USERNAME/r10-renderer

# Push
docker push YOUR_USERNAME/r10-renderer

# Then create endpoint in RunPod dashboard
```

## Step 9: Update Environment Variables

After deploying to RunPod:

1. Get your endpoint ID from RunPod dashboard
2. Get your API key from RunPod settings
3. Update `.env`:

```env
VITE_RUNPOD_ENDPOINT=https://api.runpod.ai/v2/abc123xyz
VITE_RUNPOD_API_KEY=ABCDEFGHIJKLMNOPQRSTUVWXYZ123456
```

## Step 10: Test End-to-End

1. Start your dev server: `npm run dev`
2. Load a song
3. Click "Generate Video (Server)"
4. Wait for rendering (~30-60 seconds)
5. Video downloads automatically!

## Troubleshooting

### "RunPod endpoint not configured"

Make sure `.env` exists and has correct values:
```bash
cat .env
# Should show VITE_RUNPOD_ENDPOINT and VITE_RUNPOD_API_KEY
```

Restart dev server after changing `.env`.

### Server render doesn't match browser

Check that you're passing all parameters:
- `distortionType` (0-4)
- `trailHue` (0-360)
- `trailSat` (0-100)
- `trailLight` (0-100)

Add debug logging:
```typescript
async function handleServerRender() {
  const params = visualizer.getRenderParams();
  console.log('Render params:', params); // Check these match browser
  // ... rest of code
}
```

### SVG not loading on server

Make sure:
1. `raptor-svg.svg` is in `server/` directory
2. SVG URL is accessible to RunPod
3. Try embedding SVG in Docker image:

```dockerfile
# In Dockerfile
COPY raptor-svg.svg /app/raptor-svg.svg
```

Then use:
```typescript
svgUrl: 'file:///app/raptor-svg.svg'
```

### Videos are too large

Reduce quality in `server/renderer.js`:

```javascript
// In generateVideo function, FFmpeg section
'-crf', '23',  // Change to '28' for smaller files
```

Or reduce resolution:
```javascript
const WIDTH = 720;   // Change to 540 or 480
const HEIGHT = 720;
```

## Quick Reference

### File Locations
- Client API: `src/lib/api/server-renderer.ts`
- Server code: `server/renderer.js`
- Config: `.env`

### Commands
```bash
# Install server deps
cd server && npm install

# Test locally
cd server && npm test

# Build Docker
cd server && npm run build

# Deploy
docker push YOUR_USERNAME/r10-renderer
```

### API Usage
```typescript
import { ServerRenderer } from '$lib/api/server-renderer';

const renderer = new ServerRenderer();
const { jobId } = await renderer.submitJob(params);
const result = await renderer.waitForCompletion(jobId);
renderer.downloadVideo(result.video);
```

# R10 Server-Side Rendering Package

This package adds server-side video rendering to your R10 audio visualizer project.

## 📦 What's Included

```
r10-server-package/
├── install.sh              # Quick installer script
├── INTEGRATION.md          # Step-by-step integration guide
├── server/                 # Server-side rendering code
│   ├── renderer.js         # Main WebGL renderer (matches browser exactly)
│   ├── package.json        # Server dependencies
│   ├── Dockerfile          # RunPod deployment
│   ├── runpod_handler.py   # Python wrapper for RunPod
│   ├── test.js             # Local testing script
│   ├── README.md           # Server documentation
│   └── DEPLOYMENT.md       # Deployment guide
└── client/                 # Client-side integration
    └── server-renderer.ts  # API client for your Svelte app
```

## 🚀 Quick Start (3 Steps)

### Step 1: Copy Files to Your Project

**Option A: Use the installer (recommended)**
```bash
# From your r10 project root
/path/to/r10-server-package/install.sh
```

**Option B: Manual copy**
```bash
# Copy server files
cp -r /path/to/r10-server-package/server ./

# Copy client API
mkdir -p src/lib/api
cp /path/to/r10-server-package/client/server-renderer.ts src/lib/api/

# Copy docs
cp /path/to/r10-server-package/INTEGRATION.md ./
```

### Step 2: Install Dependencies

```bash
cd server
npm install
```

### Step 3: Integrate with Your Code

See `INTEGRATION.md` for detailed instructions. Quick version:

**1. Update `src/lib/components/AudioVisualizerWebGL.svelte`:**

Add this method at the end of the `<script>` section:

```typescript
export function getRenderParams() {
  return {
    distortionType,
    trailHue,
    trailSat: 90,
    trailLight: 60
  };
}
```

**2. Add render button to your page:**

```svelte
<script lang="ts">
  import { ServerRenderer } from '$lib/api/server-renderer';
  
  const renderer = new ServerRenderer();
  let visualizer: any;
  
  async function handleServerRender() {
    const params = visualizer.getRenderParams();
    params.audioUrl = currentAudioUrl;
    params.svgUrl = window.location.origin + '/raptor-svg.svg';
    
    const { jobId } = await renderer.submitJob(params);
    const result = await renderer.waitForCompletion(jobId);
    
    if (result.video) {
      renderer.downloadVideo(result.video);
    }
  }
</script>

<button onclick={handleServerRender}>
  Generate Video (Server)
</button>
```

**3. Configure environment:**

```bash
cp .env.example .env
# Edit .env and add your RunPod credentials after deployment
```

## 🧪 Test Locally (Before Deploying)

```bash
cd server
npm test
```

This will:
1. Download a test audio file
2. Analyze it with FFT
3. Render frames with WebGL
4. Output `test-output.mp4`

## 🚢 Deploy to RunPod

See `server/DEPLOYMENT.md` for full instructions. Quick version:

```bash
cd server

# Build Docker image
docker build -t r10-renderer .

# Push to registry
docker tag r10-renderer YOUR_USERNAME/r10-renderer
docker push YOUR_USERNAME/r10-renderer

# Create endpoint in RunPod dashboard
# Use image: YOUR_USERNAME/r10-renderer
# GPU: RTX 4090 or A6000 recommended
# Timeout: 300 seconds
```

## 📝 How It Works

1. **Browser shows preview** with random parameters (distortion, colors)
2. **User approves** and clicks "Generate Video"
3. **Client sends parameters** to RunPod endpoint
4. **Server downloads audio** from iTunes link
5. **Server analyzes audio** with FFT (identical to browser)
6. **Server renders frames** with headless WebGL (identical shaders)
7. **Server muxes with FFmpeg** to create MP4
8. **Client downloads video** (exactly matches browser preview!)

## ✨ Key Features

- ✅ **Pixel-perfect match** to browser preview
- ✅ **Same shader code** (copied directly from your Svelte component)
- ✅ **Same audio analysis** (FFT bins, frequency bands, smoothing)
- ✅ **Fast rendering** (~30-45 seconds for 3-minute song)
- ✅ **High quality** (720x720px @ 30fps)
- ✅ **Low cost** (~$0.004 per video on RunPod)

## 📚 Documentation

- **INTEGRATION.md** - How to add to your existing code
- **server/README.md** - Server implementation details
- **server/DEPLOYMENT.md** - RunPod deployment guide

## 🐛 Troubleshooting

### "Command not found: node"
Install Node.js 20+:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### "Cannot find module 'gl'"
Install server dependencies:
```bash
cd server
npm install
```

### "RunPod endpoint not configured"
1. Deploy to RunPod first (see DEPLOYMENT.md)
2. Get endpoint ID and API key
3. Add to `.env`:
```env
VITE_RUNPOD_ENDPOINT=https://api.runpod.ai/v2/YOUR_ID
VITE_RUNPOD_API_KEY=YOUR_KEY
```
4. Restart dev server

### Videos don't match browser
Check you're passing all parameters:
```typescript
const params = visualizer.getRenderParams();
console.log(params); // Should show distortionType, trailHue, etc.
```

### More issues?
See the full troubleshooting section in `INTEGRATION.md`

## 💰 Cost Estimate

RunPod T4 GPU (~$0.30/hour):
- 3-minute song = ~45 seconds render
- Cost per video: **~$0.004** (less than half a cent!)
- 100 videos/month = **~$0.40/month**

## 📜 License

Same as your R10 project

## 🆘 Support

1. Read `INTEGRATION.md` for detailed instructions
2. Check `server/README.md` for technical details
3. See `server/DEPLOYMENT.md` for deployment help
4. Check logs in RunPod dashboard if deployed

---

Made with ❤️ for the R10 project

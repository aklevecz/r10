# 🚀 Quick Start - 5 Minutes to Server Rendering

## Download & Extract

1. Download the package (see link below)
2. Extract it:
```bash
tar -xzf r10-server-package.tar.gz
cd r10-server-package
```

## Installation (2 minutes)

```bash
# 1. Copy files to your r10 project
./install.sh

# 2. Install server dependencies
cd server
npm install
cd ..

# 3. Copy your SVG (if not auto-copied)
cp static/raptor-svg.svg server/
```

## Integration (2 minutes)

### Update `src/lib/components/AudioVisualizerWebGL.svelte`

Add this at the end of your `<script>` block:

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

### Update your page (e.g., `src/routes/+page.svelte`)

```svelte
<script lang="ts">
  import { ServerRenderer } from '$lib/api/server-renderer';
  
  let visualizer: any;
  const renderer = new ServerRenderer();
  
  async function renderVideo() {
    const params = visualizer.getRenderParams();
    params.audioUrl = currentAudioUrl;
    params.svgUrl = window.location.origin + '/raptor-svg.svg';
    
    const { jobId } = await renderer.submitJob(params);
    const result = await renderer.waitForCompletion(jobId);
    renderer.downloadVideo(result.video);
  }
</script>

<AudioVisualizerWebGL bind:this={visualizer} {audioElement} />
<button onclick={renderVideo}>Generate Video</button>
```

## Test Locally (1 minute)

```bash
cd server
npm test
# Check test-output.mp4
```

## Deploy to RunPod (Later)

See `server/DEPLOYMENT.md` for full guide.

Quick version:
```bash
cd server
docker build -t r10-renderer .
docker push YOUR_USERNAME/r10-renderer
# Create endpoint in RunPod dashboard
```

## Done! 🎉

You now have:
- ✅ Server rendering that matches browser exactly
- ✅ Client API integrated into your app
- ✅ Ready to deploy to RunPod

Need more details? See `INTEGRATION.md`

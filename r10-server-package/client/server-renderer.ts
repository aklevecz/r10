// client-api.ts
// Add this to your Svelte app to send render jobs to RunPod

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
  video?: string; // base64 encoded
  message?: string;
  error?: string;
}

export class R10ServerRenderer {
  private runpodEndpoint: string;
  private apiKey: string;

  constructor(runpodEndpoint: string, apiKey: string) {
    this.runpodEndpoint = runpodEndpoint;
    this.apiKey = apiKey;
  }

  /**
   * Extract parameters from the current browser visualization
   */
  extractParamsFromBrowser(visualizer: any): RenderParams {
    // Get the random parameters that were chosen in the browser
    return {
      audioUrl: '', // You'll need to provide this
      distortionType: visualizer.distortionType,
      trailHue: visualizer.trailHue,
      trailSat: 90,
      trailLight: 60,
      svgUrl: window.location.origin + '/raptor-svg.svg'
    };
  }

  /**
   * Submit render job to RunPod
   */
  async submitRenderJob(params: RenderParams): Promise<{ jobId: string }> {
    const response = await fetch(`${this.runpodEndpoint}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        input: params
      })
    });

    if (!response.ok) {
      throw new Error(`RunPod API error: ${response.statusText}`);
    }

    const data = await response.json();
    return { jobId: data.id };
  }

  /**
   * Poll for job completion
   */
  async waitForCompletion(jobId: string, maxWaitTime = 300000): Promise<RenderResponse> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const response = await fetch(`${this.runpodEndpoint}/status/${jobId}`, {
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
        throw new Error(`Render failed: ${data.error}`);
      }

      // Wait 2 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Render timeout');
  }

  /**
   * Download the rendered video
   */
  downloadVideo(base64Video: string, filename = 'r10-render.mp4') {
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

// Usage example in your Svelte component:
/*
<script lang="ts">
  import { R10ServerRenderer } from './client-api';
  
  let visualizer: any; // Your AudioVisualizerWebGL component
  let isRendering = false;
  let renderProgress = '';
  
  const renderer = new R10ServerRenderer(
    'https://api.runpod.ai/v2/YOUR_ENDPOINT_ID',
    'YOUR_API_KEY'
  );
  
  async function generateServerVideo(audioUrl: string) {
    isRendering = true;
    renderProgress = 'Extracting parameters...';
    
    try {
      // Get the exact parameters from the browser visualization
      const params = renderer.extractParamsFromBrowser(visualizer);
      params.audioUrl = audioUrl;
      
      renderProgress = 'Submitting job...';
      const { jobId } = await renderer.submitRenderJob(params);
      
      renderProgress = 'Rendering on server...';
      const result = await renderer.waitForCompletion(jobId);
      
      if (result.status === 'success' && result.video) {
        renderProgress = 'Downloading...';
        renderer.downloadVideo(result.video);
        renderProgress = 'Complete!';
      } else {
        renderProgress = `Error: ${result.message}`;
      }
    } catch (error) {
      renderProgress = `Error: ${error.message}`;
    } finally {
      isRendering = false;
    }
  }
</script>

<button on:click={() => generateServerVideo(currentSongUrl)} disabled={isRendering}>
  {isRendering ? renderProgress : 'Generate Server Video'}
</button>
*/

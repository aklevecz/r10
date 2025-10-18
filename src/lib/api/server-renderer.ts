export interface RenderParams {
	audioUrl: string;
	distortionType: number;
	trailHue: number;
	trailSat: number;
	trailLight: number;
	pngUrl?: string;
}

export interface RenderResponse {
	status: 'success' | 'error';
	video_url?: string | null; // R2 public URL
	message?: string;
	error?: string;
}

export class R10ServerRenderer {
	/**
	 * Extract parameters from the current browser visualization
	 */
	extractParamsFromBrowser(visualizer: any): RenderParams {
		const params = visualizer.getRenderParams();
		return {
			audioUrl: '', // Will be set by caller
			distortionType: params.distortionType,
			trailHue: params.trailHue,
			trailSat: params.trailSat,
			trailLight: params.trailLight,
			pngUrl: 'raptor-bw.png' // Server has this file
		};
	}

	/**
	 * Submit render job via server API
	 */
	async submitRenderJob(params: RenderParams): Promise<{ jobId: string }> {
		const response = await fetch('/api/render-video', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(params)
		});

		if (!response.ok) {
			throw new Error(`Server API error: ${response.statusText}`);
		}

		const data = await response.json();

		if (!data.success) {
			throw new Error(data.error || 'Failed to submit render job');
		}

		return { jobId: data.jobId };
	}

	/**
	 * Poll for job completion via server API
	 */
	async waitForCompletion(jobId: string, maxWaitTime = 300000): Promise<RenderResponse> {
		const startTime = Date.now();

		while (Date.now() - startTime < maxWaitTime) {
			const response = await fetch(`/api/render-status/${jobId}`);

			if (!response.ok) {
				throw new Error(`Status check failed: ${response.statusText}`);
			}

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || 'Failed to check status');
			}

			if (data.status === 'COMPLETED') {
				// RunPod returns the output object with video_url
				return {
					status: 'success',
					video_url: data.output?.video_url || null,
					message: data.output?.message
				};
			} else if (data.status === 'FAILED') {
				return {
					status: 'error',
					error: data.error || 'Render failed'
				};
			}

			// Wait 2 seconds before polling again
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		return {
			status: 'error',
			error: 'Render timeout'
		};
	}

	/**
	 * Download the rendered video from URL
	 */
	downloadVideo(videoUrl: string, filename = 'r10-render.mp4') {
		const a = document.createElement('a');
		a.href = videoUrl;
		a.download = filename;
		a.target = '_blank';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
}

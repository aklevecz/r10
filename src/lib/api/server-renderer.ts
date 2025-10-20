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
	private static readonly STORAGE_KEY = 'r10_render_job';

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
	 * Save job ID to localStorage and URL
	 */
	private saveJobId(jobId: string, params: RenderParams) {
		// Save to localStorage
		const jobData = {
			jobId,
			params,
			timestamp: Date.now(),
			status: 'IN_PROGRESS'
		};
		localStorage.setItem(R10ServerRenderer.STORAGE_KEY, JSON.stringify(jobData));

		// Sync to URL query params
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.set('jobId', jobId);
			window.history.replaceState({}, '', url.toString());
		}
	}

	/**
	 * Get cached job ID from URL or localStorage
	 */
	getCachedJobId(): string | null {
		// Check URL params first (highest priority)
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			const urlJobId = url.searchParams.get('jobId');
			if (urlJobId) return urlJobId;
		}

		// Check localStorage
		const cached = localStorage.getItem(R10ServerRenderer.STORAGE_KEY);
		if (!cached) return null;

		try {
			const jobData = JSON.parse(cached);
			// Only return if job is still in progress (not completed/failed)
			if (jobData.status === 'IN_PROGRESS') {
				return jobData.jobId;
			}
		} catch (e) {
			console.error('Failed to parse cached job data:', e);
		}

		return null;
	}

	/**
	 * Clear cached job data
	 */
	clearCache() {
		localStorage.removeItem(R10ServerRenderer.STORAGE_KEY);

		// Remove jobId from URL
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.delete('jobId');
			window.history.replaceState({}, '', url.toString());
		}
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

		// Cache the job ID
		this.saveJobId(data.jobId, params);

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
				// Mark job as complete and clear cache
				this.clearCache();

				// RunPod returns the output object with video_url
				return {
					status: 'success',
					video_url: data.output?.video_url || null,
					message: data.output?.message
				};
			} else if (data.status === 'FAILED') {
				// Clear cache on failure
				this.clearCache();

				return {
					status: 'error',
					error: data.error || 'Render failed'
				};
			}

			// Wait 2 seconds before polling again
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		// Clear cache on timeout
		this.clearCache();

		return {
			status: 'error',
			error: 'Render timeout'
		};
	}

	/**
	 * Resume polling for a cached job (after page refresh)
	 */
	async resumeCachedJob(): Promise<RenderResponse | null> {
		const jobId = this.getCachedJobId();
		if (!jobId) return null;

		console.log(`Resuming cached render job: ${jobId}`);
		return await this.waitForCompletion(jobId);
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

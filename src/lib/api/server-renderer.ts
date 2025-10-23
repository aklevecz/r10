export interface RenderParams {
	audioUrl: string;
	distortionType: number;
	trailHue: number;
	trailSat: number;
	trailLight: number;
	pngUrl?: string;
}

export interface CachedJobData {
	jobId: string;
	params: RenderParams;
	timestamp: number;
	status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
	videoUrl?: string | null; // Store video URL when completed
	songData?: {
		trackId: number;
		trackName: string;
		artistName: string;
		artworkUrl100: string;
		previewUrl: string;
		collectionName: string;
	};
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
	private saveJobId(jobId: string, params: RenderParams, songData?: CachedJobData['songData']) {
		// Save to localStorage
		const jobData: CachedJobData = {
			jobId,
			params,
			timestamp: Date.now(),
			status: 'IN_PROGRESS',
			songData
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
			const jobData: CachedJobData = JSON.parse(cached);
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
	 * Get full cached job data (including song info)
	 * Checks URL params first (for shared links), then localStorage
	 */
	getCachedJobData(): CachedJobData | null {
		// Check URL params first (highest priority) - for shared links
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			const urlJobId = url.searchParams.get('jobId');

			if (urlJobId) {
				// Check if we have this job cached locally
				const cached = localStorage.getItem(R10ServerRenderer.STORAGE_KEY);
				if (cached) {
					try {
						const jobData: CachedJobData = JSON.parse(cached);
						// If URL jobId matches cached jobId, return it
						if (jobData.jobId === urlJobId && jobData.status !== 'FAILED') {
							return jobData;
						}
					} catch (e) {
						console.error('Failed to parse cached job data:', e);
					}
				}

				// URL has jobId but not in cache - return minimal data to trigger fetch
				return {
					jobId: urlJobId,
					params: {} as any, // Will be fetched from server
					timestamp: Date.now(),
					status: 'IN_PROGRESS'
				};
			}
		}

		// Check localStorage (fallback if no URL param)
		const cached = localStorage.getItem(R10ServerRenderer.STORAGE_KEY);
		if (!cached) return null;

		try {
			const jobData: CachedJobData = JSON.parse(cached);
			// Return job data regardless of status (IN_PROGRESS or COMPLETED)
			// Only skip FAILED jobs
			if (jobData.status !== 'FAILED') {
				return jobData;
			}
		} catch (e) {
			console.error('Failed to parse cached job data:', e);
		}

		return null;
	}

	/**
	 * Clear cached job data (public method)
	 * Call this when user explicitly starts a new search
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
	async submitRenderJob(
		params: RenderParams,
		songData?: CachedJobData['songData']
	): Promise<{ jobId: string }> {
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

		// Cache the job ID with song data
		this.saveJobId(data.jobId, params, songData);

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
				// Mark job as complete in cache and store video URL
				// User can still access the video URL if they refresh
				const videoUrl = data.output?.video_url || null;
				const cached = localStorage.getItem(R10ServerRenderer.STORAGE_KEY);
				if (cached) {
					try {
						const jobData: CachedJobData = JSON.parse(cached);
						jobData.status = 'COMPLETED';
						jobData.videoUrl = videoUrl;
						localStorage.setItem(R10ServerRenderer.STORAGE_KEY, JSON.stringify(jobData));
					} catch (e) {
						console.error('Failed to update cached job status:', e);
					}
				}

				// RunPod returns the output object with video_url
				return {
					status: 'success',
					video_url: videoUrl,
					message: data.output?.message
				};
			} else if (data.status === 'FAILED') {
				// Mark job as failed in cache but don't clear it yet
				const cached = localStorage.getItem(R10ServerRenderer.STORAGE_KEY);
				if (cached) {
					try {
						const jobData: CachedJobData = JSON.parse(cached);
						jobData.status = 'FAILED';
						localStorage.setItem(R10ServerRenderer.STORAGE_KEY, JSON.stringify(jobData));
					} catch (e) {
						console.error('Failed to update cached job status:', e);
					}
				}

				return {
					status: 'error',
					error: data.error || 'Render failed'
				};
			}

			// Wait 2 seconds before polling again
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		// Mark job as timed out but don't clear cache
		const cached = localStorage.getItem(R10ServerRenderer.STORAGE_KEY);
		if (cached) {
			try {
				const jobData: CachedJobData = JSON.parse(cached);
				jobData.status = 'FAILED';
				localStorage.setItem(R10ServerRenderer.STORAGE_KEY, JSON.stringify(jobData));
			} catch (e) {
				console.error('Failed to update cached job status:', e);
			}
		}

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

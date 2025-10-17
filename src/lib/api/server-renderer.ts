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
			svgUrl: typeof window !== 'undefined' ? window.location.origin + '/raptor-svg.svg' : ''
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
				return data.output;
			} else if (data.status === 'FAILED') {
				throw new Error(`Render failed: ${data.error}`);
			}

			// Wait 2 seconds before polling again
			await new Promise((resolve) => setTimeout(resolve, 2000));
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

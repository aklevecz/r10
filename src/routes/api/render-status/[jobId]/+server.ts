import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID } from '$env/static/private';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { jobId } = params;

		// Check job status on RunPod
		const runpodEndpoint = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`;
		const response = await fetch(runpodEndpoint, {
			headers: {
				Authorization: `Bearer ${RUNPOD_API_KEY}`
			}
		});

		if (!response.ok) {
			throw new Error(`RunPod API error: ${response.statusText}`);
		}

		const data = await response.json();

		return json({
			success: true,
			status: data.status,
			output: data.output,
			error: data.error
		});
	} catch (error) {
		console.error('Error checking render status:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

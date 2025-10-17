import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const params = await request.json();

		// Submit job to RunPod
		const runpodEndpoint = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`;
		const response = await fetch(runpodEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${RUNPOD_API_KEY}`
			},
			body: JSON.stringify({
				input: params
			})
		});

		if (!response.ok) {
			throw new Error(`RunPod API error: ${response.statusText}`);
		}

		const data = await response.json();
		return json({ success: true, jobId: data.id });
	} catch (error) {
		console.error('Error submitting render job:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

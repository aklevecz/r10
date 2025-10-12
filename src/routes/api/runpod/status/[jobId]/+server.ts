import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const jobId = params.jobId;

		if (!jobId) {
			return json({ success: false, error: 'Job ID is required' }, { status: 400 });
		}

		// Get RunPod credentials from environment
		const { RUNPOD_API_KEY, RUNPOD_ENDPOINT } = env;

		if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT) {
			console.error('RunPod credentials not configured');
			return json({ success: false, error: 'RunPod not configured' }, { status: 500 });
		}

		// Check job status with RunPod
		console.log(`Checking RunPod job status: ${jobId}`);

		const response = await fetch(`${RUNPOD_ENDPOINT}/status/${jobId}`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${RUNPOD_API_KEY}`
			}
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`RunPod status API error: ${response.status} ${response.statusText}`);
			return json(
				{
					success: false,
					error: `RunPod status API error: ${response.status}`,
					details: errorText
				},
				{ status: response.status }
			);
		}

		const result = await response.json();
		console.log('RunPod status response:', result);

		return json({
			success: true,
			job_id: jobId,
			status: result.status,
			output: result.output,
			execution_time: result.executionTime,
			queue_time: result.delayTime
		});
	} catch (error) {
		console.error('RunPod status check error:', error);
		return json(
			{
				success: false,
				error: 'Failed to check RunPod job status',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

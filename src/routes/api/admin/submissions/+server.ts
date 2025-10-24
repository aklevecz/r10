import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request, platform }) => {
	try {
		const KV = platform?.env?.KV;
		if (!KV) {
			console.error('KV binding not available');
			return json({ error: 'Storage not configured' }, { status: 500 });
		}

		// Simple auth check - require admin key in header
		const adminKey = request.headers.get('x-admin-key');
		if (!adminKey || adminKey !== env.ADMIN_KEY) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get all submission IDs from the index
		const indexKey = 'rsvp:submissions:index';
		const indexStr = await KV.get(indexKey);
		const submissionIds: string[] = indexStr ? JSON.parse(indexStr) : [];

		// Fetch all submissions
		const submissions = await Promise.all(
			submissionIds.map(async (id) => {
				const submissionStr = await KV.get(`rsvp:submissions:${id}`);
				if (!submissionStr) return null;
				return JSON.parse(submissionStr);
			})
		);

		// Filter out any null values
		const validSubmissions = submissions.filter((s) => s !== null);

		return json({
			success: true,
			count: validSubmissions.length,
			submissions: validSubmissions
		});
	} catch (error) {
		console.error('Error fetching submissions:', error);
		return json(
			{
				error: 'Failed to fetch submissions',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { KV_REST_API_URL, KV_REST_API_TOKEN } from '$env/static/private';
import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';

// Initialize Redis
const redis = new Redis({
	url: KV_REST_API_URL || '',
	token: KV_REST_API_TOKEN || ''
});

export const GET: RequestHandler = async ({ request }) => {
	try {
		// Simple auth check - require admin key in header
		const adminKey = request.headers.get('x-admin-key');
		if (!adminKey || adminKey !== env.ADMIN_KEY) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get all submission IDs from the sorted set (most recent first)
		const submissionIds = await redis.zrange('rsvp:submissions:index', 0, -1, {
			rev: true
		});

		// Fetch all submissions
		const submissions = await Promise.all(
			submissionIds.map(async (id) => {
				const submission = await redis.get(`rsvp:submissions:${id}`);
				// Parse JSON if it's a string
				if (typeof submission === 'string') {
					return JSON.parse(submission);
				}
				return submission;
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

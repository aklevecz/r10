import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { KV_REST_API_URL, KV_REST_API_TOKEN } from '$env/static/private';
import { Redis } from '@upstash/redis';

// Initialize Redis
const redis = new Redis({
	url: KV_REST_API_URL || '',
	token: KV_REST_API_TOKEN || ''
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { contactInfo, videoUrl, songName, artistName } = body;

		if (!contactInfo || !contactInfo.trim()) {
			return json({ error: 'Contact information is required' }, { status: 400 });
		}

		// Generate unique ID for this submission
		const submissionId = crypto.randomUUID();
		const timestamp = new Date().toISOString();

		// Create the submission object
		const submission = {
			id: submissionId,
			contactInfo: contactInfo.trim(),
			videoUrl: videoUrl || null,
			songName: songName || null,
			artistName: artistName || null,
			timestamp,
			ip: request.headers.get('x-forwarded-for') || 'unknown'
		};

		// Store in Redis
		// Key format: rsvp:submissions:{id}
		await redis.set(`rsvp:submissions:${submissionId}`, JSON.stringify(submission));

		// Also add to a sorted set for easy retrieval by timestamp
		await redis.zadd('rsvp:submissions:index', {
			score: Date.now(),
			member: submissionId
		});

		console.log('Contact submission saved:', submissionId);

		return json({
			success: true,
			submissionId
		});
	} catch (error) {
		console.error('Error saving contact submission:', error);
		return json(
			{
				error: 'Failed to save contact information',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

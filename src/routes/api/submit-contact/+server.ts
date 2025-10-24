import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const KV = platform?.env?.KV;
		if (!KV) {
			console.error('KV binding not available');
			return json({ error: 'Storage not configured' }, { status: 500 });
		}

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
			timestampMs: Date.now(),
			ip: request.headers.get('x-forwarded-for') || 'unknown'
		};

		// Store the submission in KV
		// Key format: rsvp:submissions:{id}
		await KV.put(`rsvp:submissions:${submissionId}`, JSON.stringify(submission));

		// Update the index array to track all submission IDs
		// Get current index, add new ID, and store back
		const indexKey = 'rsvp:submissions:index';
		const currentIndexStr = await KV.get(indexKey);
		const currentIndex: string[] = currentIndexStr ? JSON.parse(currentIndexStr) : [];

		// Add new submission ID to the front (most recent first)
		currentIndex.unshift(submissionId);

		// Store updated index
		await KV.put(indexKey, JSON.stringify(currentIndex));

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

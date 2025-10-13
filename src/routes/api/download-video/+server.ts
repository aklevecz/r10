import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const videoUrl = url.searchParams.get('url');

	if (!videoUrl) {
		throw error(400, 'Missing video URL');
	}

	try {
		// Fetch the video from Vercel Blob
		const response = await fetch(videoUrl);

		if (!response.ok) {
			throw error(500, 'Failed to fetch video');
		}

		const videoBlob = await response.blob();

		// Return with download headers
		return new Response(videoBlob, {
			status: 200,
			headers: {
				'Content-Type': 'video/mp4',
				'Content-Disposition': 'attachment; filename="my-rsvp-video.mp4"',
				'Cache-Control': 'no-cache'
			}
		});
	} catch (err) {
		console.error('Download error:', err);
		throw error(500, 'Failed to download video');
	}
};

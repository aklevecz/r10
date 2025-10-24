import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		const R2 = platform?.env?.R2;
		if (!R2) {
			console.error('R2 binding not available');
			return json({ error: 'Storage not configured' }, { status: 500 });
		}

		// List all objects in the videos/ prefix
		const listed = await R2.list({ prefix: 'videos/' });

		// Filter to only .mp4 files and get metadata
		const videos = await Promise.all(
			listed.objects
				.filter((obj) => obj.key.endsWith('.mp4'))
				.map(async (obj) => {
					// Get full object with metadata
					const fullObj = await R2.get(obj.key);
					const metadata = fullObj?.customMetadata || {};

					return {
						key: obj.key,
						url: `https://pub-29bef9a766764c9fa9c0e3936a6e5eee.r2.dev/${obj.key}`,
						uploaded: obj.uploaded,
						size: obj.size,
						metadata: {
							songName: metadata.songName || 'Unknown Song',
							artistName: metadata.artistName || 'Unknown Artist',
							audioUrl: metadata.audioUrl || '',
							distortionType: metadata.distortionType || '',
							sessionId: metadata.sessionId || '',
							renderedAt: metadata.renderedAt || ''
						}
					};
				})
		);

		// Sort by upload date, newest first
		videos.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime());

		return json({
			success: true,
			count: videos.length,
			videos
		});
	} catch (error) {
		console.error('Error listing videos:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

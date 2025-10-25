import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		const DB = platform?.env?.DB;
		if (!DB) {
			console.error('D1 binding not available');
			return json({ error: 'Database not configured' }, { status: 500 });
		}

		// Query all videos from D1, ordered by upload date (newest first)
		const result = await DB.prepare(
			`SELECT * FROM videos ORDER BY uploaded DESC LIMIT 100`
		).all();

		const videos = result.results.map((row: any) => ({
			key: row.key,
			url: row.url,
			uploaded: new Date(row.uploaded * 1000).toISOString(),
			size: row.size,
		thumbnailUrl: row.thumbnailUrl || "",
			metadata: {
				audioUrl: row.audioUrl || '',
				distortionType: row.distortionType || '',
				trailHue: row.trailHue || '',
				trailSat: row.trailSat || '',
				trailLight: row.trailLight || '',
				pngUrl: row.pngUrl || '',
				profile: row.profile || '',
				sessionId: row.sessionId || '',
				renderedAt: row.renderedAt || '',
				songName: row.songName || '',
				artistName: row.artistName || '',
				artworkUrl: row.artworkUrl || ''
			}
		}));

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

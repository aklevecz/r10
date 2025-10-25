import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RUNPOD_WEBHOOK_SECRET } from '$env/static/private';

// Extract iTunes track ID from preview URL
function extractTrackId(audioUrl: string): string | null {
	try {
		const url = new URL(audioUrl);
		const pathParts = url.pathname.split('/');
		const previewIndex = pathParts.indexOf('AudioPreview125');
		if (previewIndex >= 0 && pathParts.length > previewIndex + 4) {
			const filename = pathParts[pathParts.length - 1];
			const match = filename.match(/mzaf_(\d+)/);
			if (match) {
				return match[1];
			}
		}
	} catch (e) {
		console.error('Error extracting track ID:', e);
	}
	return null;
}

// Fetch song metadata from iTunes API
async function fetchSongMetadata(
	audioUrl: string
): Promise<{ songName: string; artistName: string; artworkUrl: string } | null> {
	const trackId = extractTrackId(audioUrl);
	if (!trackId) {
		console.log('Could not extract track ID from audioUrl');
		return null;
	}

	try {
		const response = await fetch(
			`https://itunes.apple.com/lookup?id=${trackId}&entity=song&limit=1`
		);
		const data = await response.json();

		if (data.results && data.results.length > 0) {
			const track = data.results[0];
			return {
				songName: track.trackName || '',
				artistName: track.artistName || '',
				artworkUrl: track.artworkUrl100 || ''
			};
		}
	} catch (e) {
		console.error('Error fetching iTunes metadata:', e);
	}

	return null;
}

export const POST: RequestHandler = async ({ request, url, platform }) => {
	try {
		// Verify shared secret
		const secret = url.searchParams.get('secret');
		if (secret !== RUNPOD_WEBHOOK_SECRET) {
			console.error('Invalid webhook secret');
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const D1 = platform?.env?.DB;
		if (!D1) {
			console.error('D1 binding not available');
			return json({ error: 'Database not configured' }, { status: 500 });
		}

		// Parse RunPod webhook payload
		const payload = await request.json();

		// RunPod webhook structure:
		// {
		//   id: "job-id",
		//   status: "COMPLETED",
		//   output: {
		//     status: "success",
		//     video_url: "https://...",
		//     session_id: "...",
		//     ...
		//   }
		// }

		if (payload.status !== 'COMPLETED' || payload.output?.status !== 'success') {
			console.log('Webhook called but job not completed successfully');
			return json({ success: false, message: 'Job not completed' });
		}

		const output = payload.output;
		const input = payload.input || {};

		// Get song metadata from iTunes
		const songMetadata = input.audioUrl ? await fetchSongMetadata(input.audioUrl) : null;

		// Extract video ID from URL
		const videoUrl = output.video_url;
		const key = videoUrl.split('.r2.dev/')[1];
		const videoId = key?.split('/').pop()?.replace('.mp4', '') || crypto.randomUUID();

		// Insert into D1
		await D1.prepare(
			`INSERT OR IGNORE INTO videos (
				id, key, url, uploaded, size,
				distortionType, trailHue, trailSat, trailLight, pngUrl, profile,
				sessionId, renderedAt, audioUrl,
				songName, artistName, artworkUrl, thumbnailUrl
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
			.bind(
				videoId,
				key,
				videoUrl,
				Math.floor(Date.now() / 1000), // uploaded timestamp
				0, // size (we don't have this from webhook)
				input.distortionType?.toString() || '',
				input.trailHue?.toString() || '',
				input.trailSat?.toString() || '',
				input.trailLight?.toString() || '',
				input.pngUrl || '',
				input.profile || '',
				output.session_id || input.sessionId || '',
				parseInt(input.renderedAt) || Math.floor(Date.now() / 1000),
				input.audioUrl || '',
				songMetadata?.songName || '',
				songMetadata?.artistName || '',
				songMetadata?.artworkUrl || '',
				output.thumbnail_url || ''
			)
			.run();

		console.log('Video saved to D1:', videoId);

		return json({ success: true, videoId });
	} catch (error) {
		console.error('Error processing webhook:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

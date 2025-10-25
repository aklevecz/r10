/**
 * Backfill song metadata for existing videos in D1 database
 *
 * Usage:
 * npx tsx scripts/backfill-song-metadata.ts
 */

// Extract iTunes track ID from preview URL
function extractTrackId(audioUrl: string): string | null {
	try {
		const url = new URL(audioUrl);
		const filename = url.pathname.split('/').pop();
		if (filename) {
			// Match pattern: mzaf_{trackId}.plus.aac.p.m4a
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

// Fetch song metadata using AudD music recognition API (free tier)
async function fetchSongMetadata(
	audioUrl: string
): Promise<{ songName: string; artistName: string; artworkUrl: string } | null> {
	try {
		// Use AudD's API to recognize the song from the audio URL
		const formData = new URLSearchParams();
		formData.append('url', audioUrl);
		formData.append('return', 'apple_music,spotify');
		formData.append('api_token', 'eef7c02b275b85862c9ca43a54d17a42');

		const response = await fetch('https://api.audd.io/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: formData.toString()
		});

		const data = await response.json();

		if (data.status === 'success' && data.result) {
			const result = data.result;

			// Try to get Apple Music artwork if available
			let artworkUrl = '';
			if (result.apple_music?.artwork?.url) {
				artworkUrl = result.apple_music.artwork.url
					.replace('{w}', '100')
					.replace('{h}', '100');
			} else if (result.spotify?.album?.images?.[0]?.url) {
				artworkUrl = result.spotify.album.images[0].url;
			}

			return {
				songName: result.title || '',
				artistName: result.artist || '',
				artworkUrl
			};
		} else if (data.status === 'error') {
			console.log(`  API Error: ${data.error?.error_message || 'Unknown error'}`);
		}
	} catch (e) {
		console.error('Error fetching song metadata:', e);
	}

	return null;
}

async function backfillMetadata() {
	console.log('Starting metadata backfill...\n');

	// Read from wrangler config to get database ID
	const wranglerConfig = await Bun.file('wrangler.jsonc').text();
	const dbIdMatch = wranglerConfig.match(/"database_id":\s*"([^"]+)"/);

	if (!dbIdMatch) {
		console.error('Could not find database_id in wrangler.jsonc');
		process.exit(1);
	}

	const databaseId = dbIdMatch[1];
	console.log(`Using D1 database: ${databaseId}\n`);

	// Get videos without song metadata using wrangler
	const { spawn } = require('child_process');

	const getVideos = spawn('npx', [
		'wrangler',
		'd1',
		'execute',
		'r10-videos',
		'--remote',
		'--command',
		"SELECT id, audioUrl FROM videos WHERE audioUrl != '' AND (songName = '' OR songName IS NULL) LIMIT 50"
	]);

	let videosData = '';
	getVideos.stdout.on('data', (data: Buffer) => {
		videosData += data.toString();
	});

	await new Promise((resolve) => {
		getVideos.on('close', resolve);
	});

	// Parse the JSON output from wrangler
	const jsonMatch = videosData.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		console.error('Could not parse wrangler output');
		console.log(videosData);
		process.exit(1);
	}

	const result = JSON.parse(jsonMatch[0]);
	const videos = result[0]?.results || [];

	console.log(`Found ${videos.length} videos needing metadata\n`);

	const updateStatements: string[] = [];

	for (let i = 0; i < videos.length; i++) {
		const video = videos[i];
		console.log(`[${i + 1}/${videos.length}] Processing video ${video.id}...`);

		if (!video.audioUrl) {
			console.log('  No audioUrl, skipping');
			continue;
		}

		const metadata = await fetchSongMetadata(video.audioUrl);

		if (metadata && metadata.songName) {
			console.log(`  ✓ ${metadata.artistName} - ${metadata.songName}`);

			const sql = `UPDATE videos SET songName = '${metadata.songName.replace(/'/g, "''")}', artistName = '${metadata.artistName.replace(/'/g, "''")}', artworkUrl = '${metadata.artworkUrl}' WHERE id = '${video.id}';`;
			updateStatements.push(sql);
		} else {
			console.log('  ✗ Could not fetch metadata');
		}

		// Delay to avoid rate limiting (AudD free tier allows 1 request per second)
		await new Promise((resolve) => setTimeout(resolve, 1500));
	}

	console.log(`\n✅ Processed ${videos.length} videos`);
	console.log(`📝 Generated ${updateStatements.length} update statements\n`);

	if (updateStatements.length > 0) {
		// Write updates to file
		const updateSql = updateStatements.join('\n');
		await Bun.write('metadata-updates.sql', updateSql);

		console.log('Saved SQL to metadata-updates.sql');
		console.log('\nTo apply updates, run:');
		console.log('  npx wrangler d1 execute r10-videos --remote --file=metadata-updates.sql');
	} else {
		console.log('No updates needed.');
	}
}

// Run backfill
backfillMetadata().catch((error) => {
	console.error('Backfill failed:', error);
	process.exit(1);
});

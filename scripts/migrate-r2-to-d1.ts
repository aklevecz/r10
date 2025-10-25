/**
 * Migration script to backfill existing R2 videos into D1 database
 *
 * Usage:
 * 1. Ensure D1 database is created and schema.sql has been applied
 * 2. Set environment variables in .env
 * 3. Run: npx tsx scripts/migrate-r2-to-d1.ts
 */

import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import 'dotenv/config';

// Use RunPod R2 bucket (where videos are actually stored)
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = 'r10'; // RunPod bucket
const R2_PUBLIC_URL_BASE = process.env.R2_PUBLIC_URL_BASE!;

// Initialize S3 client for R2
const s3Client = new S3Client({
	region: 'auto',
	endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY
	}
});

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
		console.log('Could not extract track ID from audioUrl:', audioUrl);
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

async function migrateVideos() {
	console.log('Starting R2 to D1 migration...\n');

	// List all objects in R2 with videos/ prefix
	console.log(`Checking R2 bucket: ${R2_BUCKET_NAME}`);
	const listCommand = new ListObjectsV2Command({
		Bucket: R2_BUCKET_NAME,
		Prefix: 'videos/'
	});

	const listResponse = await s3Client.send(listCommand);
	const videoObjects = (listResponse.Contents || []).filter((obj) => obj.Key?.endsWith('.mp4'));

	console.log(`Found ${videoObjects.length} video files in R2\n`);

	const sqlStatements: string[] = [];

	for (let i = 0; i < videoObjects.length; i++) {
		const obj = videoObjects[i];
		const key = obj.Key!;
		const videoId = key.split('/').pop()?.replace('.mp4', '') || '';

		console.log(`[${i + 1}/${videoObjects.length}] Processing ${key}...`);

		// Get object metadata from R2
		const headCommand = new HeadObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key
		});

		const headResponse = await s3Client.send(headCommand);
		const metadata = headResponse.Metadata || {};

		// Get song metadata from iTunes if audioUrl is available
		const audioUrl = metadata.audiourl || '';
		const songMetadata = audioUrl ? await fetchSongMetadata(audioUrl) : null;

		// Generate SQL INSERT statement
		const url = `${R2_PUBLIC_URL_BASE}/${key}`;
		const uploaded = obj.LastModified ? Math.floor(obj.LastModified.getTime() / 1000) : 0;
		const size = obj.Size || 0;

		const sql = `INSERT OR IGNORE INTO videos (
			id, key, url, uploaded, size,
			distortionType, trailHue, trailSat, trailLight, pngUrl, profile,
			sessionId, renderedAt, audioUrl,
			songName, artistName, artworkUrl
		) VALUES (
			'${videoId}',
			'${key}',
			'${url}',
			${uploaded},
			${size},
			'${metadata.distortiontype || ''}',
			'${metadata.trailhue || ''}',
			'${metadata.trailsat || ''}',
			'${metadata.traillight || ''}',
			'${metadata.pngurl || ''}',
			'${metadata.profile || ''}',
			'${metadata.sessionid || ''}',
			${metadata.renderedat || 0},
			'${audioUrl}',
			'${songMetadata?.songName || ''}',
			'${songMetadata?.artistName || ''}',
			'${songMetadata?.artworkUrl || ''}'
		);`;

		sqlStatements.push(sql);

		// Add small delay to avoid rate limiting iTunes API
		if (audioUrl) {
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
	}

	console.log(`\n✅ Processed ${sqlStatements.length} videos`);
	console.log('\nGenerated SQL statements:');
	console.log('--------------------------------------------\n');
	console.log(sqlStatements.join('\n\n'));
	console.log('\n--------------------------------------------');
	console.log('\nTo apply these changes to your D1 database, run:');
	console.log('  npx wrangler d1 execute DB --remote --command="<SQL>"');
	console.log('\nOr save the SQL to a file and run:');
	console.log('  npx wrangler d1 execute DB --remote --file=migration.sql');
}

// Run migration
migrateVideos().catch((error) => {
	console.error('Migration failed:', error);
	process.exit(1);
});

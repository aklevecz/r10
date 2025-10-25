/**
 * Generate 400x400 thumbnails from last frame of each video
 * Upload to R2 and update D1 database
 *
 * Usage:
 * bun scripts/generate-thumbnails.ts
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { unlink } from 'fs/promises';

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = 'r10';
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

// Execute shell command and return output
function execCommand(command: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args);
		let output = '';
		let errorOutput = '';

		proc.stdout.on('data', (data) => {
			output += data.toString();
		});

		proc.stderr.on('data', (data) => {
			errorOutput += data.toString();
		});

		proc.on('close', (code) => {
			if (code === 0) {
				resolve(output);
			} else {
				reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
			}
		});
	});
}

// Generate thumbnail from video URL
async function generateThumbnail(
	videoUrl: string,
	videoId: string
): Promise<{ thumbnailUrl: string } | null> {
	const tmpVideoPath = `/tmp/${videoId}.mp4`;
	const tmpThumbnailPath = `/tmp/${videoId}.jpg`;

	try {
		console.log('  Downloading video...');
		await execCommand('curl', ['-s', '-o', tmpVideoPath, videoUrl]);

		console.log('  Extracting last frame...');
		// Get video duration first
		const durationOutput = await execCommand('ffprobe', [
			'-v',
			'error',
			'-show_entries',
			'format=duration',
			'-of',
			'default=noprint_wrappers=1:nokey=1',
			tmpVideoPath
		]);
		const duration = parseFloat(durationOutput.trim());

		// Extract last frame (1 second before end to avoid fade)
		const timestamp = Math.max(0, duration - 1);
		await execCommand('ffmpeg', [
			'-ss',
			timestamp.toString(),
			'-i',
			tmpVideoPath,
			'-vframes',
			'1',
			'-vf',
			'crop=min(iw\\,ih):min(iw\\,ih),scale=400:400',
			'-y',
			tmpThumbnailPath
		]);

		console.log('  Uploading to R2...');
		const thumbnailBuffer = await Bun.file(tmpThumbnailPath).arrayBuffer();
		const thumbnailKey = `thumbnails/${videoId}.jpg`;

		await s3Client.send(
			new PutObjectCommand({
				Bucket: R2_BUCKET_NAME,
				Key: thumbnailKey,
				Body: new Uint8Array(thumbnailBuffer),
				ContentType: 'image/jpeg'
			})
		);

		const thumbnailUrl = `${R2_PUBLIC_URL_BASE}/${thumbnailKey}`;

		// Cleanup temp files
		await unlink(tmpVideoPath).catch(() => {});
		await unlink(tmpThumbnailPath).catch(() => {});

		return { thumbnailUrl };
	} catch (error) {
		console.error('  Error generating thumbnail:', error);
		// Cleanup on error
		await unlink(tmpVideoPath).catch(() => {});
		await unlink(tmpThumbnailPath).catch(() => {});
		return null;
	}
}

async function generateAllThumbnails() {
	console.log('Starting thumbnail generation...\n');

	// Get all videos from D1
	const wranglerConfig = await Bun.file('wrangler.jsonc').text();
	const dbIdMatch = wranglerConfig.match(/"database_id":\s*"([^"]+)"/);

	if (!dbIdMatch) {
		console.error('Could not find database_id in wrangler.jsonc');
		process.exit(1);
	}

	console.log('Fetching videos from D1...\n');

	const getVideos = spawn('npx', [
		'wrangler',
		'd1',
		'execute',
		'r10-videos',
		'--remote',
		'--command',
		'SELECT id, url FROM videos WHERE thumbnailUrl IS NULL OR thumbnailUrl = "" LIMIT 50'
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

	console.log(`Found ${videos.length} videos needing thumbnails\n`);

	const updateStatements: string[] = [];

	for (let i = 0; i < videos.length; i++) {
		const video = videos[i];
		console.log(`[${i + 1}/${videos.length}] Processing ${video.id}...`);

		const result = await generateThumbnail(video.url, video.id);

		if (result) {
			console.log(`  ✓ Thumbnail created: ${result.thumbnailUrl}`);
			const sql = `UPDATE videos SET thumbnailUrl = '${result.thumbnailUrl}' WHERE id = '${video.id}';`;
			updateStatements.push(sql);
		} else {
			console.log('  ✗ Failed to generate thumbnail');
		}

		console.log('');
	}

	console.log(`\n✅ Processed ${videos.length} videos`);
	console.log(`📝 Generated ${updateStatements.length} thumbnails\n`);

	if (updateStatements.length > 0) {
		// Write updates to file
		const updateSql = updateStatements.join('\n');
		await Bun.write('thumbnail-updates.sql', updateSql);

		console.log('Saved SQL to thumbnail-updates.sql');
		console.log('\nTo apply updates, run:');
		console.log('  npx wrangler d1 execute r10-videos --remote --file=thumbnail-updates.sql');
	} else {
		console.log('No thumbnails generated.');
	}
}

// Run
generateAllThumbnails().catch((error) => {
	console.error('Thumbnail generation failed:', error);
	process.exit(1);
});

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

const execAsync = promisify(exec);
const ffmpegPath = ffmpegInstaller.path;

export const POST: RequestHandler = async ({ request }) => {
	const tmpDir = join(tmpdir(), 'r10-video-mix');

	try {
		// Parse multipart form data
		const formData = await request.formData();
		const videoFile = formData.get('video') as File;
		const audioUrl = formData.get('audioUrl') as string;

		if (!videoFile || !audioUrl) {
			return json({ error: 'Missing video file or audio URL' }, { status: 400 });
		}

		// Create temp directory
		await mkdir(tmpDir, { recursive: true });

		// Save uploaded video to temp file
		const videoBytes = await videoFile.arrayBuffer();
		const videoPath = join(tmpDir, `input-${Date.now()}.webm`);
		await writeFile(videoPath, Buffer.from(videoBytes));

		// Download audio from iTunes
		const audioResponse = await fetch(audioUrl);
		if (!audioResponse.ok) {
			throw new Error('Failed to download audio');
		}
		const audioBytes = await audioResponse.arrayBuffer();
		const audioPath = join(tmpDir, `audio-${Date.now()}.m4a`);
		await writeFile(audioPath, Buffer.from(audioBytes));

		// Output path
		const outputPath = join(tmpDir, `output-${Date.now()}.mp4`);

		// Use FFmpeg to mix video and audio
		const ffmpegCommand = `"${ffmpegPath}" -i "${videoPath}" -i "${audioPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 192k -shortest "${outputPath}"`;

		console.log('Running FFmpeg command...');
		await execAsync(ffmpegCommand);

		// Read the output file
		const outputBuffer = await readFile(outputPath);

		// Get R2 credentials
		const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = env;

		if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
			console.error('R2 credentials not configured');
			return json({ error: 'R2 not configured' }, { status: 500 });
		}

		// Initialize S3 client for R2
		const s3Client = new S3Client({
			region: 'auto',
			endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: R2_ACCESS_KEY_ID,
				secretAccessKey: R2_SECRET_ACCESS_KEY
			}
		});

		// Generate unique key for mixed video
		const timestamp = Date.now();
		const r2Key = `mixed-videos/video-${timestamp}.mp4`;

		// Upload to R2
		const uploadCommand = new PutObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: r2Key,
			Body: outputBuffer,
			ContentType: 'video/mp4'
		});

		await s3Client.send(uploadCommand);
		console.log('Mixed video uploaded to R2:', r2Key);

		// Submit to RunPod with R2 reference
		const { RUNPOD_ENDPOINT, RUNPOD_API_KEY } = env;

		if (!RUNPOD_ENDPOINT || !RUNPOD_API_KEY) {
			console.error('RunPod credentials not configured');
			return json({ error: 'RunPod not configured' }, { status: 500 });
		}

		const sessionId = crypto.randomUUID();
		const runpodPayload = {
			input: {
				video_reference: r2Key,
				audio_url: audioUrl,
				session_id: sessionId
			}
		};

		console.log('Submitting to RunPod:', runpodPayload);

		const runpodResponse = await fetch(`${RUNPOD_ENDPOINT}/run`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${RUNPOD_API_KEY}`
			},
			body: JSON.stringify(runpodPayload)
		});

		if (!runpodResponse.ok) {
			const errorText = await runpodResponse.text();
			console.error('RunPod submission failed:', errorText);
			return json({ error: 'RunPod submission failed', details: errorText }, { status: 500 });
		}

		const runpodResult = await runpodResponse.json();
		console.log('RunPod job submitted:', runpodResult);

		// Get public URL (you'll need to configure R2 public access or generate signed URL)
		const publicUrl = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${r2Key}`;

		// Clean up temp files
		await Promise.all([
			unlink(videoPath).catch(() => {}),
			unlink(audioPath).catch(() => {}),
			unlink(outputPath).catch(() => {})
		]);

		// Return R2 info and RunPod job ID
		return json({
			success: true,
			r2Key,
			publicUrl,
			size: outputBuffer.length,
			runpodJobId: runpodResult.id,
			sessionId
		});
	} catch (error) {
		console.error('Error mixing video:', error);
		return json(
			{ error: 'Failed to mix video', details: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};

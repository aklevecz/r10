// import { json } from '@sveltejs/kit';
// import type { RequestHandler } from './$types';
// import { exec } from 'child_process';
// import { promisify } from 'util';
// import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
// import { join } from 'path';
// import { tmpdir } from 'os';
// import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
// import { put } from '@vercel/blob';
// import { BLOB_READ_WRITE_TOKEN } from '$env/static/private';

// const execAsync = promisify(exec);
// const ffmpegPath = ffmpegInstaller.path;

// export const POST: RequestHandler = async ({ request }) => {
// 	const tmpDir = join(tmpdir(), 'r10-video-mix');

// 	try {
// 		// Parse JSON body (now receiving URLs instead of files)
// 		const body = await request.json();
// 		const { videoUrl, audioUrl } = body;

// 		if (!videoUrl || !audioUrl) {
// 			return json({ error: 'Missing video URL or audio URL' }, { status: 400 });
// 		}

// 		// Create temp directory
// 		await mkdir(tmpDir, { recursive: true });

// 		// Download video and audio in parallel
// 		const [videoResponse, audioResponse] = await Promise.all([
// 			fetch(videoUrl),
// 			fetch(audioUrl)
// 		]);

// 		if (!videoResponse.ok) {
// 			throw new Error('Failed to download video from blob');
// 		}
// 		if (!audioResponse.ok) {
// 			throw new Error('Failed to download audio');
// 		}

// 		// Get video and audio bytes in parallel
// 		const [videoBytes, audioBytes] = await Promise.all([
// 			videoResponse.arrayBuffer(),
// 			audioResponse.arrayBuffer()
// 		]);

// 		// Detect video format from URL or content-type
// 		const isMP4 = videoUrl.includes('.mp4') || videoResponse.headers.get('content-type')?.includes('mp4');
// 		const videoExt = isMP4 ? 'mp4' : 'webm';
// 		const videoPath = join(tmpDir, `input-${Date.now()}.${videoExt}`);
// 		const audioPath = join(tmpDir, `audio-${Date.now()}.m4a`);

// 		// Write both files in parallel
// 		await Promise.all([
// 			writeFile(videoPath, Buffer.from(videoBytes)),
// 			writeFile(audioPath, Buffer.from(audioBytes))
// 		]);

// 		// Output path
// 		const outputPath = join(tmpDir, `output-${Date.now()}.mp4`);

// 		// Use FFmpeg to mix video and audio
// 		// If input is MP4/H.264, use stream copy for instant muxing (10x+ faster)
// 		// If input is WebM, must re-encode
// 		const ffmpegCommand = isMP4
// 			? `"${ffmpegPath}" -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -b:a 128k -shortest "${outputPath}"`
// 			: `"${ffmpegPath}" -i "${videoPath}" -i "${audioPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 192k -shortest "${outputPath}"`;

// 		console.log('Running FFmpeg command...');
// 		await execAsync(ffmpegCommand);

// 		// Read the output file
// 		const outputBuffer = await readFile(outputPath);

// 		// Upload to Vercel Blob
// 		const timestamp = Date.now();
// 		const blob = await put(`mixed-videos/video-${timestamp}.mp4`, outputBuffer, {
// 			access: 'public',
// 			contentType: 'video/mp4',
// 			token: BLOB_READ_WRITE_TOKEN
// 		});

// 		console.log('Mixed video uploaded to Vercel Blob:', blob.url);

// 		// Clean up temp files
// 		await Promise.all([
// 			unlink(videoPath).catch(() => {}),
// 			unlink(audioPath).catch(() => {}),
// 			unlink(outputPath).catch(() => {})
// 		]);

// 		// Return Vercel Blob info
// 		return json({
// 			success: true,
// 			publicUrl: blob.url,
// 			size: outputBuffer.length
// 		});
// 	} catch (error) {
// 		console.error('Error mixing video:', error);
// 		return json(
// 			{ error: 'Failed to mix video', details: error instanceof Error ? error.message : 'Unknown error' },
// 			{ status: 500 }
// 		);
// 	}
// };

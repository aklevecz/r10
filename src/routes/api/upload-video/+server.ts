import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse multipart form data
		const formData = await request.formData();
		const videoFile = formData.get('video') as File;

		if (!videoFile) {
			return json({ error: 'Missing video file' }, { status: 400 });
		}

		// Get R2 credentials from environment
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
			},
			forcePathStyle: true,
			tls: true
		});

		// Generate unique key for video
		const timestamp = Date.now();
		const key = `videos/recording-${timestamp}.webm`;

		// Convert file to buffer
		const arrayBuffer = await videoFile.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Upload to R2
		const uploadCommand = new PutObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key,
			Body: buffer,
			ContentType: 'video/webm'
		});

		await s3Client.send(uploadCommand);

		console.log('Video uploaded to R2:', key);

		return json({
			success: true,
			key,
			size: buffer.length
		});
	} catch (error) {
		console.error('Error uploading video to R2:', error);
		return json(
			{ error: 'Failed to upload video', details: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};

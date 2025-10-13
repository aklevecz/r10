import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import type { RequestHandler } from './$types';
import { BLOB_READ_WRITE_TOKEN } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as HandleUploadBody;

	try {
		const jsonResponse = await handleUpload({
			body,
			request,
			onBeforeGenerateToken: async () => {
				return {
					allowedContentTypes: ['video/webm', 'video/mp4'],
					maximumSizeInBytes: 100 * 1024 * 1024 // 100MB
				};
			},
			token: BLOB_READ_WRITE_TOKEN
		});

		return new Response(JSON.stringify(jsonResponse), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		console.error('Token generation error:', error);
		return new Response(
			JSON.stringify({ error: (error as Error).message }),
			{
				status: 400,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	}
};

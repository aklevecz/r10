import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID, RUNPOD_WEBHOOK_SECRET } from '$env/static/private';
import { dev } from '$app/environment';

async function checkRateLimit(
	KV: KVNamespace,
	key: string,
	maxRequests = 5,
	windowSeconds = 300
): Promise<{ allowed: boolean; remaining: number }> {
	const now = Math.floor(Date.now() / 1000);
	const recordStr = await KV.get(key);

	if (!recordStr) {
		// First request - create record with expiration
		await KV.put(key, JSON.stringify({ count: 1, resetTime: now + windowSeconds }), {
			expirationTtl: windowSeconds
		});
		return { allowed: true, remaining: maxRequests - 1 };
	}

	const record = JSON.parse(recordStr) as { count: number; resetTime: number };

	// Check if window has expired
	if (now > record.resetTime) {
		// Reset the counter
		await KV.put(key, JSON.stringify({ count: 1, resetTime: now + windowSeconds }), {
			expirationTtl: windowSeconds
		});
		return { allowed: true, remaining: maxRequests - 1 };
	}

	// Check if limit exceeded
	if (record.count >= maxRequests) {
		return { allowed: false, remaining: 0 };
	}

	// Increment counter
	record.count++;
	await KV.put(key, JSON.stringify(record), {
		expirationTtl: record.resetTime - now
	});

	return { allowed: true, remaining: maxRequests - record.count };
}

export const POST: RequestHandler = async ({ request, getClientAddress, platform }) => {
	try {
		const KV = platform?.env?.KV;
		if (!KV) {
			console.error('KV binding not available');
			return json({ success: false, error: 'Service temporarily unavailable' }, { status: 503 });
		}

		const params = await request.json();

		// Honeypot check - reject if email field is filled
		if (params.email) {
			return json({ success: false, error: 'Invalid request' }, { status: 400 });
		}

		// Origin/referer checking in production only
		if (!dev) {
			const origin = request.headers.get('origin');
			const referer = request.headers.get('referer');
			const allowedOrigins = [
				'https://r10.concertraptors.com',
				'https://www.r10.concertraptors.com'
			];

			const isValidOrigin =
				(origin && allowedOrigins.includes(origin)) ||
				(referer && allowedOrigins.some((allowed) => referer.startsWith(allowed)));

			if (!isValidOrigin) {
				return json({ success: false, error: 'Forbidden' }, { status: 403 });
			}
		}

		// Rate limiting based on IP + sessionId
		const clientIp = getClientAddress();
		const sessionId = params.sessionId || 'unknown';
		const rateLimitKey = `ratelimit:render:${clientIp}:${sessionId}`;

		const rateLimit = await checkRateLimit(KV, rateLimitKey, 5, 300); // 5 requests per 5 minutes

		if (!rateLimit.allowed) {
			return json(
				{
					success: false,
					error: 'Rate limit exceeded. Please wait a few minutes before rendering again.'
				},
				{ status: 429 }
			);
		}

		// Submit job to RunPod with webhook
		const runpodEndpoint = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`;

		// Construct webhook URL (only in production)
		const webhookUrl = dev
			? undefined
			: `https://r10.concertraptors.com/api/webhook/video-complete?secret=${RUNPOD_WEBHOOK_SECRET}`;

		const requestBody: { input: typeof params; webhook?: string } = {
			input: params
		};

		if (webhookUrl) {
			requestBody.webhook = webhookUrl;
		}

		const response = await fetch(runpodEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${RUNPOD_API_KEY}`
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			throw new Error(`RunPod API error: ${response.statusText}`);
		}

		const data = await response.json();
		return json({ success: true, jobId: data.id, remaining: rateLimit.remaining });
	} catch (error) {
		console.error('Error submitting render job:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

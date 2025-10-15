import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const query = url.searchParams.get('q');

		if (!query) {
			return json({ error: 'Query parameter required' }, { status: 400 });
		}

		const response = await fetch(
			`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=25`
		);

		if (!response.ok) {
			throw new Error('Failed to fetch from iTunes');
		}

		const data = await response.json();

		return json({
			success: true,
			results: data.results
		});
	} catch (error) {
		console.error('Error searching songs:', error);
		return json(
			{
				error: 'Failed to search songs',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

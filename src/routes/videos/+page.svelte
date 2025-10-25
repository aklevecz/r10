<script lang="ts">
	interface VideoMetadata {
		audioUrl: string;
		distortionType: string;
		trailHue: string;
		trailSat: string;
		trailLight: string;
		pngUrl: string;
		profile: string;
		sessionId: string;
		renderedAt: string;
		songName: string;
		artistName: string;
		artworkUrl: string;
	}

	interface Video {
		key: string;
		url: string;
		uploaded: string;
		size: number;
		thumbnailUrl: string;
		metadata: VideoMetadata;
	}

	let videos = $state<Video[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedVideo = $state<Video | null>(null);

	async function loadVideos() {
		try {
			loading = true;
			const response = await fetch('/api/videos');
			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || 'Failed to load videos');
			}

			videos = data.videos;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load videos';
		} finally {
			loading = false;
		}
	}

	function selectVideo(video: Video) {
		selectedVideo = video;
	}

	function closeVideo() {
		selectedVideo = null;
	}

	function formatDate(dateString: string) {
		const date = new Date(dateString);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	}

	function formatSize(bytes: number) {
		const mb = bytes / (1024 * 1024);
		return mb.toFixed(2) + ' MB';
	}

	loadVideos();
</script>

<div class="min-h-screen bg-black text-white p-8">
	<div class="max-w-4xl mx-auto">
		<h1 class="text-4xl font-bold mb-8">All Rendered Videos</h1>

		{#if loading}
			<div class="text-center py-12">
				<div class="text-xl text-gray-400">Loading videos...</div>
			</div>
		{:else if error}
			<div class="text-center py-12">
				<div class="text-xl text-red-500">{error}</div>
			</div>
		{:else if videos.length === 0}
			<div class="text-center py-12">
				<div class="text-xl text-gray-400">No videos found</div>
			</div>
		{:else}
			<div class="text-gray-400 mb-4">{videos.length} videos total</div>

			<div class="space-y-4">
				{#each videos as video}
					<button
						onclick={() => selectVideo(video)}
						class="w-full bg-gray-900 hover:bg-gray-800 transition-colors p-4 rounded-lg text-left border border-gray-800 hover:border-gray-700 flex gap-4"
					>
						{#if video.thumbnailUrl}
							<img
								src={video.thumbnailUrl}
								alt={video.metadata.songName}
								class="w-16 h-16 rounded flex-shrink-0 object-cover"
							/>
						{:else if video.metadata.artworkUrl}
							<img
								src={video.metadata.artworkUrl}
								alt={video.metadata.songName}
								class="w-16 h-16 rounded flex-shrink-0"
							/>
						{/if}
						<div class="flex-1 min-w-0">
							<div class="flex justify-between items-start mb-2">
								<div class="flex-1 min-w-0">
									<div class="text-lg font-semibold text-white truncate">
										{video.metadata.songName || video.key.split('/').pop() || video.key}
									</div>
									<div class="text-gray-400 text-sm">
										{#if video.metadata.artistName}
											{video.metadata.artistName}
										{:else if video.metadata.profile}
											Profile: {video.metadata.profile}
										{/if}
										{#if video.metadata.distortionType}
											• Distortion: {video.metadata.distortionType}
										{/if}
									</div>
								</div>
								<div class="text-sm text-gray-500 ml-4 flex-shrink-0">
									{formatSize(video.size)}
								</div>
							</div>
							<div class="text-sm text-gray-500">
								{formatDate(video.uploaded)}
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Video Player Modal -->
{#if selectedVideo}
	<div
		class="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
		onclick={closeVideo}
	>
		<div
			class="bg-gray-900 rounded-lg max-w-4xl w-full p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex justify-between items-start mb-4">
				<div class="flex-1 min-w-0">
					<h2 class="text-2xl font-bold text-white mb-1">
						{selectedVideo.metadata.songName || selectedVideo.key.split('/').pop() || selectedVideo.key}
					</h2>
					<div class="text-gray-400">
						{#if selectedVideo.metadata.artistName}
							{selectedVideo.metadata.artistName}
						{:else if selectedVideo.metadata.profile}
							Profile: {selectedVideo.metadata.profile}
						{/if}
					</div>
				</div>
				<button
					onclick={closeVideo}
					class="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center"
				>
					×
				</button>
			</div>

			<video
				src={selectedVideo.url}
				controls
				autoplay
				class="w-full rounded-lg bg-black"
			/>

			<div class="mt-4 text-sm text-gray-500 space-y-1">
				<div>Uploaded: {formatDate(selectedVideo.uploaded)}</div>
				<div>Size: {formatSize(selectedVideo.size)}</div>
				{#if selectedVideo.metadata.distortionType}
					<div>Distortion Type: {selectedVideo.metadata.distortionType}</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<script lang="ts">
	import AudioVisualizer from './AudioVisualizer.svelte';
	import VideoRecorder from './VideoRecorder.svelte';

	interface Song {
		trackId: number;
		trackName: string;
		artistName: string;
		artworkUrl100: string;
		previewUrl: string;
		collectionName: string;
	}

	let searchQuery = $state('');
	let songs = $state<Song[]>([]);
	let loading = $state(false);
	let error = $state('');
	let selectedSong = $state<Song | null>(null);
	let audioElement = $state<HTMLAudioElement | null>(null);
	let isPlaying = $state(false);
	let canvasElement = $state<HTMLCanvasElement | null>(null);
	let mixing = $state(false);
	let mixedVideoUrl = $state<string | null>(null);

	async function searchSongs() {
		if (!searchQuery.trim()) return;

		loading = true;
		error = '';
		songs = [];

		try {
			const response = await fetch(
				`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&limit=10`
			);

			if (!response.ok) {
				throw new Error('Failed to fetch songs');
			}

			const data = await response.json();
			songs = data.results;

			if (songs.length === 0) {
				error = 'No songs found';
			}
		} catch (err) {
			error = 'Error searching for songs';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	function playSong(song: Song) {
		selectedSong = song;

		if (audioElement) {
			audioElement.src = song.previewUrl;
			audioElement.load();
			audioElement.play().then(() => {
				isPlaying = true;
				console.log('Audio playing');
			}).catch(err => {
				console.error('Error playing audio:', err);
				isPlaying = false;
			});
		}
	}

	function togglePlayPause() {
		if (!audioElement) return;

		if (isPlaying) {
			audioElement.pause();
		} else {
			audioElement.play().catch(err => {
				console.error('Error playing audio:', err);
			});
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			searchSongs();
		}
	}

	function handleAudioEnd() {
		isPlaying = false;
	}

	async function handleRecordingComplete(videoBlob: Blob) {
		if (!selectedSong) return;

		mixing = true;
		mixedVideoUrl = null;
		error = '';

		try {
			const formData = new FormData();
			formData.append('video', videoBlob, 'recording.webm');
			formData.append('audioUrl', selectedSong.previewUrl);

			const response = await fetch('/api/mix-video', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error('Failed to mix video');
			}

			const result = await response.json();

			if (result.success) {
				mixedVideoUrl = result.publicUrl;
				console.log('Video mixed and uploaded to R2:', result.r2Key);
			} else {
				throw new Error(result.error || 'Failed to mix video');
			}
		} catch (err) {
			console.error('Error mixing video:', err);
			error = 'Failed to mix video';
		} finally {
			mixing = false;
		}
	}
</script>

<div class="w-full max-w-2xl mx-auto space-y-6">
	<!-- Search Input -->
	<div class="space-y-4">
		<div class="flex gap-2">
			<input
				type="text"
				bind:value={searchQuery}
				onkeydown={handleKeydown}
				placeholder="Search for a song..."
				class="input flex-1"
			/>
			<button onclick={searchSongs} disabled={loading || !searchQuery.trim()} class="btn-primary">
				{loading ? 'Searching...' : 'Search'}
			</button>
		</div>

		{#if error}
			<p class="text-white/80 text-center">{error}</p>
		{/if}
	</div>

	<!-- Search Results -->
	{#if songs.length > 0}
		<div class="space-y-3">
			<h2 class="text-xl font-semibold text-white">Results</h2>
			<div class="space-y-2">
				{#each songs as song (song.trackId)}
					<button
						onclick={() => playSong(song)}
						class="w-full card-hover flex items-center gap-4 p-4 text-left"
					>
						<img src={song.artworkUrl100} alt={song.trackName} class="w-16 h-16 rounded-lg" />
						<div class="flex-1 min-w-0">
							<h3 class="font-semibold text-white truncate">{song.trackName}</h3>
							<p class="text-sm text-white/70 truncate">{song.artistName}</p>
							<p class="text-xs text-white/50 truncate">{song.collectionName}</p>
						</div>
						<svg
							class="w-6 h-6 text-[#3eb5b5] flex-shrink-0"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"
							/>
						</svg>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Audio Element (always rendered to prevent removal) -->
	<audio
		bind:this={audioElement}
		onended={handleAudioEnd}
		onplay={() => (isPlaying = true)}
		onpause={() => (isPlaying = false)}
		crossorigin="anonymous"
		class="hidden"
	>
		<track kind="captions" />
	</audio>

	<!-- Audio Player with Visualizer -->
	{#if selectedSong}
		<div class="card space-y-6">
			<!-- Visualizer -->
			<AudioVisualizer {audioElement} {isPlaying} bind:canvas={canvasElement} />

			<!-- Video Recorder -->
			<VideoRecorder
				canvas={canvasElement}
				audioUrl={selectedSong.previewUrl}
				{isPlaying}
				onRecordingComplete={handleRecordingComplete}
			/>

			{#if mixing}
				<div class="card bg-blue-900/20 border-blue-700">
					<p class="text-blue-400 text-sm flex items-center gap-2">
						<span class="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
						Mixing video with audio...
					</p>
				</div>
			{/if}

			{#if mixedVideoUrl}
				<div class="card space-y-4">
					<h3 class="font-semibold text-white">Your Video</h3>
					<video src={mixedVideoUrl} controls class="w-full rounded-lg shadow-lg"></video>
					<a
						href={mixedVideoUrl}
						download="r10-video.mp4"
						class="btn-primary inline-block text-center"
					>
						Download Video
					</a>
				</div>
			{/if}

			<!-- Player Controls -->
			<div class="flex items-center gap-4">
				<img
					src={selectedSong.artworkUrl100}
					alt={selectedSong.trackName}
					class="w-20 h-20 rounded-lg shadow-lg"
				/>
				<div class="flex-1 min-w-0">
					<h3 class="font-semibold text-white truncate">{selectedSong.trackName}</h3>
					<p class="text-sm text-white/70 truncate">{selectedSong.artistName}</p>
				</div>
				<button
					onclick={togglePlayPause}
					class="w-12 h-12 rounded-full bg-[#3eb5b5] hover:bg-[#2e9999] flex items-center justify-center transition-colors flex-shrink-0"
				>
					{#if isPlaying}
						<!-- Pause Icon -->
						<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
							<path
								d="M5.5 3.5A1.5 1.5 0 017 2h1a1.5 1.5 0 011.5 1.5v13A1.5 1.5 0 018 18H7a1.5 1.5 0 01-1.5-1.5v-13zm7 0A1.5 1.5 0 0114 2h1a1.5 1.5 0 011.5 1.5v13A1.5 1.5 0 0115 18h-1a1.5 1.5 0 01-1.5-1.5v-13z"
							/>
						</svg>
					{:else}
						<!-- Play Icon -->
						<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
							<path
								d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"
							/>
						</svg>
					{/if}
				</button>
			</div>

			<!-- Native Controls for debugging -->
			<audio
				src={selectedSong.previewUrl}
				crossorigin="anonymous"
				class="w-full"
				controls
			>
				<track kind="captions" />
			</audio>
		</div>
	{/if}
</div>

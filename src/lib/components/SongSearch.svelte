<script lang="ts">
	import AudioVisualizerWebGL from './AudioVisualizerWebGL.svelte';
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
	let videoRecorder: any = null;
	let runpodJobId = $state<string | null>(null);
	let runpodStatus = $state<string | null>(null);
	let finalVideoUrl = $state<string | null>(null);
	let pollingInterval: number | null = null;
	let recordedVideoBlob = $state<Blob | null>(null);
	let recordedVideoUrl = $state<string | null>(null);
	let showCompletion = $state(false);

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
		// Create a brand new audio element for each song to avoid MediaElementSource conflicts
		audioElement = new Audio();
		audioElement.crossOrigin = 'anonymous';
		audioElement.src = song.previewUrl;

		audioElement.onended = () => {
			isPlaying = false;
			videoRecorder?.stopRecording();
		};
		audioElement.onplay = () => {
			isPlaying = true;
			videoRecorder?.startRecording();
		};
		audioElement.onpause = () => {
			isPlaying = false;
			videoRecorder?.stopRecording();
		};

		selectedSong = song;

		audioElement.load();
		audioElement.play().then(() => {
			isPlaying = true;
			console.log('Audio playing');
		}).catch(err => {
			console.error('Error playing audio:', err);
			isPlaying = false;
		});
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

	async function checkRunPodStatus(jobId: string) {
		try {
			const response = await fetch(`/api/runpod/status/${jobId}`);
			const result = await response.json();

			if (result.success) {
				runpodStatus = result.status;
				console.log('RunPod status:', result.status);

				if (result.status === 'COMPLETED' && result.output?.combined_video) {
					finalVideoUrl = result.output.combined_video;
					stopPolling();
				} else if (['FAILED', 'TIMED_OUT', 'CANCELLED'].includes(result.status)) {
					error = `RunPod job ${result.status.toLowerCase()}`;
					stopPolling();
				}
			}
		} catch (err) {
			console.error('Error checking RunPod status:', err);
		}
	}

	function startPolling(jobId: string) {
		let attempts = 0;
		const maxAttempts = 60;

		const poll = async () => {
			attempts++;
			await checkRunPodStatus(jobId);

			if (attempts >= maxAttempts || ['COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED'].includes(runpodStatus || '')) {
				stopPolling();
				return;
			}

			// Exponential backoff: start at 2s, max at 30s
			const delay = Math.min(2000 * Math.pow(1.5, Math.floor(attempts / 5)), 30000);
			pollingInterval = setTimeout(poll, delay) as unknown as number;
		};

		// Start first poll after 2 seconds
		pollingInterval = setTimeout(poll, 2000) as unknown as number;
	}

	function stopPolling() {
		if (pollingInterval) {
			clearTimeout(pollingInterval);
			pollingInterval = null;
		}
	}

	async function handleRecordingComplete(videoBlob: Blob) {
		// Store the recorded video for preview
		recordedVideoBlob = videoBlob;
		recordedVideoUrl = URL.createObjectURL(videoBlob);
	}

	async function acceptRecording() {
		if (!selectedSong || !recordedVideoBlob) return;

		mixing = true;
		mixedVideoUrl = null;
		runpodJobId = null;
		runpodStatus = null;
		finalVideoUrl = null;
		error = '';
		showCompletion = false;

		try {
			const formData = new FormData();
			formData.append('video', recordedVideoBlob, 'recording.webm');
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
				runpodJobId = result.runpodJobId;
				console.log('Video mixed and uploaded to R2:', result.r2Key);
				console.log('Public URL:', result.publicUrl);
				console.log('RunPod job ID:', result.runpodJobId);

				// Show completion view
				showCompletion = true;

				// Start polling for RunPod job status
				if (runpodJobId) {
					startPolling(runpodJobId);
				}
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

	function backToSearch() {
		// Clear everything and go back to search
		if (recordedVideoUrl) {
			URL.revokeObjectURL(recordedVideoUrl);
		}
		recordedVideoBlob = null;
		recordedVideoUrl = null;
		selectedSong = null;
		if (audioElement) {
			audioElement.pause();
			audioElement.src = '';
		}
		isPlaying = false;
		showCompletion = false;
		mixedVideoUrl = null;
		finalVideoUrl = null;
		runpodJobId = null;
		runpodStatus = null;
		stopPolling();
	}
</script>

<div class="w-full max-w-2xl mx-auto space-y-6">
	<!-- Search Input - hide when song is selected -->
	{#if !selectedSong}
		<div class="space-y-4">
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={searchQuery}
					onkeydown={handleKeydown}
					placeholder="RSVP with a song..."
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
	{/if}

	<!-- Search Results -->
	{#if songs.length > 0 && !selectedSong}
		<div class="space-y-3">
			<h2 class="text-xl font-semibold text-center text-white animate-pulse drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">Pick a song or try again!</h2>
			<div class="space-y-2">
				{#each songs as song (song.trackId)}
					<button
						onclick={() => playSong(song)}
						class="w-full card-hover flex items-center gap-4 p-4 text-left"
					>
						<img src={song.artworkUrl100} alt={song.trackName} class="w-16 h-16 border-[3px] border-white" />
						<div class="flex-1 min-w-0">
							<h3 class="font-semibold text-white truncate">{song.trackName}</h3>
							<p class="text-sm text-white/70 truncate">{song.artistName}</p>
							<p class="text-xs text-white/50 truncate">{song.collectionName}</p>
						</div>
						<svg
							class="w-6 h-6 text-white flex-shrink-0"
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
		onended={() => {
			isPlaying = false;
			videoRecorder?.stopRecording();
		}}
		onplay={() => {
			isPlaying = true;
			videoRecorder?.startRecording();
		}}
		onpause={() => {
			isPlaying = false;
			videoRecorder?.stopRecording();
		}}
		crossorigin="anonymous"
		class="hidden"
	>
		<track kind="captions" />
	</audio>

	<!-- Audio Player with Visualizer -->
	{#if selectedSong && !showCompletion}
		<div class="card space-y-6">
			<!-- Visualizer -->
			<AudioVisualizerWebGL {audioElement} {isPlaying} bind:canvas={canvasElement} />

			<!-- Video Recorder -->
			<VideoRecorder
				bind:this={videoRecorder}
				canvas={canvasElement}
				onRecordingComplete={handleRecordingComplete}
			/>

			{#if recordedVideoUrl && !mixing && !mixedVideoUrl}
				<div class="card space-y-4">
					<div class="flex gap-4">
						<button onclick={acceptRecording} class="btn-primary flex-1">
							ACCEPT
						</button>
						<button onclick={backToSearch} class="btn-secondary flex-1">
							← Back to Search
						</button>
					</div>
				</div>
			{/if}

			{#if mixing}
				<div class="card bg-blue-900/20 border-blue-700">
					<p class="text-blue-400 text-sm flex items-center gap-2">
						<span class="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
						Mixing video with audio...
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Completion View -->
	{#if showCompletion}
		<div class="card space-y-6">
			<div class="text-center space-y-4">
				<h2 class="text-3xl font-bold text-white">RSVP Complete!</h2>
				<p class="text-xl text-white/90">You're on the list.</p>
				<p class="text-lg text-white/70">You'll receive details about the party soon.</p>
			</div>

			{#if mixedVideoUrl}
				<div class="space-y-4">
					<h3 class="font-semibold text-white text-center">Your Video</h3>
					<video src={mixedVideoUrl} controls class="w-full border-[3px] border-white"></video>
				</div>
			{/if}

			{#if runpodJobId && !finalVideoUrl}
				<div class="card bg-purple-900/20 border-purple-700">
					<p class="text-purple-400 text-sm flex items-center gap-2">
						<span class="inline-block w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></span>
						AI processing: {runpodStatus || 'IN_QUEUE'}
					</p>
				</div>
			{/if}

			{#if finalVideoUrl}
				<div class="space-y-4">
					<h3 class="font-semibold text-white text-center">Final AI Video</h3>
					<video src={finalVideoUrl} controls class="w-full border-[3px] border-white"></video>
					<a
						href={finalVideoUrl}
						download="r10-final.mp4"
						class="btn-primary inline-block text-center w-full"
					>
						Download Final Video
					</a>
				</div>
			{/if}

			<button onclick={backToSearch} class="btn-secondary w-full">
				← Make Another RSVP
			</button>
		</div>
	{/if}
</div>

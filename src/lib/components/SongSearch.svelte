<script lang="ts">
	import { onMount } from 'svelte';
	import Typewriter from './Typewriter.svelte';
	import VisualizerLoadingScreen from './VisualizerLoadingScreen.svelte';
	import { cubicOut } from 'svelte/easing';
	import { R10ServerRenderer } from '$lib/api/server-renderer';

	function slideIn(node: HTMLElement, { duration = 300 } = {}) {
		return {
			duration,
			css: (t: number) => {
				const eased = cubicOut(t);
				return `
					transform: translateY(${(1 - eased) * -20}px);
					opacity: ${eased};
				`;
			}
		};
	}

	interface Props {
		isSearching?: boolean;
	}

	let { isSearching = $bindable(false) }: Props = $props();

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
	let mixedVideoUrl = $state<string | null>(null);
	let showCompletion = $state(false);
	let typewriterComplete = $state(false);
	let contactInfo = $state<string>('');
	let submittingContact = $state(false);
	let contactSubmitted = $state(false);
	let isDesktop = $state(false);

	// Server rendering state
	let serverRendering = $state(false);
	let serverRenderProgress = $state('');
	const serverRenderer = new R10ServerRenderer();

	onMount(async () => {
		// Resume cached render job if exists
		const result = await serverRenderer.resumeCachedJob();
		if (result) {
			// Found a cached job - show the loading screen
			serverRendering = true;
			serverRenderProgress = 'resuming render...';

			// Create a dummy selectedSong to show the loading screen
			// (We don't have the song details from cache, but we need something)
			selectedSong = {
				trackId: 0,
				trackName: 'Resuming...',
				artistName: '',
				artworkUrl100: '',
				previewUrl: '',
				collectionName: ''
			};

			if (result.status === 'success' && result.video_url) {
				serverRenderProgress = 'complete!';
				mixedVideoUrl = result.video_url;
				showCompletion = true;
				serverRendering = false;
			} else {
				error = result.error || result.message || 'rendering failed';
				serverRenderProgress = '';
				serverRendering = false;
			}
		}
	});

	$effect(() => {
		// Check if window width is desktop (>768px)
		const checkWidth = () => {
			isDesktop = window.innerWidth > 768;
		};
		checkWidth();
		window.addEventListener('resize', checkWidth);
		return () => window.removeEventListener('resize', checkWidth);
	});

	async function searchSongs() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		loading = true;
		error = '';
		songs = [];

		try {
			const response = await fetch(`/api/search-songs?q=${encodeURIComponent(searchQuery)}`);

			if (!response.ok) {
				throw new Error('Failed to fetch songs');
			}

			const data = await response.json();

			if (data.success) {
				songs = data.results;

				if (songs.length === 0) {
					error = 'No songs found';
				}
			} else {
				throw new Error(data.error || 'Failed to search songs');
			}
		} catch (err) {
			error = 'Error searching for songs';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	function playSong(song: Song) {
		// Set state to show loading screen
		selectedSong = song;
		error = '';
		mixedVideoUrl = null;
		showCompletion = false;
		serverRendering = true;

		// Submit RunPod job independently
		submitRunPodJob(song);
	}

	async function submitRunPodJob(song: Song) {
		serverRenderProgress = 'submitting job to runpod...';

		try {
			// Randomize parameters for unique visuals each time
			const params = {
				audioUrl: song.previewUrl,
				distortionType: Math.floor(Math.random() * 5), // 0-4
				trailHue: Math.floor(Math.random() * 360), // 0-359
				trailSat: 80 + Math.floor(Math.random() * 21), // 80-100
				trailLight: 50 + Math.floor(Math.random() * 31), // 50-80
				pngUrl: 'raptor-bw.png'
			};

			const { jobId } = await serverRenderer.submitRenderJob(params);

			serverRenderProgress = 'rendering on server (this may take a few minutes)...';
			const result = await serverRenderer.waitForCompletion(jobId);

			if (result.status === 'success' && result.video_url) {
				serverRenderProgress = 'complete!';
				mixedVideoUrl = result.video_url;
				showCompletion = true;
				serverRendering = false;
			} else {
				error = result.error || result.message || 'rendering failed';
				serverRenderProgress = '';
				serverRendering = false;
			}
		} catch (err) {
			console.error('Error rendering video:', err);
			error = err instanceof Error ? err.message : 'rendering failed. please try again or contact teh@raptor.pizza';
			serverRenderProgress = '';
			serverRendering = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			searchSongs();
		}
	}

	async function submitContactInfo() {
		if (!contactInfo.trim()) {
			error = 'please provide contact information';
			return;
		}

		submittingContact = true;
		error = '';

		try {
			const response = await fetch('/api/submit-contact', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					contactInfo: contactInfo,
					videoUrl: mixedVideoUrl,
					songName: selectedSong?.trackName,
					artistName: selectedSong?.artistName
				})
			});

			if (!response.ok) {
				throw new Error('Failed to submit contact info');
			}

			// Contact info submitted successfully
			console.log('Contact info submitted');
			contactSubmitted = true;
		} catch (err) {
			console.error('Error submitting contact info:', err);
			error = 'Failed to submit contact information';
		} finally {
			submittingContact = false;
		}
	}

	function backToSearch() {
		// Clear everything and go back to search
		selectedSong = null;
		showCompletion = false;
		mixedVideoUrl = null;
		contactInfo = '';
		contactSubmitted = false;
		error = '';
		serverRendering = false;
		serverRenderProgress = '';
		// Keep isSearching true if there are still search results
		// isSearching stays true
	}
</script>

<div class="w-full max-w-2xl mx-auto space-y-6">
	<!-- Search Input - hide when song is selected -->
	{#if !selectedSong}
		<div class="space-y-6">
			<div class="text-center py-8">
				<h2 class="text-3xl font-bold text-white animate-pulse" style="text-shadow: 0 0 20px rgb(255 255 255 / 0.6), 0 0 40px rgb(255 255 255 / 0.3), 0 0 60px rgb(255 255 255 / 0.2);">
					<Typewriter text="rsvp with a song..." speed={80} onComplete={() => typewriterComplete = true} />
				</h2>
			</div>

			{#if typewriterComplete}
				<div class="flex flex-col gap-4">
					<input
						in:slideIn={{ duration: 250 }}
						type="text"
						bind:value={searchQuery}
						onkeydown={handleKeydown}
						onfocus={() => isSearching = true}
						placeholder="search for your song"
						class="input flex-1 text-lg py-4 px-6"
					/>
					{#if searchQuery.trim()}
						<button
							in:slideIn={{ duration: 250 }}
							onclick={searchSongs}
							disabled={loading}
							class="btn-primary text-2xl py-4 px-6 font-bold"
						>
							{loading ? 'searching...' : 'search'}
						</button>
					{/if}
				</div>

				{#if error}
					<p class="text-white/80 text-center text-lg lowercase">{error}</p>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- Search Results -->
	{#if songs.length > 0 && !selectedSong}
		<div class="space-y-4">
			<div class="space-y-3">
				{#each songs as song (song.trackId)}
					<button
						onclick={() => playSong(song)}
						class="w-full card-hover flex items-center gap-3 text-left"
					>
						<img src={song.artworkUrl100} alt={song.trackName} class="w-16 h-16 flex-shrink-0" />
						<div class="flex-1 min-w-0">
							<h3 class="font-semibold text-white truncate text-lg">{song.trackName}</h3>
							<p class="text-base text-white/70 truncate">{song.artistName}</p>
							<p class="text-sm text-white/50 truncate">{song.collectionName}</p>
						</div>
						<svg
							class="w-8 h-8 text-white flex-shrink-0"
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


	<!-- RunPod Rendering with Visualizer Loading Screen -->
	{#if selectedSong && serverRendering && !showCompletion}
		<VisualizerLoadingScreen {selectedSong} {serverRenderProgress} />
	{/if}

	<!-- Error State -->
	{#if selectedSong && error && !showCompletion}
		<div class="card space-y-4">
			<div class="bg-red-900 border-[2px] border-red-500 p-4">
				<p class="text-white text-center">{error}</p>
			</div>
			<button onclick={backToSearch} class="btn-secondary text-lg py-4">
				try again
			</button>
		</div>
	{/if}

	<!-- Completion View -->
	{#if showCompletion}
		<div class="card space-y-6">
			{#if contactSubmitted}
				<div class="text-center space-y-4 py-4">
					<h2 class="text-4xl font-bold text-green-400" style="text-shadow: 0 0 20px rgb(74 222 128 / 0.8), 0 0 40px rgb(74 222 128 / 0.4);">rsvp complete!</h2>
					<p class="text-2xl text-green-300" style="text-shadow: 0 0 15px rgb(134 239 172 / 0.6);">you're on the list.</p>
				</div>
			{/if}

			{#if mixedVideoUrl}
				<div class="space-y-4">
					<video src={mixedVideoUrl ?? undefined} controls playsinline class="w-full"></video>
					<div class="flex gap-3">
						{#if isDesktop}
							<a
								href={`/api/download-video?url=${encodeURIComponent(mixedVideoUrl)}`}
								class="btn-primary inline-block text-center flex-1 text-lg py-4"
							>
								download
							</a>
						{/if}
						<button
							onclick={() => {
								if (navigator.share && mixedVideoUrl) {
									navigator.share({
										title: 'R10',
										url: mixedVideoUrl
									}).catch(err => console.log('Share failed:', err));
								} else {
									window.open(`https://www.instagram.com/`, '_blank');
								}
							}}
							class="btn-secondary text-center text-lg py-4"
							class:flex-1={isDesktop}
							class:w-full={!isDesktop}
						>
							share
						</button>
					</div>
				</div>
			{/if}


			<!-- Contact Form or Success Message -->
			{#if !contactSubmitted}
				<div class="space-y-4">
					<label class="block">
						<span class="text-white text-xl font-semibold text-center block mb-3">please tell me how to contact you.</span>
						<textarea
							bind:value={contactInfo}
							placeholder="email, phone, instagram, etc..."
							rows="4"
							class="input w-full text-lg py-4 px-6 resize-none"
						></textarea>
					</label>

					{#if error}
						<p class="text-white/80 text-center text-lg lowercase">{error}</p>
					{/if}

					<button
						onclick={submitContactInfo}
						disabled={submittingContact || !contactInfo.trim()}
						class="btn-primary w-full text-xl py-5 font-bold"
					>
						{submittingContact ? 'submitting...' : 'submit'}
					</button>
				</div>
			{:else}
				<div class="text-center space-y-3 py-4">
					<p class="text-2xl text-white/90">we'll contact you sometime.</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

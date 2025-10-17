<script lang="ts">
	import AudioVisualizerWebGL from './AudioVisualizerWebGL.svelte';
	import VideoRecorder from './VideoRecorder.svelte';
	import Typewriter from './Typewriter.svelte';
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
	let audioElement = $state<HTMLAudioElement | null>(null);
	let isPlaying = $state(false);
	let canvasElement = $state<HTMLCanvasElement | null>(null);
	let mixing = $state(false);
	let mixedVideoUrl = $state<string | null>(null);
	let videoRecorder: any = null;
	let audioVisualizer: any = null;
	let runpodJobId = $state<string | null>(null);
	let runpodStatus = $state<string | null>(null);
	let finalVideoUrl = $state<string | null>(null);
	let pollingInterval: number | null = null;
	let recordedVideoBlob = $state<Blob | null>(null);
	let recordedVideoUrl = $state<string | null>(null);
	let showCompletion = $state(false);
	let typewriterComplete = $state(false);
	let processingStatus = $state<string>('');
	let processingStage = $state<string>('rendering');
	let contactInfo = $state<string>('');
	let submittingContact = $state(false);
	let contactSubmitted = $state(false);
	let durationTimer: number | null = null;
	let isDesktop = $state(false);
	let hasStartedRecording = false;

	// Server rendering state
	let serverRendering = $state(false);
	let serverRenderProgress = $state('');
	const serverRenderer = new R10ServerRenderer();

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

	async function playSong(song: Song) {
		// Clear any existing timer
		if (durationTimer) {
			clearTimeout(durationTimer);
			durationTimer = null;
		}

		// Create a brand new audio element for each song to avoid MediaElementSource conflicts
		audioElement = new Audio();
		audioElement.crossOrigin = 'anonymous';
		audioElement.src = song.previewUrl;

		audioElement.onended = () => {
			isPlaying = false;
			audioVisualizer?.stop();
			videoRecorder?.stopRecording();
			hasStartedRecording = false;
			if (durationTimer) {
				clearTimeout(durationTimer);
				durationTimer = null;
			}
		};
		audioElement.onplay = () => {
			isPlaying = true;
			audioVisualizer?.start();
			hasStartedRecording = false;

			// Stop playback after 15 seconds
			durationTimer = setTimeout(() => {
				if (audioElement) {
					audioElement.pause();
					audioElement.currentTime = 0;
				}
				isPlaying = false;
				audioVisualizer?.stop();
				videoRecorder?.stopRecording();
				hasStartedRecording = false;
			}, 15000) as unknown as number;
		};
		audioElement.ontimeupdate = () => {
			// Start recording once audio is actually playing (currentTime is advancing)
			if (isPlaying && !hasStartedRecording && audioElement && audioElement.currentTime > 0) {
				hasStartedRecording = true;
				videoRecorder?.startRecording();
			}
		};
		audioElement.onpause = () => {
			isPlaying = false;
			audioVisualizer?.stop();
			videoRecorder?.stopRecording();
			hasStartedRecording = false;
		};

		selectedSong = song;

		// Wait for audio to be loaded before playing
		try {
			audioElement.load();
			await new Promise<void>((resolve, reject) => {
				const onCanPlay = () => {
					audioElement?.removeEventListener('canplaythrough', onCanPlay);
					audioElement?.removeEventListener('error', onError);
					resolve();
				};
				const onError = () => {
					audioElement?.removeEventListener('canplaythrough', onCanPlay);
					audioElement?.removeEventListener('error', onError);
					reject(new Error('Failed to load audio'));
				};
				audioElement?.addEventListener('canplaythrough', onCanPlay);
				audioElement?.addEventListener('error', onError);
			});

			await audioElement.play();
			isPlaying = true;
			console.log('Audio playing (15 second limit)');
		} catch (err) {
			console.error('Error playing audio:', err);
			isPlaying = false;
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
		processingStage = 'preparing';
		processingStatus = 'preparing your video...';

		try {
			// Import upload function dynamically
			const { upload } = await import('@vercel/blob/client');

			processingStage = 'uploading';
			processingStatus = 'uploading to storage...';

			// Upload video directly to Vercel Blob (bypasses serverless function limit)
			const blob = await upload(`recording-${Date.now()}.webm`, recordedVideoBlob, {
				access: 'public',
				handleUploadUrl: '/api/video-upload-token'
			});

			console.log('Video uploaded to blob:', blob.url);

			processingStage = 'mixing';
			processingStatus = 'mixing audio and video...';

			// Now tell server to process the video (only sends URLs, not files)
			// Add timeout for long-running operations
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

			try {
				const response = await fetch('/api/mix-video', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						videoUrl: blob.url,
						audioUrl: selectedSong.previewUrl
					}),
					signal: controller.signal
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					throw new Error('mixing failed. please try again or contact teh@raptor.pizza');
				}

				const result = await response.json();

				if (result.success) {
					mixedVideoUrl = result.publicUrl;
					runpodJobId = result.runpodJobId;
					console.log('Video mixed:', result.publicUrl);

					processingStage = 'finalizing';
					processingStatus = 'finalizing your rsvp...';

					// Show completion view
					showCompletion = true;

					// Start polling for RunPod job status
					if (runpodJobId) {
						startPolling(runpodJobId);
					}
				} else {
					throw new Error('mixing failed. please try again or contact teh@raptor.pizza');
				}
			} catch (fetchErr) {
				clearTimeout(timeoutId);
				if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
					throw new Error('processing timed out. please try again or contact teh@raptor.pizza');
				}
				throw fetchErr;
			}
		} catch (err) {
			console.error('Error mixing video:', err);
			error = err instanceof Error ? err.message : 'something went wrong. please try again or contact teh@raptor.pizza';
			processingStatus = '';
			processingStage = 'rendering';
		} finally {
			mixing = false;
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
		contactInfo = '';
		contactSubmitted = false;
		// Clear duration timer
		if (durationTimer) {
			clearTimeout(durationTimer);
			durationTimer = null;
		}
		// Keep isSearching true if there are still search results
		// isSearching stays true
	}

	async function generateServerVideo() {
		if (!selectedSong || !audioVisualizer) return;

		serverRendering = true;
		serverRenderProgress = 'extracting parameters...';

		try {
			// Get exact parameters from browser visualization
			const params = serverRenderer.extractParamsFromBrowser(audioVisualizer);
			params.audioUrl = selectedSong.previewUrl;

			serverRenderProgress = 'submitting job to runpod...';
			const { jobId } = await serverRenderer.submitRenderJob(params);

			serverRenderProgress = 'rendering on server (this may take a few minutes)...';
			const result = await serverRenderer.waitForCompletion(jobId);

			if (result.status === 'success' && result.video) {
				serverRenderProgress = 'downloading...';
				serverRenderer.downloadVideo(result.video, `r10-${selectedSong.trackName}.mp4`);
				serverRenderProgress = 'complete!';
			} else {
				serverRenderProgress = `error: ${result.message}`;
			}
		} catch (error) {
			serverRenderProgress = `error: ${error instanceof Error ? error.message : 'unknown error'}`;
		} finally {
			setTimeout(() => {
				serverRendering = false;
				serverRenderProgress = '';
			}, 3000);
		}
	}
</script>

<div class="w-full max-w-2xl mx-auto space-y-6">
	<!-- Search Input - hide when song is selected -->
	{#if !selectedSong}
		<div class="space-y-6">
			<div class="text-center py-8">
				<h2 class="text-3xl font-bold text-white">
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


	<!-- Audio Player with Visualizer -->
	{#if selectedSong && !showCompletion}
		<div class="card space-y-6">
			<!-- Visualizer -->
			<AudioVisualizerWebGL bind:this={audioVisualizer} {audioElement} bind:canvas={canvasElement} />

			<!-- Video Recorder -->
			<VideoRecorder
				bind:this={videoRecorder}
				canvas={canvasElement}
				onRecordingComplete={handleRecordingComplete}
			/>

			<!-- Show buttons during recording or after recording completes -->
			{#if !mixing && !mixedVideoUrl}
				<div class="card space-y-4">
					{#if error}
						<div class="bg-red-900 border-[2px] border-red-500 p-4">
							<p class="text-white text-center">{error}</p>
						</div>
					{/if}
					<div class="flex flex-col gap-4">
						{#if recordedVideoUrl}
							<button onclick={acceptRecording} class="btn-primary text-xl py-5 font-bold">
								accept
							</button>
						{/if}
						<button onclick={backToSearch} class="btn-secondary text-lg py-4">
							try again
						</button>
					</div>
				</div>
			{/if}

			{#if mixing}
				<div class="card space-y-3"
					class:border-red-600={processingStage === 'uploading' || processingStage === 'preparing'}
					class:bg-red-900={processingStage === 'uploading' || processingStage === 'preparing'}
					class:border-blue-600={processingStage === 'mixing'}
					class:bg-blue-900={processingStage === 'mixing'}>
					<p class="text-white text-lg flex items-center justify-center gap-2 py-3 font-bold animate-pulse" style="font-family: monospace;">
						<span class="inline-block w-3 h-3 animate-pulse"
							class:bg-red-500={processingStage === 'uploading' || processingStage === 'preparing'}
							class:bg-blue-500={processingStage === 'mixing'}></span>
						{processingStage}
					</p>
					<p class="text-white text-base text-center">
						this might take a few minutes. don't refresh the browser or leave this page please :)
					</p>
				</div>
			{/if}
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
					<video src={mixedVideoUrl} controls playsinline class="w-full"></video>
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
								if (navigator.share) {
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

					<!-- Server Rendering Button -->
					<button
						onclick={generateServerVideo}
						disabled={serverRendering}
						class="btn-ghost w-full text-lg py-4"
					>
						{serverRendering ? serverRenderProgress : 'generate high quality video (runpod)'}
					</button>
				</div>
			{/if}

			{#if runpodJobId && !finalVideoUrl}
				<div class="card border-red-600 bg-red-900 animate-pulse">
					<p class="text-white text-2xl flex items-center justify-center gap-3 py-4 font-bold" style="font-family: monospace;">
						<span class="inline-block w-5 h-5 bg-red-500 animate-pulse"></span>
						rendering
					</p>
				</div>
			{/if}

			<!-- NOT USED? -->
			{#if finalVideoUrl}
				<div class="space-y-4">
					<h3 class="font-semibold text-white text-center text-xl">final ai video</h3>
					<video src={finalVideoUrl} controls playsinline class="w-full"></video>
					<div class="flex gap-3">
						<a
							href={`/api/download-video?url=${encodeURIComponent(finalVideoUrl)}`}
							class="btn-primary inline-block text-center flex-1 text-lg py-4"
						>
							download
						</a>
						<button
							onclick={() => {
								if (navigator.share) {
									navigator.share({
										title: 'My R10 RSVP',
										text: 'Check out my R10 RSVP video!',
										url: finalVideoUrl
									}).catch(err => console.log('Share failed:', err));
								} else {
									window.open(`https://www.instagram.com/`, '_blank');
								}
							}}
							class="btn-secondary text-center flex-1 text-lg py-4"
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

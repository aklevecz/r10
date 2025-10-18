<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import AudioVisualizerWebGL from './AudioVisualizerWebGL.svelte';

	interface Props {
		selectedSong: {
			trackId: number;
			trackName: string;
			artistName: string;
			artworkUrl100: string;
			previewUrl: string;
			collectionName: string;
		};
		serverRenderProgress: string;
	}

	let { selectedSong, serverRenderProgress }: Props = $props();

	let audioElement = $state<HTMLAudioElement | null>(null);
	let canvasElement = $state<HTMLCanvasElement | null>(null);
	let audioVisualizer: any = null;

	const componentId = Math.random().toString(36).substring(7);
	console.log(`[VisualizerLoadingScreen ${componentId}] Component created`);

	onMount(async () => {
		console.log(`[VisualizerLoadingScreen ${componentId}] onMount called`);

		// Create audio element and start playback
		audioElement = new Audio();
		audioElement.crossOrigin = 'anonymous';
		audioElement.src = selectedSong.previewUrl;
		audioElement.loop = true;
		console.log(`[VisualizerLoadingScreen ${componentId}] Audio element created, src:`, selectedSong.previewUrl);

		audioElement.onplay = () => {
			console.log(`[VisualizerLoadingScreen ${componentId}] Audio onplay event`);
			audioVisualizer?.start();
		};

		audioElement.onpause = () => {
			console.log(`[VisualizerLoadingScreen ${componentId}] Audio onpause event`);
		};

		audioElement.onended = () => {
			console.log(`[VisualizerLoadingScreen ${componentId}] Audio onended event`);
		};

		audioElement.onerror = (e) => {
			console.error(`[VisualizerLoadingScreen ${componentId}] Audio onerror:`, e);
		};

		// Start playback immediately in mount (user gesture context)
		try {
			console.log(`[VisualizerLoadingScreen ${componentId}] Calling audio.load()`);
			audioElement.load();
			console.log(`[VisualizerLoadingScreen ${componentId}] Calling audio.play()`);
			await audioElement.play();
			console.log(`[VisualizerLoadingScreen ${componentId}] Audio play() succeeded, paused:`, audioElement.paused);
		} catch (err) {
			console.error(`[VisualizerLoadingScreen ${componentId}] Error playing audio:`, err);
		}
	});

	onDestroy(() => {
		console.log(`[VisualizerLoadingScreen ${componentId}] onDestroy called`);
		// Clean up audio and visualizer
		if (audioElement) {
			console.log(`[VisualizerLoadingScreen ${componentId}] Pausing and cleaning up audio`);
			audioElement.pause();
			audioElement.src = '';
			audioElement = null;
		}
		audioVisualizer?.stop();
	});
</script>

<div class="card space-y-6">
	<!-- Audio Visualizer -->
	<AudioVisualizerWebGL bind:this={audioVisualizer} {audioElement} bind:canvas={canvasElement} />

	<!-- Status Display -->
	<div class="card space-y-3 border-red-600 bg-red-900">
		<p
			class="text-white text-lg flex items-center justify-center gap-2 py-3 font-bold animate-pulse"
			style="font-family: monospace;"
		>
			<span class="inline-block w-3 h-3 bg-red-500 animate-pulse"></span>
			rendering
		</p>
		<p class="text-white text-base text-center">
			{serverRenderProgress}
		</p>
		<p class="text-white text-base text-center">
			this may take 2-3 minutes. don't refresh the browser or leave this page please :)
		</p>
	</div>
</div>

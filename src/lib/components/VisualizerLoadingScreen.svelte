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

	onMount(async () => {
		// Create audio element and start playback
		audioElement = new Audio();
		audioElement.crossOrigin = 'anonymous';
		audioElement.src = selectedSong.previewUrl;
		audioElement.loop = true;

		audioElement.onplay = () => {
			audioVisualizer?.start();
		};

		// Start playback immediately in mount (user gesture context)
		try {
			audioElement.load();
			await audioElement.play();
		} catch (err) {
			console.error('Error playing audio:', err);
		}
	});

	onDestroy(() => {
		// Clean up audio and visualizer
		if (audioElement) {
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

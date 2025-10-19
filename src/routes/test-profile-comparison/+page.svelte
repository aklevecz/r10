<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import AudioVisualizerWebGL from '$lib/components/AudioVisualizerWebGL.svelte';
	import VideoRecorder from '$lib/components/VideoRecorder.svelte';
	import { getAvailableProfiles } from '$lib/profiles.js';

	// Test song (same as server tests)
	const TEST_SONG = {
		previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/ee/22/1a/ee221ab0-02dd-7290-47e7-383ad9c81e3b/mzaf_912969547193259322.plus.aac.p.m4a',
		artworkUrl100: 'http://localhost:5174/raptor-bw.png'
	};

	let selectedProfile = $state<string>('legacy-server');
	let audioElement = $state<HTMLAudioElement | null>(null);
	let canvasElement = $state<HTMLCanvasElement | null>(null);
	let audioVisualizer: any = null;
	let videoRecorder: any = null;

	let recordingDuration = $state(0);
	let recordingTimer: any = null;
	let downloadUrl = $state<string | null>(null);

	const availableProfiles = getAvailableProfiles();

	// Visual effect toggles
	let enableRotation = $state(true);
	let enableScale = $state(true);
	let enableDistortion = $state(true);
	let enableHueShift = $state(true);
	let enableInversion = $state(true);
	let enableTrails = $state(true);

	// Intensity sliders (0.0 to 2.0 multipliers)
	let rotationIntensity = $state(1.0);
	let scaleIntensity = $state(1.0);
	let distortionIntensity = $state(1.0);
	let hueShiftIntensity = $state(1.0);
	let trailIntensity = $state(1.0);

	onMount(() => {
		// Create audio element
		audioElement = new Audio();
		audioElement.crossOrigin = 'anonymous';
		audioElement.src = TEST_SONG.previewUrl;
		audioElement.loop = true;

		audioElement.onplay = () => {
			audioVisualizer?.start();
		};
	});

	onDestroy(() => {
		if (audioElement) {
			audioElement.pause();
			audioElement.src = '';
			audioElement = null;
		}
		audioVisualizer?.stop();
		if (recordingTimer) {
			clearInterval(recordingTimer);
		}
		if (downloadUrl) {
			URL.revokeObjectURL(downloadUrl);
		}
	});

	let mediaRecorder: MediaRecorder | null = null;
	let recordedChunks: Blob[] = [];

	async function startTest() {
		if (!audioElement || !canvasElement) {
			alert('Not ready');
			return;
		}

		// Clear any previous download
		if (downloadUrl) {
			URL.revokeObjectURL(downloadUrl);
			downloadUrl = null;
		}

		// Start audio playback
		try {
			await audioElement.play();
			audioVisualizer?.start();
		} catch (err) {
			console.error('Failed to play audio:', err);
			return;
		}

		// Create combined stream with canvas video + audio from a MediaStream destination
		const canvasStream = canvasElement.captureStream(60);

		// We need to capture audio separately and combine it
		// Use Web Audio API to route audio to a MediaStream
		const audioContext = new AudioContext();
		const destination = audioContext.createMediaStreamDestination();

		// Get the existing source from the visualizer's audio context
		// Instead, we'll just capture the canvas for now (visual only)
		const stream = canvasStream;

		mediaRecorder = new MediaRecorder(stream, {
			mimeType: 'video/webm;codecs=vp9',
			videoBitsPerSecond: 8000000
		});

		recordedChunks = [];

		mediaRecorder.ondataavailable = (e) => {
			if (e.data.size > 0) recordedChunks.push(e.data);
		};

		mediaRecorder.onstop = () => {
			const blob = new Blob(recordedChunks, { type: 'video/webm' });
			downloadUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = downloadUrl;
			a.download = `browser-${selectedProfile}.webm`;
			a.click();
		};

		mediaRecorder.start(100);

		// Start timer
		recordingDuration = 0;
		recordingTimer = setInterval(() => {
			recordingDuration++;

			// Auto-stop after 30 seconds
			if (recordingDuration >= 30) {
				stopTest();
			}
		}, 1000);
	}

	function stopTest() {
		if (recordingTimer) {
			clearInterval(recordingTimer);
			recordingTimer = null;
		}

		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
		}
		audioElement?.pause();
	}

	function handleRecordingComplete(blob: Blob) {
		// Create download URL
		downloadUrl = URL.createObjectURL(blob);

		// Auto-download
		const a = document.createElement('a');
		a.href = downloadUrl;
		a.download = `browser-${selectedProfile}-${Date.now()}.webm`;
		a.click();
	}
</script>

<div class="container mx-auto p-6 space-y-6 max-w-4xl">
	<div class="card space-y-4">
		<h1 class="text-2xl font-bold text-white">Profile Comparison Test</h1>
		<p class="text-gray-400">
			Record browser output to compare with server-rendered videos.
		</p>
	</div>

	<!-- Controls Sidebar -->
	<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
		<!-- Left Sidebar: Controls -->
		<div class="space-y-6">
			<!-- Effect Toggles -->
			<div class="card space-y-3">
				<div class="text-white font-semibold text-sm">Toggle Effects:</div>
				<div class="space-y-2">
					<label class="flex items-center gap-2 text-white text-sm cursor-pointer">
						<input type="checkbox" bind:checked={enableRotation} class="w-4 h-4" />
						Rotation
					</label>
					<label class="flex items-center gap-2 text-white text-sm cursor-pointer">
						<input type="checkbox" bind:checked={enableScale} class="w-4 h-4" />
						Scale
					</label>
					<label class="flex items-center gap-2 text-white text-sm cursor-pointer">
						<input type="checkbox" bind:checked={enableDistortion} class="w-4 h-4" />
						Distortion
					</label>
					<label class="flex items-center gap-2 text-white text-sm cursor-pointer">
						<input type="checkbox" bind:checked={enableHueShift} class="w-4 h-4" />
						Hue Shift
					</label>
					<label class="flex items-center gap-2 text-white text-sm cursor-pointer">
						<input type="checkbox" bind:checked={enableInversion} class="w-4 h-4" />
						Inversion
					</label>
					<label class="flex items-center gap-2 text-white text-sm cursor-pointer">
						<input type="checkbox" bind:checked={enableTrails} class="w-4 h-4" />
						Trails
					</label>
				</div>
			</div>

			<!-- Intensity Sliders -->
			<div class="card space-y-3">
				<div class="text-white font-semibold text-sm">Intensity (0-2x):</div>
				<div class="space-y-3">
					<div>
						<label class="text-white text-xs">Rotation: {rotationIntensity.toFixed(2)}x</label>
						<input type="range" bind:value={rotationIntensity} min="0" max="2" step="0.1" class="w-full" />
					</div>
					<div>
						<label class="text-white text-xs">Scale: {scaleIntensity.toFixed(2)}x</label>
						<input type="range" bind:value={scaleIntensity} min="0" max="2" step="0.1" class="w-full" />
					</div>
					<div>
						<label class="text-white text-xs">Distortion: {distortionIntensity.toFixed(2)}x</label>
						<input type="range" bind:value={distortionIntensity} min="0" max="2" step="0.1" class="w-full" />
					</div>
					<div>
						<label class="text-white text-xs">Hue Shift: {hueShiftIntensity.toFixed(2)}x</label>
						<input type="range" bind:value={hueShiftIntensity} min="0" max="2" step="0.1" class="w-full" />
					</div>
					<div>
						<label class="text-white text-xs">Trails: {trailIntensity.toFixed(2)}x</label>
						<input type="range" bind:value={trailIntensity} min="0" max="2" step="0.1" class="w-full" />
					</div>
				</div>
			</div>
		</div>

		<!-- Right: Visualizer with Profile Switcher -->
		<div class="lg:col-span-3 space-y-6">
			<!-- Profile Switcher -->
			<div class="card">
				<div class="flex gap-3 justify-center">
					<button
						class="px-6 py-3 rounded-lg font-semibold transition-colors {selectedProfile === 'legacy-browser'
							? 'bg-blue-600 text-white'
							: 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
						onclick={() => (selectedProfile = 'legacy-browser')}
					>
						Legacy Browser
					</button>
					<button
						class="px-6 py-3 rounded-lg font-semibold transition-colors {selectedProfile === 'legacy-server'
							? 'bg-purple-600 text-white'
							: 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
						onclick={() => (selectedProfile = 'legacy-server')}
					>
						Legacy Server
					</button>
				</div>
			</div>

			<!-- Visualizer -->
			<div class="card space-y-2">
				<div class="text-white font-semibold text-center">{selectedProfile}</div>
				<div class="border-2 {selectedProfile === 'legacy-browser' ? 'border-blue-600' : 'border-purple-600'} rounded-lg overflow-hidden">
					<AudioVisualizerWebGL
						bind:this={audioVisualizer}
						{audioElement}
						bind:canvas={canvasElement}
						profile={selectedProfile}
						{enableRotation}
						{enableScale}
						{enableDistortion}
						{enableHueShift}
						{enableInversion}
						{enableTrails}
						{rotationIntensity}
						{scaleIntensity}
						{distortionIntensity}
						{hueShiftIntensity}
						{trailIntensity}
					/>
				</div>
			</div>

			<VideoRecorder
				bind:this={videoRecorder}
				canvas={canvasElement}
				{audioElement}
				onRecordingComplete={handleRecordingComplete}
			/>
		</div>
	</div>

	<!-- Controls -->
	<div class="card space-y-4">
		<div class="flex gap-3">
			<button
				class="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={startTest}
				disabled={recordingTimer !== null}
			>
				Start Recording (30s)
			</button>

			<button
				class="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={stopTest}
				disabled={recordingTimer === null}
			>
				Stop Recording
			</button>
		</div>

		{#if recordingTimer !== null}
			<div class="text-white font-mono text-xl">
				Recording: {recordingDuration}s / 30s
			</div>
		{/if}
	</div>

	<!-- Instructions -->
	<div class="card space-y-3 bg-blue-900/20 border-blue-700">
		<h2 class="text-lg font-semibold text-blue-300">How to use:</h2>
		<ol class="text-blue-200 space-y-2 list-decimal list-inside">
			<li>Select a profile (e.g., "legacy-server")</li>
			<li>Click "Start Recording" - audio will play and recording will begin</li>
			<li>Recording auto-stops after 30 seconds and downloads automatically</li>
			<li>Compare downloaded video with server output at <code class="bg-gray-800 px-2 py-1 rounded">/Users/arielklevecz/r10/test-output.mp4</code></li>
		</ol>
	</div>
</div>

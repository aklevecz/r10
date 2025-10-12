<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	interface Props {
		audioElement: HTMLAudioElement | null;
		isPlaying: boolean;
		canvas?: HTMLCanvasElement | null;
	}

	let { audioElement, isPlaying, canvas = $bindable(null) }: Props = $props();
	let audioContext = $state<AudioContext | null>(null);
	let analyser = $state<AnalyserNode | null>(null);
	let dataArray = $state<Uint8Array | null>(null);
	let animationId = $state<number>(0);
	let source = $state<MediaElementAudioSourceNode | null>(null);
	let audioSetupDone = $state(false);
	let raptorImage = $state<HTMLImageElement | null>(null);

	// Visualization parameters
	const minRadius = 30;
	const maxRadius = 150;
	const width = 400;
	const height = 400;

	onMount(() => {
		if (!canvas) return;

		// Load raptor image
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.src = '/raptor-green.png';
		img.onload = () => {
			raptorImage = img;
			console.log('Raptor image loaded');

			// Initialize canvas background
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.fillStyle = '#6fb369';
				ctx.fillRect(0, 0, width, height);
				drawCircle(ctx, minRadius);
			}
		};
		img.onerror = () => {
			console.error('Failed to load raptor image');
		};
	});

	onDestroy(() => {
		cleanup();
	});

	function cleanup() {
		if (animationId) {
			cancelAnimationFrame(animationId);
			animationId = 0;
		}
		if (source) {
			try {
				source.disconnect();
			} catch (e) {
				// Already disconnected
			}
			source = null;
		}
		if (analyser) {
			try {
				analyser.disconnect();
			} catch (e) {
				// Already disconnected
			}
			analyser = null;
		}
		if (audioContext && audioContext.state !== 'closed') {
			audioContext.close();
		}
	}

	function setupAudio() {
		if (!audioElement || audioSetupDone) return;

		try {
			// Initialize audio context lazily
			if (!audioContext) {
				audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
			}

			// Create analyser
			analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;
			analyser.smoothingTimeConstant = 0.8;

			const bufferLength = analyser.frequencyBinCount;
			dataArray = new Uint8Array(bufferLength);

			// Connect audio element to analyser
			source = audioContext.createMediaElementSource(audioElement);
			source.connect(analyser);
			analyser.connect(audioContext.destination);

			audioSetupDone = true;
			console.log('Audio setup complete');
		} catch (error) {
			console.error('Error setting up audio:', error);
		}
	}

	let minRMS = $state(Infinity);
	let maxRMS = $state(0);
	let frameCount = $state(0);

	function calculateRMS(data: Uint8Array): number {
		let sumSquares = 0;
		for (let i = 0; i < data.length; i++) {
			const normalized = data[i] / 255.0;
			sumSquares += normalized * normalized;
		}
		const rms = Math.sqrt(sumSquares / data.length);

		// Track min/max RMS over time for adaptive normalization
		frameCount++;
		if (rms > 0.001) {
			// Ignore near-silence
			minRMS = Math.min(minRMS, rms);
			maxRMS = Math.max(maxRMS, rms);
		}

		// Reset calibration every 300 frames (~5 seconds) to adapt to song dynamics
		if (frameCount > 300) {
			frameCount = 0;
			minRMS = minRMS * 0.9; // Decay slowly
			maxRMS = maxRMS * 0.95;
		}

		// Normalize RMS to 0-1 range based on observed min/max
		let normalizedRMS = rms;
		if (maxRMS > minRMS) {
			normalizedRMS = (rms - minRMS) / (maxRMS - minRMS);
			normalizedRMS = Math.max(0, Math.min(1, normalizedRMS));
		}

		// Apply a curve to make it more responsive
		// Power curve makes small changes more visible
		normalizedRMS = Math.pow(normalizedRMS, 0.7);

		// Debug: log every 30 frames (roughly once per second at 60fps)
		if (Math.random() < 0.033) {
			console.log(
				'RMS - raw:',
				rms.toFixed(3),
				'normalized:',
				normalizedRMS.toFixed(3),
				'range:',
				minRMS.toFixed(3),
				'-',
				maxRMS.toFixed(3)
			);
		}

		return normalizedRMS;
	}

	function drawCircle(ctx: CanvasRenderingContext2D, radius: number) {
		// Clear canvas with trail effect
		ctx.fillStyle = 'rgba(111, 179, 105, 0.1)';
		ctx.fillRect(0, 0, width, height);

		const centerX = width / 2;
		const centerY = height / 2;

		if (raptorImage) {
			// Save context state
			ctx.save();

			// Create circular clipping path
			ctx.beginPath();
			ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
			ctx.clip();

			// Calculate image dimensions to fill the circle
			const imageSize = radius * 2;
			const imageX = centerX - radius;
			const imageY = centerY - radius;

			// Draw the raptor image clipped to circle
			ctx.drawImage(raptorImage, imageX, imageY, imageSize, imageSize);

			// Restore context to remove clipping
			ctx.restore();

			// Add subtle glow around the circle
			ctx.beginPath();
			ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
			ctx.shadowBlur = 20;
			ctx.shadowColor = '#3eb5b5';
			ctx.strokeStyle = '#52c9c9';
			ctx.lineWidth = 3;
			ctx.stroke();
			ctx.shadowBlur = 0;
		} else {
			// Fallback: Draw cyan circle if image not loaded
			ctx.beginPath();
			ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
			ctx.fillStyle = '#3eb5b5';
			ctx.fill();

			// Add subtle glow
			ctx.shadowBlur = 20;
			ctx.shadowColor = '#3eb5b5';
			ctx.strokeStyle = '#52c9c9';
			ctx.lineWidth = 3;
			ctx.stroke();
			ctx.shadowBlur = 0;
		}
	}

	function animate() {
		if (!canvas || !analyser || !dataArray) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Get frequency data
		analyser.getByteFrequencyData(dataArray);

		// Calculate RMS
		const rms = calculateRMS(dataArray);

		// Map RMS to radius
		const radius = minRadius + rms * (maxRadius - minRadius);

		// Draw
		drawCircle(ctx, radius);

		if (isPlaying) {
			animationId = requestAnimationFrame(animate);
		}
	}

	// Effect to handle audio setup when audio element changes
	$effect(() => {
		if (audioElement && !audioSetupDone) {
			// Wait a bit for audio element to be ready
			setTimeout(() => {
				setupAudio();
			}, 100);
		}
	});

	// Effect to handle play/pause
	$effect(() => {
		if (isPlaying && analyser && dataArray && canvas) {
			// Reset normalization for new playback
			minRMS = Infinity;
			maxRMS = 0;
			frameCount = 0;

			// Resume audio context if suspended
			if (audioContext && audioContext.state === 'suspended') {
				audioContext.resume().then(() => {
					console.log('Audio context resumed');
				});
			}

			if (animationId === 0) {
				console.log('Starting animation');
				animationId = requestAnimationFrame(animate);
			}
		} else {
			if (animationId) {
				console.log('Stopping animation');
				cancelAnimationFrame(animationId);
				animationId = 0;
			}
		}
	});

	// Clear canvas when stopped
	$effect(() => {
		if (!isPlaying && canvas) {
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.fillStyle = '#6fb369';
				ctx.fillRect(0, 0, width, height);

				// Draw static circle
				drawCircle(ctx, minRadius);
			}
		}
	});
</script>

<div class="flex justify-center">
	<canvas
		bind:this={canvas}
		width={width}
		height={height}
		class="rounded-lg shadow-2xl"
		style="max-width: 100%; height: auto;"
	/>
</div>

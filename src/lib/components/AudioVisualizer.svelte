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
	let raptorMask = $state<ImageData | null>(null);

	// Visualization parameters - Square resolution
	const minRadius = 60;
	const maxRadius = 300;
	const width = 1080;
	const height = 1080;

	// Generate complementary colors
	const baseHue = Math.random() * 360;
	const complementHue = (baseHue + 180) % 360;
	const color1 = `hsl(${baseHue}, 85%, 65%)`; // Main color
	const color2 = `hsl(${complementHue}, 85%, 65%)`; // Complement
	const color3 = `hsl(${baseHue}, 85%, 80%)`; // Lighter version of main
	const bgColor = `hsl(${baseHue}, 50%, 45%)`; // Brighter, more saturated background

	// Distortion effect - can be changed via dropdown
	let distortionType = $state(Math.floor(Math.random() * 5));

	onMount(async () => {
		if (!canvas) return;

		// Fetch and colorize the SVG
		const response = await fetch('/raptor-svg.svg');
		const svgText = await response.text();

		// Replace different colors in SVG with multiple random colors
		const colorizedSvg = svgText
			.replaceAll('fill="#ed1c24"', `fill="${color1}"`) // Red dots
			.replaceAll('fill="#231f20"', `fill="${color2}"`) // Black parts
			.replaceAll('fill="#fff"', `fill="${color3}"`); // White parts

		// Create blob and load as image
		const blob = new Blob([colorizedSvg], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);

		const img = new Image();
		img.src = url;
		img.onload = () => {
			raptorImage = img;
			console.log('Raptor SVG loaded with colors:', color1, color2, color3, 'bg:', bgColor, 'distortion:', distortionType);

			// Create a temporary canvas to load the image
			const tempCanvas = document.createElement('canvas');
			tempCanvas.width = width;
			tempCanvas.height = height;
			const tempCtx = tempCanvas.getContext('2d');

			if (tempCtx) {
				// Draw the image scaled to canvas size
				tempCtx.drawImage(img, 0, 0, width, height);

				// Get image data
				raptorMask = tempCtx.getImageData(0, 0, width, height);
				console.log('Raptor mask ready');
			}

			// Clean up blob URL
			URL.revokeObjectURL(url);

			// Initialize canvas background with color
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.fillStyle = bgColor;
				ctx.fillRect(0, 0, width, height);
				drawCircle(ctx, minRadius);
			}
		};
		img.onerror = () => {
			console.error('Failed to load raptor SVG');
			// Initialize canvas anyway
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.fillStyle = bgColor;
				ctx.fillRect(0, 0, width, height);
				drawCircle(ctx, minRadius);
			}
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

	let minRMS = Infinity;
	let maxRMS = 0;
	let frameCount = 0;

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
		// if (Math.random() < 0.033) {
		// 	console.log(
		// 		'RMS - raw:',
		// 		rms.toFixed(3),
		// 		'normalized:',
		// 		normalizedRMS.toFixed(3),
		// 		'range:',
		// 		minRMS.toFixed(3),
		// 		'-',
		// 		maxRMS.toFixed(3)
		// 	);
		// }

		return normalizedRMS;
	}

	let time = 0;

	function drawCircle(ctx: CanvasRenderingContext2D, radius: number) {
		// Clear canvas with colored background
		ctx.fillStyle = bgColor;
		ctx.fillRect(0, 0, width, height);

		if (raptorMask && raptorImage) {
			// Map radius to scale (radius goes from minRadius to maxRadius)
			const normalizedRadius = (radius - minRadius) / (maxRadius - minRadius);
			const minScale = 0.4; // Start at 40% size
			const maxScale = 0.8; // Grow to 80% size
			const scale = minScale + normalizedRadius * (maxScale - minScale);

			// Add distortion based on audio intensity
			// Only distort when audio is above threshold (kicks, snares, etc)
			const distortionThreshold = 0.6; // Only react to strong beats
			const distortionIntensity = Math.max(0, normalizedRadius - distortionThreshold) / (1 - distortionThreshold);
			const distortionAmount = distortionIntensity * 30; // Max 30px distortion on strong beats
			const distortionSpeed = 0.02 + distortionIntensity * 0.2; // Speed increases with intensity
			time += distortionSpeed;

			// Create a temporary canvas for distortion effect
			const tempCanvas = document.createElement('canvas');
			tempCanvas.width = width;
			tempCanvas.height = height;
			const tempCtx = tempCanvas.getContext('2d');

			if (tempCtx) {
				// Draw scaled image to temp canvas
				const scaledWidth = width * scale;
				const scaledHeight = height * scale;
				const offsetX = (width - scaledWidth) / 2;
				const offsetY = (height - scaledHeight) / 2;
				tempCtx.drawImage(raptorImage, offsetX, offsetY, scaledWidth, scaledHeight);

				// Apply distortion based on randomly selected type
				if (distortionType === 0) {
					// Horizontal sine wave
					const stripHeight = 4;
					for (let y = 0; y < height; y += stripHeight) {
						const distortX = Math.sin(y * 0.05 + time) * distortionAmount;
						ctx.drawImage(
							tempCanvas,
							0, y, width, stripHeight,
							distortX, y, width, stripHeight
						);
					}
				} else if (distortionType === 1) {
					// Vertical sine wave
					const stripWidth = 4;
					for (let x = 0; x < width; x += stripWidth) {
						const distortY = Math.sin(x * 0.05 + time) * distortionAmount;
						ctx.drawImage(
							tempCanvas,
							x, 0, stripWidth, height,
							x, distortY, stripWidth, height
						);
					}
				} else if (distortionType === 2) {
					// Circular ripple from center
					const stripHeight = 4;
					const centerX = width / 2;
					const centerY = height / 2;
					for (let y = 0; y < height; y += stripHeight) {
						const distanceFromCenter = Math.abs(y - centerY);
						const distortX = Math.sin(distanceFromCenter * 0.05 + time) * distortionAmount;
						ctx.drawImage(
							tempCanvas,
							0, y, width, stripHeight,
							distortX, y, width, stripHeight
						);
					}
				} else if (distortionType === 3) {
					// Diagonal waves
					const stripHeight = 4;
					for (let y = 0; y < height; y += stripHeight) {
						const distortX = Math.sin((y * 0.03) + time) * distortionAmount * Math.cos(time * 0.5);
						ctx.drawImage(
							tempCanvas,
							0, y, width, stripHeight,
							distortX, y, width, stripHeight
						);
					}
				} else {
					// Glitch/stutter effect - random horizontal offsets
					const stripHeight = 8;
					for (let y = 0; y < height; y += stripHeight) {
						// Use pseudo-random based on y and time for consistent per-frame glitching
						const glitchSeed = Math.sin(y * 0.1 + Math.floor(time * 2));
						const shouldGlitch = glitchSeed > 0.7; // Only some strips glitch
						const distortX = shouldGlitch ? glitchSeed * distortionAmount * 2 : 0;
						ctx.drawImage(
							tempCanvas,
							0, y, width, stripHeight,
							distortX, y, width, stripHeight
						);
					}
				}
			}
		} else {
			// Fallback: Draw white circle if mask not loaded
			const centerX = width / 2;
			const centerY = height / 2;

			ctx.beginPath();
			ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
			ctx.fillStyle = '#FFFFFF';
			ctx.fill();
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
				ctx.fillStyle = bgColor;
				ctx.fillRect(0, 0, width, height);

				// Draw static circle
				drawCircle(ctx, minRadius);
			}
		}
	});
</script>

<div class="space-y-4">
	<div class="flex justify-center gap-4 items-center">
		<label for="distortion-select" class="text-white text-sm font-medium">
			Distortion Effect:
		</label>
		<select
			id="distortion-select"
			bind:value={distortionType}
			class="input w-auto"
		>
			<option value={0}>Horizontal Sine Wave</option>
			<option value={1}>Vertical Sine Wave</option>
			<option value={2}>Circular Ripple</option>
			<option value={3}>Diagonal Waves</option>
			<option value={4}>Glitch/Stutter</option>
		</select>
	</div>

	<div class="flex justify-center">
		<canvas
			bind:this={canvas}
			width={width}
			height={height}
			class="rounded-lg shadow-2xl"
			style="max-width: 100%; height: auto;"
		/>
	</div>
</div>

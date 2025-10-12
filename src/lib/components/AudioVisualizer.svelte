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
				// Draw with minimum scale (bass=0, mid=0, high=0)
				drawCircle(ctx, 0, 0, 0);
			}
		};
		img.onerror = () => {
			console.error('Failed to load raptor SVG');
			// Initialize canvas anyway
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.fillStyle = bgColor;
				ctx.fillRect(0, 0, width, height);
				drawCircle(ctx, 0, 0, 0);
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
		if (!audioElement) return;

		try {
			// Initialize audio context lazily
			if (!audioContext) {
				audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
			}

			// Only create source if we haven't already
			if (!source) {
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
			}
		} catch (error) {
			console.error('Error setting up audio:', error);
		}
	}

	// Smoothing values to reduce jitter
	let smoothedBass = 0;
	let smoothedMid = 0;
	let smoothedHigh = 0;

	function analyzeFrequencyBands(data: Uint8Array): { bass: number; mid: number; high: number } {
		// With fftSize 256, we get 128 bins, sample rate ~44100 Hz
		// Each bin = ~344 Hz (44100 / 128)
		// Bass: bins 0-3 (0-1032 Hz) - kicks and sub bass
		// Mid: bins 4-15 (1032-5160 Hz) - vocals, snares, guitars
		// High: bins 16+ (5160+ Hz) - hi-hats, cymbals, brightness

		let bassSum = 0;
		let midSum = 0;
		let highSum = 0;

		for (let i = 0; i < 4; i++) {
			bassSum += data[i];
		}
		for (let i = 4; i < 16; i++) {
			midSum += data[i];
		}
		for (let i = 16; i < 64; i++) {
			highSum += data[i];
		}

		// Simple averages, scaled 0-255 to 0-1
		let bass = (bassSum / 4) / 255;
		let mid = (midSum / 12) / 255;
		let high = (highSum / 48) / 255;

		// Debug: log raw values occasionally
		if (Math.random() < 0.02) {
			console.log('Raw - Bass:', bass.toFixed(3), 'Mid:', mid.toFixed(3), 'High:', high.toFixed(3));
		}

		// Apply power curves to expand dynamic range
		// This makes quiet parts quieter and keeps loud parts loud
		bass = Math.pow(bass, 2.0); // Stronger curve = more range
		mid = Math.pow(mid, 1.5);
		high = Math.pow(high, 1.5);

		// Apply smoothing to reduce jitter (lerp between old and new values)
		// Bass: less smoothing to keep it punchy and responsive to kicks
		const bassSmoothFactor = 0.6; // More responsive
		const midSmoothFactor = 0.3; // Moderate smoothing
		const highSmoothFactor = 0.3; // Moderate smoothing

		smoothedBass = smoothedBass * bassSmoothFactor + bass * (1 - bassSmoothFactor);
		smoothedMid = smoothedMid * midSmoothFactor + mid * (1 - midSmoothFactor);
		smoothedHigh = smoothedHigh * highSmoothFactor + high * (1 - highSmoothFactor);

		return { bass: smoothedBass, mid: smoothedMid, high: smoothedHigh };
	}

	let time = 0;
	let rotation = 0;

	function drawCircle(ctx: CanvasRenderingContext2D, bassIntensity: number, midIntensity: number, highIntensity: number) {
		// High frequencies shift the background hue
		const hueShift = highIntensity * 60; // Shift up to 60 degrees
		const shiftedBgColor = `hsl(${(baseHue + hueShift) % 360}, 50%, 45%)`;

		// Clear canvas with colored background
		ctx.fillStyle = shiftedBgColor;
		ctx.fillRect(0, 0, width, height);

		if (raptorMask && raptorImage) {
			// Bass controls scale (kick drums make it bigger)
			const minScale = 0.15; // Start at 15% size
			const maxScale = 0.95; // Grow to 95% size
			const scale = minScale + bassIntensity * (maxScale - minScale);

			// Mid controls distortion intensity
			const distortionThreshold = 0.3; // Lower threshold for more activity
			const distortionIntensity = Math.max(0, midIntensity - distortionThreshold) / (1 - distortionThreshold);
			const distortionAmount = distortionIntensity * 50; // Max 50px distortion
			const distortionSpeed = 0.02 + distortionIntensity * 0.2;
			time += distortionSpeed;

			// High controls rotation
			rotation += highIntensity * 0.8; // Rotate based on high frequencies
			rotation = rotation % 360; // Keep rotation bounded

			// Create a temporary canvas for distortion effect
			const tempCanvas = document.createElement('canvas');
			tempCanvas.width = width;
			tempCanvas.height = height;
			const tempCtx = tempCanvas.getContext('2d');

			if (tempCtx) {
				// Apply rotation (controlled by highs)
				tempCtx.save();
				tempCtx.translate(width / 2, height / 2);
				tempCtx.rotate(rotation * Math.PI / 180);
				tempCtx.translate(-width / 2, -height / 2);

				// Draw scaled image to temp canvas (scale controlled by bass)
				const scaledWidth = width * scale;
				const scaledHeight = height * scale;
				const offsetX = (width - scaledWidth) / 2;
				const offsetY = (height - scaledHeight) / 2;
				tempCtx.drawImage(raptorImage, offsetX, offsetY, scaledWidth, scaledHeight);
				tempCtx.restore();

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
			const fallbackRadius = minRadius + bassIntensity * (maxRadius - minRadius);

			ctx.beginPath();
			ctx.arc(centerX, centerY, fallbackRadius, 0, 2 * Math.PI);
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

		// Analyze frequency bands
		const { bass, mid, high } = analyzeFrequencyBands(dataArray);

		// Draw with separate controls for each band
		drawCircle(ctx, bass, mid, high);

		if (isPlaying) {
			animationId = requestAnimationFrame(animate);
		}
	}

	// Effect to handle audio setup when audio element changes
	$effect(() => {
		if (audioElement) {
			// Wait a bit for audio element to be ready
			setTimeout(() => {
				setupAudio();
			}, 100);
		}
	});

	// Effect to handle play/pause
	$effect(() => {
		if (isPlaying && analyser && dataArray && canvas) {
			// Reset rotation for new playback
			rotation = 0;

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

				// Draw static state (no audio)
				drawCircle(ctx, 0, 0, 0);
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

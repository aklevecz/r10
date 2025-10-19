<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { getProfileConfig } from '$lib/profiles.js';

	interface Props {
		audioElement: HTMLAudioElement | null;
		canvas?: HTMLCanvasElement | null;
		profile?: string;
		enableRotation?: boolean;
		enableScale?: boolean;
		enableDistortion?: boolean;
		enableHueShift?: boolean;
		enableInversion?: boolean;
		enableTrails?: boolean;
		rotationIntensity?: number;
		scaleIntensity?: number;
		distortionIntensity?: number;
		hueShiftIntensity?: number;
		trailIntensity?: number;
	}

	let {
		audioElement,
		canvas = $bindable(null),
		profile = 'legacy-browser',
		enableRotation = true,
		enableScale = true,
		enableDistortion = true,
		enableHueShift = true,
		enableInversion = true,
		enableTrails = true,
		rotationIntensity = 1.0,
		scaleIntensity = 1.0,
		distortionIntensity = 1.0,
		hueShiftIntensity = 1.0,
		trailIntensity = 1.0
	}: Props = $props();

	// Get profile configuration
	let config = $derived(getProfileConfig(profile));
	let audioContext = $state<AudioContext | null>(null);
	let analyser = $state<AnalyserNode | null>(null);
	let dataArray = $state<Uint8Array | null>(null);
	let animationId = $state<number>(0);
	let source = $state<MediaElementAudioSourceNode | null>(null);

	// WebGL specific
	let gl: WebGLRenderingContext | null = null;
	let program: WebGLProgram | null = null;
	let texture: WebGLTexture | null = null;
	let raptorImage: HTMLImageElement | null = null;
	// Ping-pong buffers for trail effect (to avoid feedback loop)
	let trailTexture0: WebGLTexture | null = null;
	let trailTexture1: WebGLTexture | null = null;
	let trailFramebuffer0: WebGLFramebuffer | null = null;
	let trailFramebuffer1: WebGLFramebuffer | null = null;
	let currentTrailBuffer = 0; // Toggle between 0 and 1

	// Visualization parameters - Square resolution (720p for smaller file size)
	const width = 720;
	const height = 720;

	// Black and white base with colored trails
	const color1 = '#ffffff'; // White for SVG
	const color2 = '#000000'; // Black for SVG
	const color3 = '#ffffff'; // White for SVG

	// Color swatches - more distinctive palette with varied intensities
	const colorSwatches = [
		{ name: 'electric blue', hue: 200, sat: 100, light: 55 },
		{ name: 'hot pink', hue: 330, sat: 100, light: 65 },
		{ name: 'cyber yellow', hue: 55, sat: 100, light: 70 },
		{ name: 'neon green', hue: 120, sat: 100, light: 45 },
		{ name: 'toxic purple', hue: 275, sat: 100, light: 55 },
		{ name: 'acid orange', hue: 25, sat: 100, light: 60 },
		{ name: 'deep red', hue: 0, sat: 100, light: 50 },
		{ name: 'turquoise', hue: 175, sat: 100, light: 50 },
		{ name: 'magenta', hue: 310, sat: 100, light: 60 },
		{ name: 'lime', hue: 85, sat: 100, light: 55 },
		{ name: 'violet', hue: 260, sat: 100, light: 60 },
		{ name: 'coral', hue: 15, sat: 100, light: 65 }
	];

	// Pick random color swatch
	const randomSwatch = colorSwatches[Math.floor(Math.random() * colorSwatches.length)];
	const trailHue = randomSwatch.hue;

	// Distortion effect - can be changed via dropdown
	let distortionType = $state(Math.floor(Math.random() * 5));

	// Convert HSL to RGB for WebGL
	function hslToRgb(h: number, s: number, l: number): [number, number, number] {
		s /= 100;
		l /= 100;
		const k = (n: number) => (n + h / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
		return [f(0), f(8), f(4)];
	}

	const bgColorRgb = [0.0, 0.0, 0.0]; // Black background
	const trailColorRgb = hslToRgb(trailHue, 90, 60); // Vibrant colored trails

	onMount(async () => {
		if (!canvas) return;

		// Initialize WebGL
		gl = canvas.getContext('webgl');
		if (!gl) {
			console.error('WebGL not supported');
			return;
		}

		// Fetch and colorize the SVG
		const response = await fetch('/raptor-svg.svg');
		const svgText = await response.text();

		const colorizedSvg = svgText
			.replaceAll('fill="#ed1c24"', `fill="${color1}"`)
			.replaceAll('fill="#231f20"', `fill="${color2}"`)
			.replaceAll('fill="#fff"', `fill="${color3}"`);

		const blob = new Blob([colorizedSvg], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);

		const img = new Image();
		img.crossOrigin = 'anonymous';
		// Set explicit size for high resolution
		img.width = width;
		img.height = height;
		img.src = url;
		img.onload = () => {
			raptorImage = img;
			setupWebGL();
			URL.revokeObjectURL(url);
		};
		img.onerror = () => {
			console.error('Failed to load raptor SVG');
		};
	});

	function setupWebGL() {
		if (!gl || !raptorImage) return;

		// Vertex shader
		const vertexShaderSource = `
			attribute vec2 a_position;
			attribute vec2 a_texCoord;
			varying vec2 v_texCoord;
			void main() {
				gl_Position = vec4(a_position, 0.0, 1.0);
				v_texCoord = a_texCoord;
			}
		`;

		// Fragment shader with distortion effects
		const fragmentShaderSource = `
			precision mediump float;
			uniform sampler2D u_texture;
			uniform float u_scale;
			uniform float u_rotation;
			uniform float u_distortionAmount;
			uniform float u_time;
			uniform int u_distortionType;
			uniform vec3 u_bgColor;
			uniform float u_hueShift;
			uniform float u_bassIntensity;
			uniform float u_glowIntensity;
			uniform vec3 u_trailColor;
			uniform sampler2D u_trailTexture;
			uniform float u_trailDecay;
			uniform bool u_invertColors;
			varying vec2 v_texCoord;

			vec2 rotate(vec2 v, float a) {
				float s = sin(a);
				float c = cos(a);
				mat2 m = mat2(c, -s, s, c);
				return m * v;
			}

			vec3 rgb2hsv(vec3 c) {
				vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
				vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
				vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
				float d = q.x - min(q.w, q.y);
				float e = 1.0e-10;
				return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
			}

			vec3 hsv2rgb(vec3 c) {
				vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
				vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
				return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
			}

			// Simple noise function
			float random(vec2 st) {
				return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
			}

			// 3D Perlin-like noise
			float noise3d(vec3 p) {
				vec3 i = floor(p);
				vec3 f = fract(p);
				f = f * f * (3.0 - 2.0 * f);

				float n = i.x + i.y * 57.0 + 113.0 * i.z;
				return mix(
					mix(mix(random(vec2(n + 0.0, 0.0)), random(vec2(n + 1.0, 0.0)), f.x),
						mix(random(vec2(n + 57.0, 0.0)), random(vec2(n + 58.0, 0.0)), f.x), f.y),
					mix(mix(random(vec2(n + 113.0, 0.0)), random(vec2(n + 114.0, 0.0)), f.x),
						mix(random(vec2(n + 170.0, 0.0)), random(vec2(n + 171.0, 0.0)), f.x), f.y),
					f.z);
			}

			void main() {
				vec2 center = vec2(0.5, 0.5);
				vec2 uv = v_texCoord;

				// Apply distortion
				if (u_distortionType == 0) {
					// Horizontal sine wave
					uv.x += sin(uv.y * 20.0 + u_time) * u_distortionAmount * 0.05;
				} else if (u_distortionType == 1) {
					// Vertical sine wave
					uv.y += sin(uv.x * 20.0 + u_time) * u_distortionAmount * 0.05;
				} else if (u_distortionType == 2) {
					// Circular ripple
					float dist = distance(uv, center);
					uv.x += sin(dist * 20.0 + u_time) * u_distortionAmount * 0.05;
				} else if (u_distortionType == 3) {
					// Diagonal waves
					uv.x += sin(uv.y * 15.0 + u_time) * u_distortionAmount * 0.05 * cos(u_time * 0.5);
				} else if (u_distortionType == 4) {
					// Enhanced Glitch - more controlled, less obscuring
					float glitchSeed = floor(u_time * 3.5); // Slightly slower changes
					float microGlitch = fract(u_time * 3.5); // Sub-frame variation

					// Multiple horizontal displacement blocks with varying frequencies
					float block1 = step(0.6, sin(uv.y * 15.0 + glitchSeed * 13.7));
					float block2 = step(0.7, sin(uv.y * 28.0 + glitchSeed * 7.3));
					float block3 = step(0.75, sin(uv.y * 45.0 + glitchSeed * 23.1));
					float block4 = step(0.8, sin(uv.y * 70.0 + glitchSeed * 31.4));

					// Random displacement amounts - reduced intensity
					float disp1 = (random(vec2(glitchSeed, 1.0)) - 0.5);
					float disp2 = (random(vec2(glitchSeed, 2.0)) - 0.5);
					float disp3 = (random(vec2(glitchSeed, 3.0)) - 0.5);
					float disp4 = (random(vec2(glitchSeed, 4.0)) - 0.5);

					// Apply layered displacement with reduced intensities
					uv.x += block1 * disp1 * u_distortionAmount * 0.12;
					uv.x += block2 * disp2 * u_distortionAmount * 0.15;
					uv.x += block3 * disp3 * u_distortionAmount * 0.1;
					uv.y += block4 * disp4 * u_distortionAmount * 0.08;

					// Add micro-glitches between frames - less frequent
					if (microGlitch > 0.9) {
						uv.x += (random(vec2(glitchSeed, 5.0)) - 0.5) * u_distortionAmount * 0.2;
					}

					// Enhanced chromatic aberration - more subtle
					if (u_distortionAmount > 0.5) {
						float chromaShift = u_distortionAmount * 0.02;
						uv.x += sin(uv.y * 100.0 + glitchSeed * 5.0) * chromaShift;
						// Vertical glitch lines - less frequent
						if (random(vec2(floor(uv.y * 50.0), glitchSeed)) > 0.97) {
							uv.x += (random(vec2(glitchSeed, 6.0)) - 0.5) * u_distortionAmount * 0.25;
						}
					}

					// Random block corruption - only at very high distortion
					if (u_distortionAmount > 0.8) {
						float blockCorrupt = step(0.95, random(vec2(floor(uv.y * 20.0), glitchSeed)));
						uv.x += blockCorrupt * (random(vec2(glitchSeed, 7.0)) - 0.5) * 0.3;
					}
				}

				// Apply rotation and scale (divide by scale to zoom out)
				vec2 rotated = rotate(uv - center, u_rotation) / u_scale + center;

				// Sample texture
				vec4 texColor = texture2D(u_texture, rotated);

				// Edge detection using Sobel operator
				float edgeStep = 0.005;
				vec4 n = texture2D(u_texture, rotated + vec2(0.0, -edgeStep));
				vec4 s = texture2D(u_texture, rotated + vec2(0.0, edgeStep));
				vec4 e = texture2D(u_texture, rotated + vec2(edgeStep, 0.0));
				vec4 w = texture2D(u_texture, rotated + vec2(-edgeStep, 0.0));

				// Calculate edge intensity
				float edgeX = length(e.rgb - w.rgb);
				float edgeY = length(n.rgb - s.rgb);
				float edge = sqrt(edgeX * edgeX + edgeY * edgeY);
				edge = smoothstep(0.1, 0.5, edge);

				// Convert texture to grayscale
				float gray = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
				vec3 grayscaleTexture = vec3(gray);

				// Mix black background with grayscale texture
				vec3 normalColor = mix(u_bgColor, grayscaleTexture, texColor.a);

				// Colorize the white/bright parts of the texture with complementary color
				vec3 textureColorHSV = rgb2hsv(u_trailColor);
				// Add 180 degrees for complementary color, then add hue shift
				float textureHueShift = (u_hueShift / 360.0) * 0.4; // Shift texture color too
				textureColorHSV.x = fract(textureColorHSV.x + 0.5 + textureHueShift); // +0.5 = +180 degrees

				// Boost brightness based on bass for glow effect - INCREASED
				float glowBoost = 1.0 + (u_glowIntensity * 3.0); // 1.5 -> 3.0 (doubled)
				textureColorHSV.z = min(1.0, textureColorHSV.z * glowBoost);
				vec3 textureColor = hsv2rgb(textureColorHSV);

				// Apply color to bright areas of the texture (based on brightness)
				// Increase color intensity when glow is active - INCREASED
				float colorMixAmount = gray * texColor.a * (0.8 + u_glowIntensity * 0.5); // More intense
				normalColor = mix(normalColor, textureColor * gray, colorMixAmount);

				// Shift the trail color hue based on high frequencies - INCREASED
				vec3 trailColorHSV = rgb2hsv(u_trailColor);
				float colorHueShift = (u_hueShift / 360.0) * 1.0; // 0.6 -> 1.0 (full range)
				trailColorHSV.x = fract(trailColorHSV.x + colorHueShift);
				// Boost saturation and brightness for more vibrant colors - INCREASED
				trailColorHSV.y = min(1.0, trailColorHSV.y * 1.4); // 1.2 -> 1.4
				trailColorHSV.z = min(1.0, trailColorHSV.z * 1.3); // 1.1 -> 1.3
				vec3 shiftedTrailColor = hsv2rgb(trailColorHSV);

				// Add colored edges with shifted color
				vec3 coloredEdge = shiftedTrailColor * edge * 1.5;
				normalColor += coloredEdge;

				// Sample previous frame trails and decay them
				vec4 previousTrail = texture2D(u_trailTexture, v_texCoord);
				vec3 decayedTrail = previousTrail.rgb * u_trailDecay;

				// Add new colored trail based on brightness with shifted color
				float brightness = gray * texColor.a;
				vec3 newTrail = shiftedTrailColor * brightness * 0.3;

				// Combine decayed trail with new trail
				vec3 trails = decayedTrail + newTrail;

				// Add trails to the image
				vec3 finalColor = normalColor + trails;

				// 3D NOISE EFFECT - comment out to remove
				vec3 noiseCoord = vec3(v_texCoord * 3.0, u_time * 0.1);
				float noiseValue = noise3d(noiseCoord);
				// Multiply color by noise for organic variation
				finalColor *= 0.8 + noiseValue * 0.4; // Range from 0.8 to 1.2
				// END 3D NOISE EFFECT

				// Color inversion (keeping black as black)
				if (u_invertColors) {
					// Only invert non-black colors
					float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
					if (luminance > 0.1) { // Only invert if not close to black
						finalColor = vec3(1.0) - finalColor;
					}
				}

				gl_FragColor = vec4(finalColor, 1.0);
			}
		`;

		// Compile shaders
		const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
		gl.shaderSource(vertexShader, vertexShaderSource);
		gl.compileShader(vertexShader);

		const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
		gl.shaderSource(fragmentShader, fragmentShaderSource);
		gl.compileShader(fragmentShader);

		// Create program
		program = gl.createProgram()!;
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);
		gl.useProgram(program);

		// Setup geometry (full screen quad)
		const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
		const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]);

		const positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

		const positionLocation = gl.getAttribLocation(program, 'a_position');
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

		const texCoordBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

		const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
		gl.enableVertexAttribArray(texCoordLocation);
		gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

		// Create high-resolution texture from image
		// First draw to a canvas at high resolution to rasterize the SVG
		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = width;
		tempCanvas.height = height;
		const tempCtx = tempCanvas.getContext('2d');
		if (tempCtx) {
			tempCtx.drawImage(raptorImage, 0, 0, width, height);
		}

		texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tempCanvas);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		// Create ping-pong framebuffers and textures for trail effect
		// Buffer 0
		trailFramebuffer0 = gl.createFramebuffer();
		trailTexture0 = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, trailTexture0);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		gl.bindFramebuffer(gl.FRAMEBUFFER, trailFramebuffer0);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trailTexture0, 0);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		// Buffer 1
		trailFramebuffer1 = gl.createFramebuffer();
		trailTexture1 = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, trailTexture1);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		gl.bindFramebuffer(gl.FRAMEBUFFER, trailFramebuffer1);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trailTexture1, 0);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

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
		if (audioContext) {
			try {
				if (audioContext.state !== 'closed') {
					audioContext.close();
				}
			} catch (e) {
				// Already closed
			}
			audioContext = null;
		}
		dataArray = null;
		if (gl && texture) {
			gl.deleteTexture(texture);
		}
		if (gl && program) {
			gl.deleteProgram(program);
		}
	}

	function setupAudio() {
		if (!audioElement) {
			console.log('[AudioVisualizerWebGL] setupAudio called but no audioElement');
			return;
		}

		// If already setup, don't do it again
		if (audioContext && source && analyser && dataArray) {
			console.log('[AudioVisualizerWebGL] Audio already setup, skipping');
			return;
		}

		try {
			console.log('[AudioVisualizerWebGL] Creating AudioContext');
			audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
			console.log('[AudioVisualizerWebGL] AudioContext state:', audioContext.state);

			analyser = audioContext.createAnalyser();
			analyser.fftSize = config.fftSize || 256;
			analyser.smoothingTimeConstant = config.temporalSmoothing ?? 0.8;

			const bufferLength = analyser.frequencyBinCount;
			dataArray = new Uint8Array(bufferLength);

			console.log('[AudioVisualizerWebGL] Creating MediaElementSource');
			source = audioContext.createMediaElementSource(audioElement);
			source.connect(analyser);
			analyser.connect(audioContext.destination);
			console.log('[AudioVisualizerWebGL] Audio setup complete');
		} catch (error) {
			console.error('[AudioVisualizerWebGL] Audio setup error:', error);
		}
	}

	function analyzeFrequencyBands(data: Uint8Array): { bass: number; mid: number; high: number } {
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

		let bass = bassSum / 4 / 255;
		let mid = midSum / 12 / 255;
		let high = highSum / 48 / 255;

		// NO FUCKING SMOOTHING - JUST RAW VALUES
		bass = Math.pow(bass, 3.0);
		mid = Math.pow(mid, 1.5);
		high = Math.pow(high, 1.5);

		return { bass, mid, high };
	}

	let time = 0;
	let rotation = 0;
	let smoothedMid = 0;
	let smoothedBass = 0;
	let lastInversionTime = 0;
	let isInverted = $state(false);
	let inversionStartTime = 0;

	let frameCounter = 0;

	function draw(bass: number, mid: number, high: number) {
		if (!gl || !program) return;

		// Log every 60 frames (once per second at 60fps)
		if (frameCounter % 60 === 0) {
			console.log(`[BROWSER] Frame ${frameCounter}: bass=${bass.toFixed(3)}, mid=${mid.toFixed(3)}, high=${high.toFixed(3)}`);
		}
		frameCounter++;

		// Smooth bass to prevent jittery scaling
		const bassSmoothing = config.bassSmoothing ?? 0.7;
		smoothedBass = smoothedBass * bassSmoothing + bass * (1 - bassSmoothing);

		// Scale - lock to 1.0 if disabled, apply intensity multiplier
		const scaleMin = config.scaleMin ?? 0.15;
		const scaleRange = config.scaleRange ?? 0.8;
		const scale = enableScale ? scaleMin + smoothedBass * scaleRange * scaleIntensity : 1.0;

		// Smooth mid for inversion to reduce strobing
		const midSmoothing = config.midSmoothing ?? 0.85;
		smoothedMid = smoothedMid * midSmoothing + mid * (1 - midSmoothing);

		// Distortion - set to 0 if disabled, apply intensity multiplier
		const distortionThreshold = config.distortionThreshold ?? 0.5;
		const distortionIntensityCalc = Math.max(0, mid - distortionThreshold) / (1 - distortionThreshold);
		const distortionMultiplier = config.distortionMultiplier ?? 0.6;
		const distortionAmount = enableDistortion ? distortionIntensityCalc * distortionMultiplier * distortionIntensity : 0;
		const distortionBaseSpeed = config.distortionBaseSpeed ?? 0.02;
		const distortionSpeedMultiplier = config.distortionSpeedMultiplier ?? 0.2;
		const distortionSpeed = enableDistortion ? (distortionBaseSpeed + distortionIntensityCalc * distortionSpeedMultiplier) * distortionIntensity : 0;
		time += distortionSpeed;

		// Rotation - freeze if disabled, apply intensity multiplier
		const rotationSpeed = config.rotationSpeed ?? 0.8;
		if (enableRotation) {
			rotation += high * rotationSpeed * rotationIntensity;
			rotation = rotation % 360;
		}

		// Hue shift - set to 0 if disabled, apply intensity multiplier
		const hueShiftMultiplier = config.hueShiftMultiplier ?? 240;
		const hueShift = enableHueShift ? high * hueShiftMultiplier * hueShiftIntensity : 0;

		// Color inversion trigger with cooldown - skip if disabled
		const currentTime = Date.now();
		if (enableInversion) {
			const inversionBassThreshold = config.inversionBassThreshold ?? 0.7;
			const inversionCooldownMs = config.inversionCooldownMs ?? 500;
			const inversionDurationMs = config.inversionDurationMs ?? 300;

			if (bass > inversionBassThreshold && currentTime - lastInversionTime > inversionCooldownMs) {
				isInverted = true;
				inversionStartTime = currentTime;
				lastInversionTime = currentTime;
			}

			// Auto-revert inversion after duration
			if (isInverted && currentTime - inversionStartTime > inversionDurationMs) {
				isInverted = false;
			}
		} else {
			isInverted = false;
		}

		gl.useProgram(program);

		// Bind raptor texture to texture unit 0
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		const textureLocation = gl.getUniformLocation(program, 'u_texture');
		gl.uniform1i(textureLocation, 0);

		// Set uniforms
		const scaleLocation = gl.getUniformLocation(program, 'u_scale');
		gl.uniform1f(scaleLocation, scale);

		const rotationLocation = gl.getUniformLocation(program, 'u_rotation');
		gl.uniform1f(rotationLocation, (rotation * Math.PI) / 180);

		const distortionAmountLocation = gl.getUniformLocation(program, 'u_distortionAmount');
		gl.uniform1f(distortionAmountLocation, distortionAmount);

		const timeLocation = gl.getUniformLocation(program, 'u_time');
		gl.uniform1f(timeLocation, time);

		const distortionTypeLocation = gl.getUniformLocation(program, 'u_distortionType');
		gl.uniform1i(distortionTypeLocation, distortionType);

		const bgColorLocation = gl.getUniformLocation(program, 'u_bgColor');
		gl.uniform3f(bgColorLocation, bgColorRgb[0], bgColorRgb[1], bgColorRgb[2]);

		const trailColorLocation = gl.getUniformLocation(program, 'u_trailColor');
		gl.uniform3f(trailColorLocation, trailColorRgb[0], trailColorRgb[1], trailColorRgb[2]);

		const hueShiftLocation = gl.getUniformLocation(program, 'u_hueShift');
		gl.uniform1f(hueShiftLocation, hueShift);

		const bassIntensityLocation = gl.getUniformLocation(program, 'u_bassIntensity');
		gl.uniform1f(bassIntensityLocation, smoothedMid); // Use smoothed mid for inversion

		// Glow intensity based on bass
		const glowIntensityLocation = gl.getUniformLocation(program, 'u_glowIntensity');
		gl.uniform1f(glowIntensityLocation, bass);

		// Trail decay - set to 0 (full clear) if disabled, otherwise use config value with intensity
		const trailDecayLocation = gl.getUniformLocation(program, 'u_trailDecay');
		const baseTrailDecay = config.trailDecay ?? 0.92;
		const trailDecay = enableTrails ? baseTrailDecay * trailIntensity : 0.0;
		gl.uniform1f(trailDecayLocation, trailDecay);

		// Color inversion
		const invertColorsLocation = gl.getUniformLocation(program, 'u_invertColors');
		gl.uniform1i(invertColorsLocation, isInverted ? 1 : 0);

		// Ping-pong: Read from one buffer, write to the other
		const readTexture = currentTrailBuffer === 0 ? trailTexture0 : trailTexture1;
		const writeFramebuffer = currentTrailBuffer === 0 ? trailFramebuffer1 : trailFramebuffer0;

		// Bind the READ texture (previous frame's trail)
		const trailTextureLocation = gl.getUniformLocation(program, 'u_trailTexture');
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, readTexture);
		gl.uniform1i(trailTextureLocation, 1);

		// Render to the WRITE framebuffer (next frame's trail)
		gl.bindFramebuffer(gl.FRAMEBUFFER, writeFramebuffer);
		gl.clearColor(bgColorRgb[0], bgColorRgb[1], bgColorRgb[2], 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// Then render to screen with the same result
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.clearColor(bgColorRgb[0], bgColorRgb[1], bgColorRgb[2], 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// Toggle buffer for next frame
		currentTrailBuffer = 1 - currentTrailBuffer;
	}

	function animate() {
		if (!gl || !analyser || !dataArray) return;

		analyser.getByteFrequencyData(dataArray);
		const { bass, mid, high } = analyzeFrequencyBands(dataArray);
		draw(bass, mid, high);

		animationId = requestAnimationFrame(animate);
	}

	// Public methods to control the visualizer
	export function start() {
		if (!audioElement) return;

		// Setup audio if not already done
		if (!audioContext) {
			setupAudio();
		}

		// Resume audio context if suspended (for autoplay restrictions)
		if (audioContext?.state === 'suspended') {
			audioContext.resume();
		}

		// Start animation if not already running
		if (animationId === 0 && analyser && dataArray && gl) {
			rotation = 0;
			animationId = requestAnimationFrame(animate);
		}
	}

	export function stop() {
		// Stop animation
		if (animationId !== 0) {
			cancelAnimationFrame(animationId);
			animationId = 0;
		}

		// Draw static frame
		if (gl) {
			draw(0, 0, 0);
		}
	}

	// Export render parameters for server-side rendering
	export function getRenderParams() {
		return {
			distortionType,
			trailHue,
			trailSat: 90,
			trailLight: 60
		};
	}
</script>

<div class="space-y-4">
	<div class="flex justify-center">
		<canvas bind:this={canvas} {width} {height} class="" style="max-width: 100%; height: auto;"
		></canvas>
	</div>
</div>

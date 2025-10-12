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

	// WebGL specific
	let gl: WebGLRenderingContext | null = null;
	let program: WebGLProgram | null = null;
	let texture: WebGLTexture | null = null;
	let raptorImage: HTMLImageElement | null = null;

	// Visualization parameters - Square resolution
	const width = 1080;
	const height = 1080;

	// Generate complementary colors
	const baseHue = Math.random() * 360;
	const complementHue = (baseHue + 180) % 360;
	const color1 = `hsl(${baseHue}, 85%, 65%)`;
	const color2 = `hsl(${complementHue}, 85%, 65%)`;
	const color3 = `hsl(${baseHue}, 85%, 80%)`;

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

	const bgColorRgb = hslToRgb(baseHue, 90, 60); // Much more saturated and brighter base

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
			console.log('Raptor SVG loaded for WebGL at', img.width, 'x', img.height);
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
					// Glitch - multi-layer displacement
					float glitchSeed = floor(u_time * 3.0);

					// Horizontal displacement blocks
					float block1 = step(0.6, sin(uv.y * 20.0 + glitchSeed * 13.7));
					float block2 = step(0.7, sin(uv.y * 35.0 + glitchSeed * 7.3));
					float block3 = step(0.8, sin(uv.y * 60.0 + glitchSeed * 23.1));

					// Random displacement amounts per block
					float disp1 = random(vec2(glitchSeed, 1.0)) - 0.5;
					float disp2 = random(vec2(glitchSeed, 2.0)) - 0.5;
					float disp3 = random(vec2(glitchSeed, 3.0)) - 0.5;

					// Apply layered displacement
					uv.x += block1 * disp1 * u_distortionAmount * 0.15;
					uv.x += block2 * disp2 * u_distortionAmount * 0.2;
					uv.y += block3 * disp3 * u_distortionAmount * 0.1;

					// Color channel separation
					if (u_distortionAmount > 0.5) {
						float chromaShift = u_distortionAmount * 0.02;
						uv.x += sin(uv.y * 100.0 + glitchSeed) * chromaShift;
					}
				}

				// Apply rotation and scale (divide by scale to zoom out)
				vec2 rotated = rotate(uv - center, u_rotation) / u_scale + center;

				// Sample texture
				vec4 texColor = texture2D(u_texture, rotated);

				// Apply hue shift to background color with smoothing
				vec3 bgHSV = rgb2hsv(u_bgColor);
				// Smooth the hue shift with a sine wave for less strobing
				float smoothHueShift = sin(u_hueShift * 3.14159 / 180.0) * 90.0; // Smoother transition
				bgHSV.x = fract(bgHSV.x + smoothHueShift / 360.0);
				vec3 bgWithHueShift = hsv2rgb(bgHSV);

				// Mix with background color based on alpha
				vec3 normalColor = mix(bgWithHueShift, texColor.rgb, texColor.a);

				// Create inverted version
				vec3 invertedColor = 1.0 - normalColor;

				// Hard snap between normal and inverted based on mid frequencies
				vec3 finalColor = (u_bassIntensity > 0.45) ? invertedColor : normalColor;

				// 3D NOISE EFFECT - comment out to remove
				vec3 noiseCoord = vec3(v_texCoord * 3.0, u_time * 0.1);
				float noiseValue = noise3d(noiseCoord);
				// Multiply color by noise for organic variation
				finalColor *= 0.8 + noiseValue * 0.4; // Range from 0.8 to 1.2
				// END 3D NOISE EFFECT

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
		const positions = new Float32Array([
			-1, -1,  1, -1,  -1, 1,
			-1, 1,   1, -1,  1, 1
		]);
		const texCoords = new Float32Array([
			0, 1,  1, 1,  0, 0,
			0, 0,  1, 1,  1, 0
		]);

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

		console.log('WebGL setup complete');
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
		if (!audioElement) return;

		// If already setup, don't do it again
		if (audioContext && source && analyser && dataArray) return;

		try {
			audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
			analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;
			analyser.smoothingTimeConstant = 0.8;

			const bufferLength = analyser.frequencyBinCount;
			dataArray = new Uint8Array(bufferLength);

			source = audioContext.createMediaElementSource(audioElement);
			source.connect(analyser);
			analyser.connect(audioContext.destination);
		} catch (error) {
			console.error('Audio setup error:', error);
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

		let bass = (bassSum / 4) / 255;
		let mid = (midSum / 12) / 255;
		let high = (highSum / 48) / 255;

		// NO FUCKING SMOOTHING - JUST RAW VALUES
		bass = Math.pow(bass, 3.0);
		mid = Math.pow(mid, 1.5);
		high = Math.pow(high, 1.5);

		return { bass, mid, high };
	}

	let time = 0;
	let rotation = 0;
	let smoothedMid = 0;

	function draw(bass: number, mid: number, high: number) {
		if (!gl || !program) return;

		const scale = 0.15 + bass * 0.8;

		// Smooth mid for inversion to reduce strobing
		const smoothingFactor = 0.85;
		smoothedMid = smoothedMid * smoothingFactor + mid * (1 - smoothingFactor);

		const distortionThreshold = 0.3;
		const distortionIntensity = Math.max(0, mid - distortionThreshold) / (1 - distortionThreshold);
		const distortionAmount = distortionIntensity;
		const distortionSpeed = 0.02 + distortionIntensity * 0.2;
		time += distortionSpeed;

		rotation += high * 0.8;
		rotation = rotation % 360;

		// Make hue shift MUCH more dramatic - full spectrum shift
		const hueShift = high * 180; // Shift up to 180 degrees (half the color wheel)

		gl.useProgram(program);

		// Set uniforms
		const scaleLocation = gl.getUniformLocation(program, 'u_scale');
		gl.uniform1f(scaleLocation, scale);

		const rotationLocation = gl.getUniformLocation(program, 'u_rotation');
		gl.uniform1f(rotationLocation, rotation * Math.PI / 180);

		const distortionAmountLocation = gl.getUniformLocation(program, 'u_distortionAmount');
		gl.uniform1f(distortionAmountLocation, distortionAmount);

		const timeLocation = gl.getUniformLocation(program, 'u_time');
		gl.uniform1f(timeLocation, time);

		const distortionTypeLocation = gl.getUniformLocation(program, 'u_distortionType');
		gl.uniform1i(distortionTypeLocation, distortionType);

		const bgColorLocation = gl.getUniformLocation(program, 'u_bgColor');
		gl.uniform3f(bgColorLocation, bgColorRgb[0], bgColorRgb[1], bgColorRgb[2]);

		const hueShiftLocation = gl.getUniformLocation(program, 'u_hueShift');
		gl.uniform1f(hueShiftLocation, hueShift);

		const bassIntensityLocation = gl.getUniformLocation(program, 'u_bassIntensity');
		gl.uniform1f(bassIntensityLocation, smoothedMid); // Use smoothed mid for inversion

		// Clear and draw
		gl.clearColor(bgColorRgb[0], bgColorRgb[1], bgColorRgb[2], 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}

	function animate() {
		if (!gl || !analyser || !dataArray) return;

		analyser.getByteFrequencyData(dataArray);
		const { bass, mid, high } = analyzeFrequencyBands(dataArray);
		draw(bass, mid, high);

		if (isPlaying) {
			animationId = requestAnimationFrame(animate);
		}
	}

	$effect(() => {
		if (audioElement) {
			setTimeout(() => {
				setupAudio();
			}, 100);
		}
	});

	$effect(() => {
		if (isPlaying && analyser && dataArray && gl) {
			rotation = 0;

			if (audioContext && audioContext.state === 'suspended') {
				audioContext.resume();
			}

			if (animationId === 0) {
				animationId = requestAnimationFrame(animate);
			}
		} else {
			if (animationId) {
				cancelAnimationFrame(animationId);
				animationId = 0;
			}
		}
	});

	$effect(() => {
		if (!isPlaying && gl) {
			draw(0, 0, 0);
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

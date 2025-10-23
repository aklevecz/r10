<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import AudioVisualizerWebGL from '$lib/components/AudioVisualizerWebGL.svelte';
	import VideoRecorder from '$lib/components/VideoRecorder.svelte';
	import { getAvailableProfiles, getProfileConfig } from '$lib/profiles.js';

	interface Song {
		trackId: number;
		trackName: string;
		artistName: string;
		artworkUrl100: string;
		previewUrl: string;
		collectionName: string;
	}

	// Test song (default/fallback)
	const DEFAULT_TEST_SONG = {
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
	let isPlaying = $state(false);

	// Song search state
	let searchQuery = $state('');
	let searchResults = $state<Song[]>([]);
	let searching = $state(false);
	let searchError = $state('');
	let selectedSong = $state<Song | null>(null);
	let showSearch = $state(false);

	// File upload state
	let uploadedFile = $state<File | null>(null);
	let uploadedFileUrl = $state<string | null>(null);

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

	// Advanced scale tuning parameters
	let bassSmoothing = $state(0.7);
	let bassPower = $state(3.0);
	let scaleMin = $state(0.15);
	let scaleRange = $state(0.8);

	// Inversion parameters
	let inversionWhiteDimFactor = $state(0.75);

	// Profile saving
	let showSaveProfile = $state(false);
	let newProfileName = $state('');
	let customProfiles = $state<Record<string, any>>({});
	let showProfileCode = $state(false);
	let generatedProfileCode = $state('');
	let profileLoadNotification = $state('');

	onMount(() => {
		// Create audio element
		audioElement = new Audio();
		audioElement.crossOrigin = 'anonymous';
		audioElement.src = uploadedFileUrl || selectedSong?.previewUrl || DEFAULT_TEST_SONG.previewUrl;
		audioElement.loop = true;

		audioElement.onplay = () => {
			audioVisualizer?.start();
		};

		// Load custom profiles from localStorage
		const savedProfiles = localStorage.getItem('r10_custom_profiles');
		if (savedProfiles) {
			try {
				customProfiles = JSON.parse(savedProfiles);
			} catch (e) {
				console.error('Failed to load custom profiles:', e);
			}
		}

		return () => {
			// Clean up uploaded file URL
			if (uploadedFileUrl) {
				URL.revokeObjectURL(uploadedFileUrl);
			}
		};
	});

	// Update audio source when song or uploaded file changes
	$effect(() => {
		if (audioElement) {
			const wasPlaying = !audioElement.paused;
			// Priority: uploaded file > selected song > default
			audioElement.src = uploadedFileUrl || selectedSong?.previewUrl || DEFAULT_TEST_SONG.previewUrl;
			if (wasPlaying) {
				audioElement.play().catch(err => console.error('Failed to play:', err));
			}
		}
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

	async function searchSongs() {
		if (!searchQuery.trim()) return;

		searching = true;
		searchError = '';
		searchResults = [];

		try {
			const response = await fetch(`/api/search-songs?q=${encodeURIComponent(searchQuery)}`);

			if (!response.ok) {
				throw new Error('Failed to fetch songs');
			}

			const data = await response.json();

			if (data.success) {
				searchResults = data.results;

				if (searchResults.length === 0) {
					searchError = 'No songs found';
				}
			} else {
				throw new Error(data.error || 'Failed to search songs');
			}
		} catch (err) {
			searchError = 'Error searching for songs';
			console.error(err);
		} finally {
			searching = false;
		}
	}

	function selectSong(song: Song) {
		selectedSong = song;
		showSearch = false;
		searchQuery = '';
		searchResults = [];
		searchError = '';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			searchSongs();
		}
	}

	function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		// Check if it's an audio file
		if (!file.type.startsWith('audio/')) {
			searchError = 'Please upload an audio file';
			return;
		}

		// Clean up previous uploaded file URL
		if (uploadedFileUrl) {
			URL.revokeObjectURL(uploadedFileUrl);
		}

		// Create object URL for the uploaded file
		uploadedFile = file;
		uploadedFileUrl = URL.createObjectURL(file);

		// Clear selected song and search when uploading file
		selectedSong = null;
		showSearch = false;
		searchError = '';
	}

	function clearUploadedFile() {
		if (uploadedFileUrl) {
			URL.revokeObjectURL(uploadedFileUrl);
		}
		uploadedFile = null;
		uploadedFileUrl = null;
	}

	function resetToDefaults() {
		bassSmoothing = 0.7;
		bassPower = 3.0;
		scaleMin = 0.15;
		scaleRange = 0.8;
		inversionWhiteDimFactor = 0.75;
	}

	function logCurrentValues() {
		console.log('Current Scale Parameters:');
		console.log(`  bassSmoothing: ${bassSmoothing}`);
		console.log(`  bassPower: ${bassPower}`);
		console.log(`  scaleMin: ${scaleMin}`);
		console.log(`  scaleRange: ${scaleRange}`);
		console.log('\nTo update profile defaults, modify src/lib/profiles.js');
	}

	function saveAsProfile() {
		if (!newProfileName.trim()) {
			alert('Please enter a profile name');
			return;
		}

		const profileId = newProfileName.toLowerCase().replace(/\s+/g, '-');

		const profile = {
			name: newProfileName,
			description: 'Custom profile created in test page',
			frameRate: 60,
			fftSize: 256,
			temporalSmoothing: 0.8,
			bassPower,
			midPower: 1.5,
			highPower: 1.5,
			bassSmoothing,
			midSmoothing: 0.85,
			rotationSpeed: 0.8,
			distortionThreshold: 0.5,
			distortionMultiplier: 0.6,
			distortionBaseSpeed: 0.02,
			distortionSpeedMultiplier: 0.2,
			scaleMin,
			scaleRange,
			trailDecay: 0.92,
			inversionBassThreshold: 0.7,
			inversionDurationMs: 300,
			inversionCooldownMs: 500,
			inversionWhiteDimFactor,
			hueShiftMultiplier: 240,
			// Save intensity multipliers
			rotationIntensity,
			scaleIntensity,
			distortionIntensity,
			hueShiftIntensity,
			trailIntensity,
			// Save effect toggles
			enableRotation,
			enableScale,
			enableDistortion,
			enableHueShift,
			enableInversion,
			enableTrails
		};

		console.log('Saving profile with intensities:', {
			rotationIntensity,
			scaleIntensity,
			distortionIntensity,
			hueShiftIntensity,
			trailIntensity
		});

		customProfiles[profileId] = profile;
		localStorage.setItem('r10_custom_profiles', JSON.stringify(customProfiles));

		console.log('Profile saved:', profile);

		showSaveProfile = false;
		newProfileName = '';

		// Switch to the new profile
		selectedProfile = profileId;

		alert(`Profile "${profile.name}" saved!`);
	}

	function generateProfileCode() {
		const profileId = selectedProfile;
		const profile = customProfiles[profileId];

		if (!profile) {
			alert('Please select a custom profile first');
			return;
		}

		generatedProfileCode = `  '${profileId}': {
    name: '${profile.name}',
    description: '${profile.description}',

    // ========== FRAME RATE ==========
    frameRate: ${profile.frameRate},

    // ========== AUDIO ANALYSIS ==========
    fftSize: ${profile.fftSize},
    temporalSmoothing: ${profile.temporalSmoothing},

    bassPower: ${profile.bassPower},
    midPower: ${profile.midPower},
    highPower: ${profile.highPower},

    // ========== MOTION - SMOOTHING ==========
    bassSmoothing: ${profile.bassSmoothing},
    midSmoothing: ${profile.midSmoothing},

    // ========== MOTION - SPEED ==========
    rotationSpeed: ${profile.rotationSpeed},

    // ========== EFFECTS - DISTORTION ==========
    distortionThreshold: ${profile.distortionThreshold},
    distortionMultiplier: ${profile.distortionMultiplier},
    distortionBaseSpeed: ${profile.distortionBaseSpeed},
    distortionSpeedMultiplier: ${profile.distortionSpeedMultiplier},

    // ========== EFFECTS - SCALE ==========
    scaleMin: ${profile.scaleMin},
    scaleRange: ${profile.scaleRange},

    // ========== EFFECTS - TRAILS ==========
    trailDecay: ${profile.trailDecay},

    // ========== EFFECTS - INVERSION ==========
    inversionBassThreshold: ${profile.inversionBassThreshold},
    inversionDurationMs: ${profile.inversionDurationMs},
    inversionCooldownMs: ${profile.inversionCooldownMs},
    inversionWhiteDimFactor: ${profile.inversionWhiteDimFactor},

    // ========== EFFECTS - HUE SHIFT ==========
    hueShiftMultiplier: ${profile.hueShiftMultiplier}
  },`;

		showProfileCode = true;
	}

	function loadProfileSettings(profileId: string) {
		// Get profile from custom profiles OR built-in profiles
		let profile = customProfiles[profileId];

		if (!profile) {
			// Try to get from built-in profiles
			const builtInProfile = getProfileConfig(profileId);
			profile = builtInProfile;
		}

		if (!profile) return;

		console.log('Loading profile:', profileId);
		console.log('Profile data:', profile);

		bassSmoothing = profile.bassSmoothing ?? 0.7;
		bassPower = profile.bassPower ?? 3.0;
		scaleMin = profile.scaleMin ?? 0.15;
		scaleRange = profile.scaleRange ?? 0.8;
		inversionWhiteDimFactor = profile.inversionWhiteDimFactor ?? 0.75;

		// Load intensity multipliers (defaults to 1.0 for built-in profiles)
		rotationIntensity = profile.rotationIntensity ?? 1.0;
		scaleIntensity = profile.scaleIntensity ?? 1.0;
		distortionIntensity = profile.distortionIntensity ?? 1.0;
		hueShiftIntensity = profile.hueShiftIntensity ?? 1.0;
		trailIntensity = profile.trailIntensity ?? 1.0;

		// Load effect toggles (defaults to true for built-in profiles)
		enableRotation = profile.enableRotation ?? true;
		enableScale = profile.enableScale ?? true;
		enableDistortion = profile.enableDistortion ?? true;
		enableHueShift = profile.enableHueShift ?? true;
		enableInversion = profile.enableInversion ?? true;
		enableTrails = profile.enableTrails ?? true;

		console.log('Loaded intensities:', {
			rotationIntensity,
			scaleIntensity,
			distortionIntensity,
			hueShiftIntensity,
			trailIntensity
		});

		// Show notification
		profileLoadNotification = `Loaded: ${profile.name || profileId}`;
		setTimeout(() => {
			profileLoadNotification = '';
		}, 2000);
	}

	// Watch for profile changes and load settings (for ALL profiles now)
	// Track the last loaded profile to avoid re-running on every state change
	let lastLoadedProfile = $state<string | null>(null);
	$effect(() => {
		if (selectedProfile && selectedProfile !== lastLoadedProfile) {
			loadProfileSettings(selectedProfile);
			lastLoadedProfile = selectedProfile;
		}
	});

	async function togglePlayback() {
		if (!audioElement) return;

		if (isPlaying) {
			// Pause
			audioElement.pause();
			audioVisualizer?.stop();
			isPlaying = false;
		} else {
			// Play
			try {
				await audioElement.play();
				audioVisualizer?.start();
				isPlaying = true;
			} catch (err) {
				console.error('Failed to play audio:', err);
			}
		}
	}

	// Update isPlaying state when audio element changes
	$effect(() => {
		if (audioElement) {
			const updatePlayState = () => {
				isPlaying = !audioElement!.paused;
			};
			audioElement.addEventListener('play', updatePlayState);
			audioElement.addEventListener('pause', updatePlayState);
			audioElement.addEventListener('ended', updatePlayState);

			return () => {
				audioElement!.removeEventListener('play', updatePlayState);
				audioElement!.removeEventListener('pause', updatePlayState);
				audioElement!.removeEventListener('ended', updatePlayState);
			};
		}
	});
</script>

<div class="container mx-auto p-6 space-y-6 max-w-4xl">
	<div class="card space-y-4">
		<h1 class="text-2xl font-bold text-white">Profile Comparison Test</h1>
		<p class="text-gray-400">
			Record browser output to compare with server-rendered videos.
		</p>
	</div>

	<!-- Song Selection -->
	<div class="card space-y-4">
		<div class="flex items-center justify-between">
			<div class="flex-1">
				<h2 class="text-lg font-semibold text-white">Audio Source</h2>
				{#if uploadedFile}
					<div class="flex items-center gap-3 mt-2">
						<div class="w-12 h-12 bg-green-600 rounded flex items-center justify-center flex-shrink-0">
							<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
								<path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
							</svg>
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-white font-semibold truncate">{uploadedFile.name}</p>
							<p class="text-gray-400 text-sm">Uploaded file ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)</p>
						</div>
						<button
							onclick={clearUploadedFile}
							class="text-red-400 hover:text-red-300 text-sm px-2 py-1"
						>
							Clear
						</button>
					</div>
				{:else if selectedSong}
					<div class="flex items-center gap-3 mt-2">
						<img src={selectedSong.artworkUrl100} alt={selectedSong.trackName} class="w-12 h-12 rounded" />
						<div>
							<p class="text-white font-semibold">{selectedSong.trackName}</p>
							<p class="text-gray-400 text-sm">{selectedSong.artistName}</p>
						</div>
					</div>
				{:else}
					<p class="text-gray-400 text-sm mt-1">Using default test song (30s)</p>
				{/if}
			</div>
			<div class="flex gap-2">
				<label class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors cursor-pointer">
					📁 Upload File
					<input
						type="file"
						accept="audio/*"
						onchange={handleFileUpload}
						class="hidden"
					/>
				</label>
				<button
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
					onclick={() => (showSearch = !showSearch)}
				>
					{showSearch ? 'Hide' : 'Search'}
				</button>
			</div>
		</div>

		{#if showSearch}
			<div class="space-y-4 border-t border-gray-700 pt-4">
				<div class="flex gap-3">
					<input
						type="text"
						bind:value={searchQuery}
						onkeydown={handleKeydown}
						placeholder="Search for a song..."
						class="input flex-1"
					/>
					<button
						onclick={searchSongs}
						disabled={searching || !searchQuery.trim()}
						class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{searching ? 'Searching...' : 'Search'}
					</button>
				</div>

				{#if searchError}
					<p class="text-red-400">{searchError}</p>
				{/if}

				{#if searchResults.length > 0}
					<div class="space-y-2 max-h-96 overflow-y-auto">
						{#each searchResults as song (song.trackId)}
							<button
								onclick={() => selectSong(song)}
								class="w-full card-hover flex items-center gap-3 text-left"
							>
								<img src={song.artworkUrl100} alt={song.trackName} class="w-12 h-12 rounded flex-shrink-0" />
								<div class="flex-1 min-w-0">
									<h3 class="font-semibold text-white truncate">{song.trackName}</h3>
									<p class="text-sm text-gray-400 truncate">{song.artistName}</p>
									<p class="text-xs text-gray-500 truncate">{song.collectionName}</p>
								</div>
								<svg
									class="w-6 h-6 text-white flex-shrink-0"
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
				{/if}
			</div>
		{/if}
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

			<!-- Inversion Parameters -->
			<div class="card space-y-3 bg-pink-900/20 border-pink-700">
				<div class="text-pink-300 font-semibold text-sm">Inversion Tuning:</div>
				<div class="space-y-3">
					<div>
						<label class="text-pink-200 text-xs">White Dim: {inversionWhiteDimFactor.toFixed(2)}</label>
						<input type="range" bind:value={inversionWhiteDimFactor} min="0.0" max="1.0" step="0.05" class="w-full" />
						<p class="text-pink-300/60 text-xs mt-1">0.0=black, 0.5=dim, 1.0=no dimming</p>
					</div>
				</div>
			</div>

			<!-- Advanced Scale Parameters -->
			<div class="card space-y-3 bg-yellow-900/20 border-yellow-700">
				<div class="flex items-center justify-between">
					<div class="text-yellow-300 font-semibold text-sm">Scale Tuning:</div>
					<button
						onclick={resetToDefaults}
						class="text-xs px-2 py-1 bg-yellow-700 hover:bg-yellow-600 text-white rounded transition-colors"
					>
						Reset All
					</button>
				</div>
				<div class="space-y-3">
					<div>
						<label class="text-yellow-200 text-xs">Bass Smoothing: {bassSmoothing.toFixed(2)}</label>
						<input type="range" bind:value={bassSmoothing} min="0" max="0.95" step="0.05" class="w-full" />
						<p class="text-yellow-300/60 text-xs mt-1">Higher = slower response</p>
					</div>
					<div>
						<label class="text-yellow-200 text-xs">Bass Power: {bassPower.toFixed(1)}</label>
						<input type="range" bind:value={bassPower} min="1.0" max="5.0" step="0.1" class="w-full" />
						<p class="text-yellow-300/60 text-xs mt-1">Higher = more extreme</p>
					</div>
					<div>
						<label class="text-yellow-200 text-xs">Scale Min: {scaleMin.toFixed(2)}</label>
						<input type="range" bind:value={scaleMin} min="0.05" max="0.5" step="0.05" class="w-full" />
						<p class="text-yellow-300/60 text-xs mt-1">Base zoom level</p>
					</div>
					<div>
						<label class="text-yellow-200 text-xs">Scale Range: {scaleRange.toFixed(2)}</label>
						<input type="range" bind:value={scaleRange} min="0.1" max="1.5" step="0.05" class="w-full" />
						<p class="text-yellow-300/60 text-xs mt-1">Max zoom variation</p>
					</div>
				</div>
				<button
					onclick={logCurrentValues}
					class="w-full text-xs px-3 py-2 bg-yellow-800 hover:bg-yellow-700 text-yellow-100 rounded transition-colors"
				>
					Log Values to Console
				</button>
			</div>
		</div>

		<!-- Right: Visualizer with Profile Switcher -->
		<div class="lg:col-span-3 space-y-6">
			<!-- Playback Control -->
			<div class="card">
				<div class="flex gap-3 items-center justify-center">
					<button
						onclick={togglePlayback}
						class="px-8 py-4 rounded-lg font-bold text-lg transition-colors {isPlaying
							? 'bg-red-600 hover:bg-red-700 text-white'
							: 'bg-green-600 hover:bg-green-700 text-white'}"
					>
						{isPlaying ? '⏸ Pause' : '▶ Play'}
					</button>
				</div>
			</div>

			<!-- Profile Load Notification -->
			{#if profileLoadNotification}
				<div class="card bg-green-900/50 border-green-600 text-center">
					<p class="text-green-200 font-semibold">{profileLoadNotification}</p>
				</div>
			{/if}

			<!-- Profile Switcher -->
			<div class="card space-y-3">
				<div class="flex gap-2 justify-center flex-wrap">
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
					{#each Object.entries(customProfiles) as [profileId, profile]}
						<button
							class="px-6 py-3 rounded-lg font-semibold transition-colors {selectedProfile === profileId
								? 'bg-green-600 text-white'
								: 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
							onclick={() => (selectedProfile = profileId)}
						>
							{profile.name}
						</button>
					{/each}
				</div>
				<div class="flex gap-2 justify-center">
					<button
						onclick={() => (showSaveProfile = true)}
						class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors text-sm"
					>
						💾 Save as New Profile
					</button>
					{#if selectedProfile && customProfiles[selectedProfile]}
						<button
							onclick={generateProfileCode}
							class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors text-sm"
						>
							📋 Export to profiles.js
						</button>
					{/if}
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
						{bassSmoothing}
						{bassPower}
						{scaleMin}
						{scaleRange}
						{inversionWhiteDimFactor}
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

	<!-- Recording Section (Optional) -->
	<div class="card space-y-4 bg-purple-900/20 border-purple-700">
		<h3 class="text-lg font-semibold text-purple-300">Recording (Optional)</h3>
		<p class="text-purple-200/70 text-sm">
			Record the browser output to compare with server-rendered videos. Note: This will auto-download the video file.
		</p>

		<div class="flex gap-3">
			<button
				class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={startTest}
				disabled={recordingTimer !== null}
			>
				🔴 Start Recording (30s)
			</button>

			<button
				class="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={stopTest}
				disabled={recordingTimer === null}
			>
				⏹ Stop Recording
			</button>
		</div>

		{#if recordingTimer !== null}
			<div class="text-purple-300 font-mono text-xl bg-purple-950 px-4 py-3 rounded-lg border border-purple-500">
				Recording: {recordingDuration}s / 30s
			</div>
		{/if}
	</div>

	<!-- Instructions -->
	<div class="card space-y-3 bg-blue-900/20 border-blue-700">
		<h2 class="text-lg font-semibold text-blue-300">How to use:</h2>
		<ol class="text-blue-200 space-y-2 list-decimal list-inside">
			<li><strong>Choose audio:</strong> Upload your own file (any length), search iTunes (30s previews), or use default</li>
			<li>Click <strong>"▶ Play"</strong> to preview the visualizer with audio</li>
			<li>Adjust sliders in real-time to tune the visual effects</li>
			<li>Switch between profiles to compare behaviors</li>
			<li><strong>Save profiles:</strong> Click "💾 Save as New Profile" to save your current settings</li>
			<li><strong>Export:</strong> Click "📋 Export to profiles.js" to get code for permanent profiles</li>
			<li><strong>Optional:</strong> Click "🔴 Start Recording" to capture video for comparison</li>
		</ol>
	</div>

	<!-- Save Profile Modal -->
	{#if showSaveProfile}
		<div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onclick={() => (showSaveProfile = false)}>
			<div class="card max-w-md w-full m-4" onclick={(e) => e.stopPropagation()}>
				<h3 class="text-xl font-bold text-white mb-4">Save as New Profile</h3>
				<div class="space-y-4">
					<div>
						<label class="block text-white text-sm mb-2">Profile Name:</label>
						<input
							type="text"
							bind:value={newProfileName}
							placeholder="e.g., Heavy Bass, Smooth Motion"
							class="input w-full"
							onkeydown={(e) => e.key === 'Enter' && saveAsProfile()}
						/>
					</div>
					<div class="text-gray-400 text-sm">
						Current settings will be saved to this profile.
					</div>
					<div class="flex gap-3">
						<button
							onclick={saveAsProfile}
							class="btn-primary flex-1"
						>
							Save Profile
						</button>
						<button
							onclick={() => (showSaveProfile = false)}
							class="btn-secondary flex-1"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Export Code Modal -->
	{#if showProfileCode}
		<div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onclick={() => (showProfileCode = false)}>
			<div class="card max-w-3xl w-full max-h-[80vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
				<h3 class="text-xl font-bold text-white mb-4">Export to profiles.js</h3>
				<div class="space-y-4">
					<div class="text-gray-300 text-sm">
						Copy this code and add it to <code class="bg-gray-800 px-2 py-1 rounded">src/lib/profiles.js</code> inside the PROFILES object:
					</div>
					<pre class="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-300"><code>{generatedProfileCode}</code></pre>
					<div class="flex gap-3">
						<button
							onclick={() => {
								navigator.clipboard.writeText(generatedProfileCode);
								alert('Code copied to clipboard!');
							}}
							class="btn-primary flex-1"
						>
							📋 Copy to Clipboard
						</button>
						<button
							onclick={() => (showProfileCode = false)}
							class="btn-secondary flex-1"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

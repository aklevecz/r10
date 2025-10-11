<script lang="ts">
	interface Props {
		canvas: HTMLCanvasElement | null;
		audioUrl: string;
		isPlaying: boolean;
		onRecordingComplete?: (videoBlob: Blob) => void;
	}

	let { canvas, audioUrl, isPlaying, onRecordingComplete }: Props = $props();

	let isRecording = $state(false);
	let recorder = $state<MediaRecorder | null>(null);
	let recordedChunks = $state<Blob[]>([]);
	let error = $state<string | null>(null);

	function startRecording() {
		if (!canvas) {
			error = 'Canvas not available';
			return;
		}

		try {
			// Capture canvas stream
			const stream = canvas.captureStream(30); // 30 fps

			// Create MediaRecorder
			const options = {
				mimeType: 'video/webm;codecs=vp9',
				videoBitsPerSecond: 2500000 // 2.5 Mbps
			};

			// Fallback to vp8 if vp9 not supported
			if (!MediaRecorder.isTypeSupported(options.mimeType)) {
				options.mimeType = 'video/webm;codecs=vp8';
			}

			recorder = new MediaRecorder(stream, options);
			recordedChunks = [];

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					recordedChunks.push(event.data);
				}
			};

			recorder.onstop = () => {
				const blob = new Blob(recordedChunks, { type: 'video/webm' });
				if (onRecordingComplete) {
					onRecordingComplete(blob);
				}
				isRecording = false;
			};

			recorder.onerror = (event) => {
				console.error('MediaRecorder error:', event);
				error = 'Recording failed';
				isRecording = false;
			};

			recorder.start(100); // Collect data every 100ms
			isRecording = true;
			error = null;
			console.log('Recording started');
		} catch (err) {
			console.error('Failed to start recording:', err);
			error = 'Failed to start recording';
		}
	}

	function stopRecording() {
		if (recorder && recorder.state !== 'inactive') {
			recorder.stop();
			console.log('Recording stopped');
		}
	}

	// Auto-start when audio starts playing
	$effect(() => {
		if (isPlaying && !isRecording && canvas) {
			startRecording();
		}
	});

	// Auto-stop when audio stops playing
	$effect(() => {
		if (!isPlaying && isRecording) {
			stopRecording();
		}
	});
</script>

<div class="space-y-4">
	{#if error}
		<div class="card bg-red-900/20 border-red-700">
			<p class="text-red-400 text-sm">{error}</p>
		</div>
	{/if}

	{#if isRecording}
		<div class="card bg-red-900/20 border-red-700">
			<p class="text-red-400 text-sm flex items-center gap-2">
				<span class="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
				Recording video...
			</p>
		</div>
	{/if}
</div>

<script lang="ts">
	interface Props {
		canvas: HTMLCanvasElement | null;
		onRecordingComplete?: (videoBlob: Blob) => void;
	}

	let { canvas, onRecordingComplete }: Props = $props();

	let recorder: MediaRecorder | null = null;
	let recordedChunks: Blob[] = [];
	let error = $state<string | null>(null);
	let isRecording = $state(false);

	export function startRecording() {
		if (!canvas || isRecording) {
			return;
		}

		try {
			const stream = canvas.captureStream(60); // 60 fps
			const options = {
				mimeType: 'video/webm;codecs=vp9',
				videoBitsPerSecond: 8000000 // 8 Mbps for higher quality
			};

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
				isRecording = false;
				if (onRecordingComplete) {
					onRecordingComplete(blob);
				}
				recorder = null;
			};

			recorder.onerror = (event) => {
				console.error('MediaRecorder error:', event);
				error = 'Recording failed';
				isRecording = false;
				recorder = null;
			};

			recorder.start(100);
			isRecording = true;
			error = null;
			console.log('Recording started');
		} catch (err) {
			console.error('Failed to start recording:', err);
			error = 'Failed to start recording';
		}
	}

	export function stopRecording() {
		if (recorder && recorder.state !== 'inactive') {
			recorder.stop();
			console.log('Recording stopped');
		}
	}
</script>

<div class="space-y-4">
	{#if error}
		<div class="card bg-red-900/20 border-red-700">
			<p class="text-red-400 text-sm">{error}</p>
		</div>
	{/if}

	{#if isRecording}
		<div class="card border-red-600 bg-red-900 animate-pulse">
			<p class="text-white text-2xl flex items-center justify-center gap-3 py-4 font-bold" style="font-family: monospace;">
				<span class="inline-block w-5 h-5 bg-red-500 animate-pulse"></span>
				recording
			</p>
		</div>
	{/if}
</div>

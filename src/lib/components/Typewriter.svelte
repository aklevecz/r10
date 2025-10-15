<script lang="ts">
	interface Props {
		text: string;
		speed?: number;
		onComplete?: () => void;
	}

	let { text, speed = 100, onComplete }: Props = $props();

	let displayText = $state('');
	let currentIndex = $state(0);
	let isComplete = $state(false);

	$effect(() => {
		if (currentIndex < text.length) {
			const timeout = setTimeout(() => {
				displayText += text[currentIndex];
				currentIndex++;

				if (currentIndex === text.length) {
					isComplete = true;
					if (onComplete) {
						onComplete();
					}
				}
			}, speed);

			return () => clearTimeout(timeout);
		}
	});
</script>

<span>{displayText}{#if !isComplete}<span class="animate-pulse">|</span>{/if}</span>

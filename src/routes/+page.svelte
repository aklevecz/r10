<script lang="ts">
	import { SongSearch } from '$lib';
</script>

<div class="min-h-screen flex flex-col items-center justify-center p-8 gap-12 bg-black">
	<div class="max-w-2xl w-full flex flex-col items-center gap-8">
		<img
			src="/raptor-svg.svg"
			alt="R10 Raptor Logo"
			class="w-64 h-auto drop-shadow-2xl animate-[float_3s_ease-in-out_infinite] brightness-0 invert"
		/>
		<img
			src="/r10.svg"
			alt="R10"
			class="w-full max-w-lg h-auto"
		/>
	</div>

	<SongSearch />
</div>

<style>
	@keyframes float {
		0%,
		100% {
			transform: translateY(0px);
		}
		50% {
			transform: translateY(-10px);
		}
	}
</style>

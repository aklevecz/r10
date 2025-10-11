<script lang="ts">
	import { SongSearch } from '$lib';
</script>

<div class="min-h-screen flex flex-col items-center justify-center p-8 gap-12">
	<div class="max-w-md w-full">
		<img
			src="/raptor-green.png"
			alt="R10 Raptor Logo"
			class="w-full h-auto drop-shadow-2xl animate-[float_3s_ease-in-out_infinite]"
		/>
		<h1 class="text-4xl font-bold text-center mt-8 text-white drop-shadow-lg">R10 RSVP</h1>
		<p class="text-center mt-4 text-white/90">Your event awaits</p>
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

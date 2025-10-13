<script lang="ts">
	import { SongSearch } from '$lib';

	let isSearching = $state(false);
</script>

<div class="min-h-screen flex flex-col items-center p-8 bg-black" class:justify-center={!isSearching} class:justify-start={isSearching} class:pt-4={isSearching}>
	<div class="w-full flex flex-col items-center transition-all duration-500"
		 class:gap-8={!isSearching}
		 class:gap-2={isSearching}
		 class:max-w-2xl={!isSearching}
		 class:max-w-sm={isSearching}>
		<img
			src="/raptor-svg.svg"
			alt="R10 Raptor Logo"
			class="drop-shadow-2xl animate-[float_3s_ease-in-out_infinite] brightness-0 invert transition-all duration-500"
			class:w-64={!isSearching}
			class:w-20={isSearching}
		/>
		<img
			src="/r10.svg"
			alt="R10"
			class="w-full h-auto transition-all duration-500"
			class:max-w-lg={!isSearching}
			class:max-w-[120px]={isSearching}
			class:opacity-100={!isSearching}
			class:opacity-40={isSearching}
		/>
	</div>

	<div class="w-full max-w-2xl" class:mt-12={!isSearching} class:mt-6={isSearching}>
		<SongSearch bind:isSearching />
	</div>
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

	@keyframes slideUp {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
</style>

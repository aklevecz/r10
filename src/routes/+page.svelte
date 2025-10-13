<script lang="ts">
	import { SongSearch } from '$lib';

	let isSearching = $state(false);
</script>

<div class="min-h-screen flex flex-col items-center p-4 bg-black justify-start pt-8">
	<div class="hero-container-imgs w-full flex items-center transition-all duration-500"
		 class:flex-col={!isSearching}
		 class:flex-row={isSearching}
		 class:gap-4={!isSearching}
		 class:gap-3={isSearching}
		 class:max-w-2xl={!isSearching}
		 class:max-w-sm={isSearching}>
		<img
			src="/raptor-svg.svg"
			alt="R10 Raptor Logo"
			class="drop-shadow-2xl animate-[float_3s_ease-in-out_infinite] brightness-0 invert transition-all duration-500"
			class:w-48={!isSearching}
			class:w-16={isSearching}
		/>
		<img
			src="/r10.svg"
			alt="R10"
			class="h-auto transition-all duration-500"
			class:w-56={!isSearching}
			class:w-[100px]={isSearching}
			class:opacity-100={!isSearching}
			class:opacity-40={isSearching}
		/>
	</div>

	<div class="w-full max-w-2xl" class:mt-8={!isSearching} class:mt-4={isSearching}>
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

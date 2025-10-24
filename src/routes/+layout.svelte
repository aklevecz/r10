<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>r10</title>
	<meta name="description" content="r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10" />
	<meta name="keywords" content="r10" />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:title" content="r10" />
	<meta property="og:description" content="r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10" />
	<meta property="og:image" content="/r10-preview.gif" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="r10" />
	<meta name="twitter:description" content="r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10 r10" />
	<meta name="twitter:image" content="/r10-preview.gif" />

	<!-- Favicon -->
	<link rel="icon" type="image/svg+xml" href="/raptor-svg.svg" />
	<link rel="apple-touch-icon" href="/raptor-svg.svg" />
</svelte:head>

{@render children?.()}

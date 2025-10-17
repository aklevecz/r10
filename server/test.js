// test-local.js
// Quick test script to verify the renderer works locally

import { handler } from './r10-server-renderer.js';

async function test() {
  console.log('🧪 Testing R10 Server Renderer\n');

  const testEvent = {
    input: {
      // Use a short test audio file or provide your own
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      distortionType: 4, // Glitch effect
      trailHue: 330, // Hot pink
      trailSat: 100,
      trailLight: 65,
      svgUrl: 'http://localhost:3000/raptor-svg.svg' // Update this to your SVG location
    }
  };

  console.log('📥 Input parameters:');
  console.log(JSON.stringify(testEvent.input, null, 2));
  console.log('\n⏳ Starting render...\n');

  const startTime = Date.now();

  try {
    const result = await handler(testEvent);
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    if (result.status === 'success') {
      console.log(`\n✅ SUCCESS! Rendered in ${duration}s`);
      console.log(`📦 Video size: ${(result.video.length / 1024 / 1024).toFixed(2)} MB (base64)`);
      console.log(`💾 Saved to: /tmp/output.mp4`);
      
      // Optionally save to a file
      const fs = await import('fs/promises');
      const videoBuffer = Buffer.from(result.video, 'base64');
      await fs.writeFile('./test-output.mp4', videoBuffer);
      console.log(`💾 Also saved to: ./test-output.mp4`);
    } else {
      console.error('\n❌ FAILED:');
      console.error(result.message || result.error);
    }
  } catch (error) {
    console.error('\n💥 ERROR:');
    console.error(error);
  }
}

test();

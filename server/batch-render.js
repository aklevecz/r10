import { handler } from './renderer.js';
import fs from 'fs/promises';

const AUDIO_URL = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/41/b7/60/41b7606a-aaed-7cc9-df98-32a2805955bf/mzaf_2710489029233836718.plus.aac.p.m4a";

// Different visual configurations
const configs = [
  { name: 'hot-pink-glitch', distortionType: 4, trailHue: 330, trailSat: 100, trailLight: 65 },
  { name: 'electric-blue-glitch', distortionType: 4, trailHue: 200, trailSat: 100, trailLight: 55 },
  { name: 'neon-green-glitch', distortionType: 4, trailHue: 120, trailSat: 100, trailLight: 45 },
  { name: 'cyber-yellow-glitch', distortionType: 4, trailHue: 55, trailSat: 100, trailLight: 70 },
  { name: 'toxic-purple-glitch', distortionType: 4, trailHue: 275, trailSat: 100, trailLight: 55 },
  { name: 'coral-glitch', distortionType: 4, trailHue: 15, trailSat: 100, trailLight: 65 },
  { name: 'hot-pink-wave-h', distortionType: 0, trailHue: 330, trailSat: 100, trailLight: 65 },
  { name: 'electric-blue-wave-v', distortionType: 1, trailHue: 200, trailSat: 100, trailLight: 55 },
  { name: 'neon-green-ripple', distortionType: 2, trailHue: 120, trailSat: 100, trailLight: 45 },
  { name: 'cyber-yellow-diagonal', distortionType: 3, trailHue: 55, trailSat: 100, trailLight: 70 },
];

async function batchRender() {
  console.log(`🎬 Starting batch render of ${configs.length} variations...\n`);

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${i + 1}/${configs.length}] Rendering: ${config.name}`);
    console.log(`  Distortion: ${config.distortionType}, Color: H${config.trailHue} S${config.trailSat} L${config.trailLight}`);
    console.log('='.repeat(60));

    try {
      const event = {
        input: {
          audioUrl: AUDIO_URL,
          distortionType: config.distortionType,
          trailHue: config.trailHue,
          trailSat: config.trailSat,
          trailLight: config.trailLight,
          pngUrl: 'raptor-bw.png'
        }
      };

      const result = await handler(event);

      if (result.status === 'success') {
        // The video is already saved to test-output.mp4, rename it
        const outputFilename = `output-${config.name}.mp4`;
        await fs.rename('test-output.mp4', outputFilename);
        console.log(`✅ Saved: ${outputFilename}`);
      } else {
        console.error(`❌ Failed: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error(`❌ Exception: ${error.message}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('🎉 Batch render complete!');
  console.log('='.repeat(60));

  // List all output files
  const files = await fs.readdir('.');
  const outputFiles = files.filter(f => f.startsWith('output-') && f.endsWith('.mp4'));
  console.log(`\nGenerated ${outputFiles.length} videos:`);
  for (const file of outputFiles) {
    const stat = await fs.stat(file);
    console.log(`  - ${file} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

batchRender().catch(console.error);

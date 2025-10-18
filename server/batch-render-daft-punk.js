import { handler } from './renderer.js';
import fs from 'fs/promises';

// Daft Punk songs with different visual styles
const configs = [
  {
    name: 'one-more-time-pink-glitch',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/98/96/f6/9896f638-8b47-3f76-c47e-19e43b53677c/mzaf_6217050205652773485.plus.aac.ep.m4a',
    distortionType: 4,
    trailHue: 330,
    trailSat: 100,
    trailLight: 65
  },
  {
    name: 'one-more-time-blue-glitch',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/98/96/f6/9896f638-8b47-3f76-c47e-19e43b53677c/mzaf_6217050205652773485.plus.aac.ep.m4a',
    distortionType: 4,
    trailHue: 200,
    trailSat: 100,
    trailLight: 55
  },
  {
    name: 'harder-better-faster-stronger-yellow-glitch',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/bf/a6/1b/bfa61b15-a797-ec2d-ef44-bf9bfb9fab10/mzaf_13314639106811665209.plus.aac.ep.m4a',
    distortionType: 4,
    trailHue: 55,
    trailSat: 100,
    trailLight: 70
  },
  {
    name: 'harder-better-faster-stronger-green-glitch',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/bf/a6/1b/bfa61b15-a797-ec2d-ef44-bf9bfb9fab10/mzaf_13314639106811665209.plus.aac.ep.m4a',
    distortionType: 4,
    trailHue: 120,
    trailSat: 100,
    trailLight: 45
  },
  {
    name: 'digital-love-purple-glitch',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/9a/10/16/9a101659-7e2b-2af5-47ca-2399aa11d41d/mzaf_18162225229911171861.plus.aac.ep.m4a',
    distortionType: 4,
    trailHue: 275,
    trailSat: 100,
    trailLight: 55
  },
  {
    name: 'digital-love-coral-ripple',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/9a/10/16/9a101659-7e2b-2af5-47ca-2399aa11d41d/mzaf_18162225229911171861.plus.aac.ep.m4a',
    distortionType: 2,
    trailHue: 15,
    trailSat: 100,
    trailLight: 65
  },
  {
    name: 'give-life-back-to-music-pink-glitch',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/ce/15/b1/ce15b154-2b27-9d65-4d12-7736f3e029c2/mzaf_8988960148658169688.plus.aac.ep.m4a',
    distortionType: 4,
    trailHue: 330,
    trailSat: 100,
    trailLight: 65
  },
  {
    name: 'giorgio-by-moroder-blue-glitch',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/88/e4/40/88e440e7-8baa-6cc0-acbe-ceaa7f240a51/mzaf_9222027355363278227.plus.aac.ep.m4a',
    distortionType: 4,
    trailHue: 200,
    trailSat: 100,
    trailLight: 55
  },
];

async function batchRender() {
  console.log(`🎬 Starting Daft Punk batch render (${configs.length} variations)...\n`);

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${i + 1}/${configs.length}] Rendering: ${config.name}`);
    console.log(`  Distortion: ${config.distortionType}, Color: H${config.trailHue} S${config.trailSat} L${config.trailLight}`);
    console.log('='.repeat(60));

    try {
      const event = {
        input: {
          audioUrl: config.audioUrl,
          distortionType: config.distortionType,
          trailHue: config.trailHue,
          trailSat: config.trailSat,
          trailLight: config.trailLight,
          pngUrl: 'raptor-bw.png'
        }
      };

      const result = await handler(event);

      if (result.status === 'success') {
        const outputFilename = `daft-punk-${config.name}.mp4`;
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
  console.log('🎉 Daft Punk batch render complete!');
  console.log('='.repeat(60));

  // List all output files
  const files = await fs.readdir('.');
  const outputFiles = files.filter(f => f.startsWith('daft-punk-') && f.endsWith('.mp4'));
  console.log(`\nGenerated ${outputFiles.length} videos:`);
  for (const file of outputFiles) {
    const stat = await fs.stat(file);
    console.log(`  - ${file} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

batchRender().catch(console.error);

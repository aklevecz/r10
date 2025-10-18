import fs from 'fs/promises';

const ENDPOINT_ID = 'ykz7oo7h4tfh96';
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';

async function submitJob(params) {
  const url = `https://api.runpod.ai/v2/${ENDPOINT_ID}/run`;

  console.log('Submitting job to RunPod...');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'authorization': RUNPOD_API_KEY,
      'content-type': 'application/json',
      'accept': 'application/json'
    },
    body: JSON.stringify({ input: params })
  });

  const result = await response.json();
  console.log('Job submitted:', result);
  return result;
}

async function checkStatus(jobId) {
  const url = `https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`;

  const response = await fetch(url, {
    headers: {
      'authorization': RUNPOD_API_KEY
    }
  });

  const result = await response.json();
  return result;
}

async function pollUntilComplete(jobId, maxWaitMinutes = 10) {
  const startTime = Date.now();
  const maxWaitMs = maxWaitMinutes * 60 * 1000;

  console.log(`\nPolling for job ${jobId}...`);

  while (true) {
    const elapsed = Date.now() - startTime;

    if (elapsed > maxWaitMs) {
      throw new Error(`Job timed out after ${maxWaitMinutes} minutes`);
    }

    const status = await checkStatus(jobId);
    const elapsedSec = (elapsed / 1000).toFixed(1);

    console.log(`[${elapsedSec}s] Status: ${status.status}`);

    if (status.status === 'COMPLETED') {
      console.log('\n✅ Job completed!');
      return status;
    }

    if (status.status === 'FAILED') {
      console.log('\n❌ Job failed!');
      console.log('Error:', status.error);
      throw new Error(status.error || 'Job failed');
    }

    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

async function testRunPodEndpoint() {
  console.log('Testing RunPod Serverless Endpoint');
  console.log('===================================\n');

  const params = {
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/ee/22/1a/ee221ab0-02dd-7290-47e7-383ad9c81e3b/mzaf_912969547193259322.plus.aac.p.m4a',
    distortionType: 4,
    trailHue: 330,
    trailSat: 100,
    trailLight: 65,
    pngUrl: 'raptor-bw.png'
  };

  console.log('Parameters:');
  console.log(JSON.stringify(params, null, 2));
  console.log('');

  try {
    // Submit job
    const job = await submitJob(params);

    if (!job.id) {
      throw new Error('No job ID returned: ' + JSON.stringify(job));
    }

    // Poll until complete
    const result = await pollUntilComplete(job.id);

    // Display results
    console.log('\nExecution time:', result.executionTime, 'ms');
    console.log('Delay time:', result.delayTime, 'ms');
    console.log('\nOutput:', JSON.stringify(result.output, null, 2));

    if (result.output?.video_url) {
      console.log('\n📹 Video URL:', result.output.video_url);

      // Download video
      console.log('\nDownloading video...');
      const videoResponse = await fetch(result.output.video_url);

      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      const outputPath = './runpod-test-output.mp4';
      await fs.writeFile(outputPath, Buffer.from(videoBuffer));

      const sizeMB = (videoBuffer.byteLength / 1024 / 1024).toFixed(2);
      console.log(`✅ Video downloaded: ${outputPath} (${sizeMB} MB)`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testRunPodEndpoint();

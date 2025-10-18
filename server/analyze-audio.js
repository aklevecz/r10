import { spawn } from 'child_process';
import fs from 'fs/promises';
import FFT from 'fft.js';

const AUDIO_URL = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/41/b7/60/41b7606a-aaed-7cc9-df98-32a2805955bf/mzaf_2710489029233836718.plus.aac.p.m4a";

class AudioAnalyzer {
  constructor(audioPath) {
    this.audioPath = audioPath;
    this.sampleRate = 44100;
    this.fftSize = 256;
    this.frequencyBinCount = this.fftSize / 2;
  }

  async getAudioDuration() {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        this.audioPath
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          resolve(parseFloat(output.trim()));
        } else {
          reject(new Error(`FFprobe failed with code ${code}`));
        }
      });
    });
  }

  async extractPCM(outputPath) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', this.audioPath,
        '-f', 'f32le',
        '-acodec', 'pcm_f32le',
        '-ar', String(this.sampleRate),
        '-ac', '1',
        '-y',
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg failed with code ${code}`));
      });
    });
  }

  performFFT(samples) {
    const fft = new FFT(this.fftSize);
    const out = fft.createComplexArray();
    const input = fft.toComplexArray(samples, null);
    fft.transform(out, input);

    const frequencyData = new Uint8Array(this.frequencyBinCount);

    for (let i = 0; i < this.frequencyBinCount; i++) {
      const real = out[i * 2];
      const imag = out[i * 2 + 1];
      const magnitude = Math.sqrt(real * real + imag * imag) / this.fftSize;
      frequencyData[i] = Math.min(255, Math.floor(magnitude * 255 * 15));
    }

    return frequencyData;
  }

  analyzeFrequencyBands(data) {
    let bassSum = 0;
    let midSum = 0;
    let highSum = 0;

    for (let i = 0; i < 4; i++) bassSum += data[i];
    for (let i = 4; i < 16; i++) midSum += data[i];
    for (let i = 16; i < 64; i++) highSum += data[i];

    let bass = bassSum / 4 / 255;
    let mid = midSum / 12 / 255;
    let high = highSum / 48 / 255;

    bass = Math.pow(bass, 3.0);
    mid = Math.pow(mid, 1.5);
    high = Math.pow(high, 1.5);

    return { bass, mid, high };
  }

  async analyze() {
    const duration = await this.getAudioDuration();
    const pcmPath = '/tmp/audio.pcm';
    await this.extractPCM(pcmPath);

    const pcmData = await fs.readFile(pcmPath);
    const samples = new Float32Array(pcmData.buffer);

    const fps = 30;
    const totalFrames = Math.floor(duration * fps);
    const samplesPerFrame = Math.floor(this.sampleRate / fps);

    const frameData = [];

    for (let frame = 0; frame < totalFrames; frame++) {
      const startSample = frame * samplesPerFrame;
      const frameSamples = samples.slice(startSample, startSample + this.fftSize);

      if (frameSamples.length < this.fftSize) {
        const padded = new Float32Array(this.fftSize);
        padded.set(frameSamples);
        frameData.push(this.performFFT(padded));
      } else {
        frameData.push(this.performFFT(frameSamples));
      }
    }

    return { frameData, totalFrames, duration, fps };
  }
}

async function analyzeAudio() {
  console.log('📊 Audio Analysis Tool\n');
  console.log('Downloading and analyzing audio...');

  // Download audio
  const audioPath = '/tmp/input_audio.mp3';
  const response = await fetch(AUDIO_URL);
  const buffer = await response.arrayBuffer();
  await fs.writeFile(audioPath, Buffer.from(buffer));

  const analyzer = new AudioAnalyzer(audioPath);
  const { frameData, totalFrames, duration, fps } = await analyzer.analyze();

  console.log(`\n✅ Analysis complete:`);
  console.log(`   Duration: ${duration.toFixed(2)}s`);
  console.log(`   Frames: ${totalFrames} @ ${fps}fps`);

  // Calculate statistics
  let stats = {
    bass: { min: 1, max: 0, avg: 0, count: 0 },
    mid: { min: 1, max: 0, avg: 0, count: 0 },
    high: { min: 1, max: 0, avg: 0, count: 0 },
    midAboveThreshold: 0
  };

  const distortionThreshold = 0.5;

  for (let i = 0; i < totalFrames; i++) {
    const { bass, mid, high } = analyzer.analyzeFrequencyBands(frameData[i]);

    // Bass stats
    stats.bass.min = Math.min(stats.bass.min, bass);
    stats.bass.max = Math.max(stats.bass.max, bass);
    stats.bass.avg += bass;

    // Mid stats
    stats.mid.min = Math.min(stats.mid.min, mid);
    stats.mid.max = Math.max(stats.mid.max, mid);
    stats.mid.avg += mid;
    if (mid > distortionThreshold) stats.midAboveThreshold++;

    // High stats
    stats.high.min = Math.min(stats.high.min, high);
    stats.high.max = Math.max(stats.high.max, high);
    stats.high.avg += high;
  }

  stats.bass.avg /= totalFrames;
  stats.mid.avg /= totalFrames;
  stats.high.avg /= totalFrames;

  console.log('\n📈 Frequency Band Statistics:');
  console.log('\n  BASS (controls zoom & glow):');
  console.log(`    Min: ${stats.bass.min.toFixed(3)}`);
  console.log(`    Max: ${stats.bass.max.toFixed(3)}`);
  console.log(`    Avg: ${stats.bass.avg.toFixed(3)}`);

  console.log('\n  MID (controls distortion):');
  console.log(`    Min: ${stats.mid.min.toFixed(3)}`);
  console.log(`    Max: ${stats.mid.max.toFixed(3)}`);
  console.log(`    Avg: ${stats.mid.avg.toFixed(3)}`);
  console.log(`    Frames above threshold (${distortionThreshold}): ${stats.midAboveThreshold}/${totalFrames} (${(stats.midAboveThreshold / totalFrames * 100).toFixed(1)}%)`);

  console.log('\n  HIGH (controls rotation & color):');
  console.log(`    Min: ${stats.high.min.toFixed(3)}`);
  console.log(`    Max: ${stats.high.max.toFixed(3)}`);
  console.log(`    Avg: ${stats.high.avg.toFixed(3)}`);

  // Sample frames
  console.log('\n🎯 Sample Frames:');
  const sampleIndices = [0, 90, 300, 690, 870];
  for (const idx of sampleIndices) {
    if (idx < totalFrames) {
      const { bass, mid, high } = analyzer.analyzeFrequencyBands(frameData[idx]);
      const time = (idx / fps).toFixed(1);
      const distortionActive = mid > distortionThreshold ? '✓' : '✗';
      console.log(`  Frame ${idx} (${time}s): bass=${bass.toFixed(3)}, mid=${mid.toFixed(3)} ${distortionActive}, high=${high.toFixed(3)}`);
    }
  }

  // Histogram
  console.log('\n📊 Mid Frequency Distribution:');
  const bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const histogram = new Array(bins.length - 1).fill(0);

  for (let i = 0; i < totalFrames; i++) {
    const { mid } = analyzer.analyzeFrequencyBands(frameData[i]);
    for (let j = 0; j < bins.length - 1; j++) {
      if (mid >= bins[j] && mid < bins[j + 1]) {
        histogram[j]++;
        break;
      }
    }
  }

  for (let i = 0; i < histogram.length; i++) {
    const percent = (histogram[i] / totalFrames * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(percent / 2));
    console.log(`  ${bins[i].toFixed(1)}-${bins[i + 1].toFixed(1)}: ${bar} ${percent}% (${histogram[i]} frames)`);
  }

  console.log('\n💡 Recommendations:');
  if (stats.midAboveThreshold < totalFrames * 0.1) {
    console.log('  ⚠️  Mid frequencies rarely exceed distortion threshold (0.5)');
    console.log('  → Consider lowering distortion threshold to 0.3 for more glitch effects');
  }
  if (stats.bass.avg < 0.3) {
    console.log('  ⚠️  Low average bass response');
    console.log('  → Consider increasing FFT multiplier for bass sensitivity');
  }
}

analyzeAudio().catch(console.error);

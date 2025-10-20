import gl from 'gl';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import FFT from 'fft.js';
import { getProfileConfig } from './profiles.js';
import { createFFTScaler } from './audio/fft-scaling.js';
import { createSmoother } from './motion/frame-rate-helpers.js';

// Match the browser's resolution exactly
const WIDTH = 720;
const HEIGHT = 720;

class AudioAnalyzer {
  constructor(audioPath, config) {
    this.audioPath = audioPath;
    this.sampleRate = 44100;
    this.fftSize = 256;
    this.frequencyBinCount = this.fftSize / 2;
    this.config = config;

    // Create FFT scaler based on profile configuration
    this.fftScaler = createFFTScaler({
      strategy: config.fftScaling || 'linear',
      multiplier: config.fftMultiplier,
      minDb: config.fftMinDb,
      maxDb: config.fftMaxDb,
      temporalSmoothing: config.temporalSmoothing || false,
      temporalSmoothingConstant: config.temporalSmoothingConstant
    });
  }

  async analyze() {
    // Get actual audio duration from ffprobe first
    const duration = await this.getAudioDuration();

    // Extract raw PCM audio data using ffmpeg
    const pcmPath = '/tmp/audio.pcm';
    await this.extractPCM(pcmPath);

    // Read PCM data
    const pcmData = await fs.readFile(pcmPath);
    const samples = new Float32Array(pcmData.buffer);

    // Use frame rate from profile config
    const fps = this.config.frameRate || 60;
    const totalFrames = Math.floor(duration * fps); // Use floor to avoid extra frames
    const samplesPerFrame = Math.floor(this.sampleRate / fps);

    const frameData = [];

    for (let frame = 0; frame < totalFrames; frame++) {
      const startSample = frame * samplesPerFrame;
      const frameSamples = samples.slice(startSample, startSample + this.fftSize);

      // Pad if needed
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
    // Use proper FFT library
    const fft = new FFT(this.fftSize);
    const out = fft.createComplexArray();
    const input = fft.toComplexArray(samples, null);
    fft.transform(out, input);

    // Use profile-configured FFT scaler
    const frequencyData = this.fftScaler.scale(out, this.fftSize);

    return frequencyData;
  }
}

class ServerRenderer {
  constructor(params, config) {
    this.params = params;
    this.config = config;
    this.glContext = gl(WIDTH, HEIGHT, { preserveDrawingBuffer: true });
    this.time = 0;
    this.rotation = 0;
    this.isInverted = false;
    this.inversionStartFrame = 0;
    this.lastInversionFrame = 0;

    // Use profile-configured inversion parameters
    // Handle both frame-based (legacy-server) and time-based (legacy-browser)
    const fps = config.frameRate || 30;
    if (config.inversionCooldownFrames !== undefined) {
      this.inversionCooldownFrames = config.inversionCooldownFrames;
    } else if (config.inversionCooldownMs !== undefined) {
      this.inversionCooldownFrames = Math.round((config.inversionCooldownMs / 1000) * fps);
    } else {
      this.inversionCooldownFrames = 15;
    }

    if (config.inversionDurationFrames !== undefined) {
      this.inversionDurationFrames = config.inversionDurationFrames;
    } else if (config.inversionDurationMs !== undefined) {
      this.inversionDurationFrames = Math.round((config.inversionDurationMs / 1000) * fps);
    } else {
      this.inversionDurationFrames = 9;
    }

    // Create smoothers based on motion system configuration
    this.createSmoothers();
  }

  createSmoothers() {
    const fps = this.config.frameRate || 60;

    // Determine motion system (legacy, exponential, or spring)
    const motionSystem = this.config.motionSystem || (this.config.bassHalfLife ? 'exponential' : 'legacy');

    if (motionSystem === 'spring') {
      // Spring physics for scale
      this.bassSmoother = createSmoother({
        motionSystem: 'spring',
        stiffness: this.config.scaleSpringStiffness || 0.25,
        damping: this.config.scaleSpringDamping || 0.82,
        fps,
        initialValue: 0
      });

      // Spring physics for rotation (optional)
      this.rotationSmoother = createSmoother({
        motionSystem: 'spring',
        stiffness: this.config.rotationSpringStiffness || 0.3,
        damping: this.config.rotationSpringDamping || 0.75,
        fps,
        initialValue: 0
      });
    } else if (motionSystem === 'exponential') {
      // Frame-rate independent exponential smoothing
      this.bassSmoother = createSmoother({
        motionSystem: 'exponential',
        halfLife: this.config.bassHalfLife || 0.15,
        fps,
        initialValue: 0
      });

      this.midSmoother = createSmoother({
        motionSystem: 'exponential',
        halfLife: this.config.midHalfLife || 0.22,
        fps,
        initialValue: 0
      });
    } else {
      // Legacy frame-rate dependent smoothing
      this.bassSmoother = createSmoother({
        motionSystem: 'legacy',
        smoothing: this.config.bassSmoothing || 0.7,
        initialValue: 0
      });

      this.midSmoother = createSmoother({
        motionSystem: 'legacy',
        smoothing: this.config.midSmoothing || 0.85,
        initialValue: 0
      });
    }
  }

  hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)];
  }

  async setupWebGL() {
    const gl = this.glContext;

    // Vertex shader - exact copy from browser
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Fragment shader - exact copy from browser
    const fragmentShaderSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform float u_scale;
      uniform float u_rotation;
      uniform float u_distortionAmount;
      uniform float u_time;
      uniform int u_distortionType;
      uniform vec3 u_bgColor;
      uniform float u_hueShift;
      uniform float u_bassIntensity;
      uniform float u_glowIntensity;
      uniform vec3 u_trailColor;
      uniform sampler2D u_trailTexture;
      uniform float u_trailDecay;
      uniform bool u_invertColors;
      varying vec2 v_texCoord;

      vec2 rotate(vec2 v, float a) {
        float s = sin(a);
        float c = cos(a);
        mat2 m = mat2(c, -s, s, c);
        return m * v;
      }

      vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
      }

      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      float noise3d(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        float n = i.x + i.y * 57.0 + 113.0 * i.z;
        return mix(
          mix(mix(random(vec2(n + 0.0, 0.0)), random(vec2(n + 1.0, 0.0)), f.x),
            mix(random(vec2(n + 57.0, 0.0)), random(vec2(n + 58.0, 0.0)), f.x), f.y),
          mix(mix(random(vec2(n + 113.0, 0.0)), random(vec2(n + 114.0, 0.0)), f.x),
            mix(random(vec2(n + 170.0, 0.0)), random(vec2(n + 171.0, 0.0)), f.x), f.y),
          f.z);
      }

      void main() {
        vec2 center = vec2(0.5, 0.5);
        vec2 uv = v_texCoord;

        // Apply distortion - exact copy
        if (u_distortionType == 0) {
          uv.x += sin(uv.y * 20.0 + u_time) * u_distortionAmount * 0.05;
        } else if (u_distortionType == 1) {
          uv.y += sin(uv.x * 20.0 + u_time) * u_distortionAmount * 0.05;
        } else if (u_distortionType == 2) {
          float dist = distance(uv, center);
          uv.x += sin(dist * 20.0 + u_time) * u_distortionAmount * 0.05;
        } else if (u_distortionType == 3) {
          uv.x += sin(uv.y * 15.0 + u_time) * u_distortionAmount * 0.05 * cos(u_time * 0.5);
        } else if (u_distortionType == 4) {
          float glitchSeed = floor(u_time * 3.5);
          float microGlitch = fract(u_time * 3.5);

          float block1 = step(0.6, sin(uv.y * 15.0 + glitchSeed * 13.7));
          float block2 = step(0.7, sin(uv.y * 28.0 + glitchSeed * 7.3));
          float block3 = step(0.75, sin(uv.y * 45.0 + glitchSeed * 23.1));
          float block4 = step(0.8, sin(uv.y * 70.0 + glitchSeed * 31.4));

          float disp1 = (random(vec2(glitchSeed, 1.0)) - 0.5);
          float disp2 = (random(vec2(glitchSeed, 2.0)) - 0.5);
          float disp3 = (random(vec2(glitchSeed, 3.0)) - 0.5);
          float disp4 = (random(vec2(glitchSeed, 4.0)) - 0.5);

          uv.x += block1 * disp1 * u_distortionAmount * 0.12;
          uv.x += block2 * disp2 * u_distortionAmount * 0.15;
          uv.x += block3 * disp3 * u_distortionAmount * 0.1;
          uv.y += block4 * disp4 * u_distortionAmount * 0.08;

          if (microGlitch > 0.9) {
            uv.x += (random(vec2(glitchSeed, 5.0)) - 0.5) * u_distortionAmount * 0.2;
          }

          if (u_distortionAmount > 0.5) {
            float chromaShift = u_distortionAmount * 0.02;
            uv.x += sin(uv.y * 100.0 + glitchSeed * 5.0) * chromaShift;
            if (random(vec2(floor(uv.y * 50.0), glitchSeed)) > 0.97) {
              uv.x += (random(vec2(glitchSeed, 6.0)) - 0.5) * u_distortionAmount * 0.25;
            }
          }

          if (u_distortionAmount > 0.8) {
            float blockCorrupt = step(0.95, random(vec2(floor(uv.y * 20.0), glitchSeed)));
            uv.x += blockCorrupt * (random(vec2(glitchSeed, 7.0)) - 0.5) * 0.3;
          }
        }

        vec2 rotated = rotate(uv - center, u_rotation) / u_scale + center;
        vec4 texColor = texture2D(u_texture, rotated);

        // Edge detection
        float edgeStep = 0.005;
        vec4 n = texture2D(u_texture, rotated + vec2(0.0, -edgeStep));
        vec4 s = texture2D(u_texture, rotated + vec2(0.0, edgeStep));
        vec4 e = texture2D(u_texture, rotated + vec2(edgeStep, 0.0));
        vec4 w = texture2D(u_texture, rotated + vec2(-edgeStep, 0.0));

        float edgeX = length(e.rgb - w.rgb);
        float edgeY = length(n.rgb - s.rgb);
        float edge = sqrt(edgeX * edgeX + edgeY * edgeY);
        edge = smoothstep(0.1, 0.5, edge);

        float gray = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 grayscaleTexture = vec3(gray);
        vec3 normalColor = mix(u_bgColor, grayscaleTexture, texColor.a);

        vec3 textureColorHSV = rgb2hsv(u_trailColor);
        float textureHueShift = (u_hueShift / 360.0) * 0.4;
        textureColorHSV.x = fract(textureColorHSV.x + 0.5 + textureHueShift);

        float glowBoost = 1.0 + (u_glowIntensity * 3.0);
        textureColorHSV.z = min(1.0, textureColorHSV.z * glowBoost);
        vec3 textureColor = hsv2rgb(textureColorHSV);

        float colorMixAmount = gray * texColor.a * (0.8 + u_glowIntensity * 0.5);
        normalColor = mix(normalColor, textureColor * gray, colorMixAmount);

        vec3 trailColorHSV = rgb2hsv(u_trailColor);
        float colorHueShift = (u_hueShift / 360.0) * 1.0;
        trailColorHSV.x = fract(trailColorHSV.x + colorHueShift);
        trailColorHSV.y = min(1.0, trailColorHSV.y * 1.4);
        trailColorHSV.z = min(1.0, trailColorHSV.z * 1.3);
        vec3 shiftedTrailColor = hsv2rgb(trailColorHSV);

        vec3 coloredEdge = shiftedTrailColor * edge * 1.5;
        normalColor += coloredEdge;

        vec4 previousTrail = texture2D(u_trailTexture, v_texCoord);
        vec3 decayedTrail = previousTrail.rgb * u_trailDecay;

        float brightness = gray * texColor.a;
        vec3 newTrail = shiftedTrailColor * brightness * 0.3;

        vec3 trails = decayedTrail + newTrail;
        vec3 finalColor = normalColor + trails;

        // 3D noise
        vec3 noiseCoord = vec3(v_texCoord * 3.0, u_time * 0.1);
        float noiseValue = noise3d(noiseCoord);
        finalColor *= 0.8 + noiseValue * 0.4;

        // Color inversion
        if (u_invertColors) {
          float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
          if (luminance > 0.1) {
            finalColor = vec3(1.0) - finalColor;
          }
        }

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    // Compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    // Create program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);
    gl.useProgram(this.program);

    // Setup geometry - match browser texture coordinates exactly
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    const texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord');
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Load and setup texture (raptor SVG)
    await this.setupTexture();
    
    // Setup trail framebuffer
    this.setupTrailFramebuffer();
  }

  async setupTexture() {
    const gl = this.glContext;

    // Load PNG directly
    const pngUrl = this.params.pngUrl || 'http://localhost:5174/raptor-bw.png';
    const img = await loadImage(pngUrl);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);

    // Create WebGL texture from canvas
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, WIDTH, HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array(ctx.getImageData(0, 0, WIDTH, HEIGHT).data));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  setupTrailFramebuffer() {
    const gl = this.glContext;
    
    this.trailFramebuffer = gl.createFramebuffer();
    this.trailTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.trailTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, WIDTH, HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.trailTexture, 0);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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

  renderFrame(frameNumber, frequencyData) {
    const gl = this.glContext;
    const { bass, mid, high } = this.analyzeFrequencyBands(frequencyData);

    // Debug output every 30 frames (once per second)
    const fps = this.config.frameRate || 30;
    if (frameNumber % fps === 0) {
      console.log(`Frame ${frameNumber}: bass=${bass.toFixed(3)}, mid=${mid.toFixed(3)}, high=${high.toFixed(3)}`);
    }

    // Update smoothed bass using configured smoother
    const smoothedBass = this.bassSmoother.update(bass);

    // Calculate scale using profile parameters
    const scaleMin = this.config.scaleMin ?? 0.15;
    const scaleRange = this.config.scaleRange ?? 0.8;
    const scale = scaleMin + smoothedBass * scaleRange;

    // Update smoothed mid using configured smoother (if not spring system)
    let smoothedMid;
    if (this.midSmoother) {
      smoothedMid = this.midSmoother.update(mid);
    } else {
      // Spring system doesn't need mid smoothing
      smoothedMid = mid;
    }

    // Distortion using profile parameters
    const distortionThreshold = this.config.distortionThreshold ?? 0.5;
    const distortionMultiplier = this.config.distortionMultiplier ?? 0.6;
    const distortionBaseSpeed = this.config.distortionBaseSpeed ?? 0.02;
    const distortionSpeedMultiplier = this.config.distortionSpeedMultiplier ?? 0.2;

    const distortionIntensity = Math.max(0, mid - distortionThreshold) / (1 - distortionThreshold);
    const distortionAmount = distortionIntensity * distortionMultiplier;
    const distortionSpeed = distortionBaseSpeed + distortionIntensity * distortionSpeedMultiplier;
    this.time += distortionSpeed;

    // Rotation using profile parameters
    const rotationSpeed = this.config.rotationSpeed ?? 0.8;
    this.rotation += high * rotationSpeed;
    this.rotation = this.rotation % 360;

    const hueShift = high * 240;

    // Color inversion logic using profile parameters
    const inversionBassThreshold = this.config.inversionBassThreshold ?? 0.7;
    if (bass > inversionBassThreshold && frameNumber - this.lastInversionFrame > this.inversionCooldownFrames) {
      this.isInverted = true;
      this.inversionStartFrame = frameNumber;
      this.lastInversionFrame = frameNumber;
    }

    // Auto-revert after configured duration
    if (this.isInverted && frameNumber - this.inversionStartFrame > this.inversionDurationFrames) {
      this.isInverted = false;
    }

    gl.useProgram(this.program);

    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_texture'), 0);

    // Set all uniforms (exact match to browser)
    const trailColorRgb = this.hslToRgb(this.params.trailHue, this.params.trailSat, this.params.trailLight);
    const bgColorRgb = [0.0, 0.0, 0.0];

    gl.uniform1f(gl.getUniformLocation(this.program, 'u_scale'), scale);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_rotation'), (this.rotation * Math.PI) / 180);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_distortionAmount'), distortionAmount);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_time'), this.time);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_distortionType'), this.params.distortionType);
    gl.uniform3f(gl.getUniformLocation(this.program, 'u_bgColor'), ...bgColorRgb);
    gl.uniform3f(gl.getUniformLocation(this.program, 'u_trailColor'), ...trailColorRgb);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_hueShift'), hueShift);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_bassIntensity'), smoothedMid);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_glowIntensity'), bass);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_trailDecay'), this.config.trailDecay ?? 0.92);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_invertColors'), this.isInverted ? 1 : 0);

    // Bind trail texture
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.trailTexture);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_trailTexture'), 1);

    // Draw to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(...bgColorRgb, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Copy to trail texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFramebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Read pixels
    const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
    gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    return pixels;
  }
}

export async function generateVideo(params) {
  console.log('Starting video generation with params:', params);

  // Get profile configuration
  const profileName = params.profile || 'legacy-server';
  const config = getProfileConfig(profileName);
  console.log(`Using profile: ${profileName}`, config.name || '');

  // 1. Download audio
  const audioPath = '/tmp/input_audio.mp3';
  const audioResponse = await fetch(params.audioUrl);
  const audioBuffer = await audioResponse.arrayBuffer();
  await fs.writeFile(audioPath, Buffer.from(audioBuffer));

  // 2. Analyze audio with profile configuration
  console.log('Analyzing audio...');
  const analyzer = new AudioAnalyzer(audioPath, config);
  const { frameData, totalFrames, duration, fps } = await analyzer.analyze();
  console.log(`Audio analyzed: ${totalFrames} frames, ${duration.toFixed(2)}s at ${fps}fps`);

  // 3. Setup renderer with profile configuration
  console.log('Setting up WebGL renderer...');
  const renderer = new ServerRenderer(params, config);
  await renderer.setupWebGL();

  // 4. Render all frames
  console.log('Rendering frames...');
  const framesDir = '/tmp/frames';

  // Clean up old frames
  try {
    await fs.rm(framesDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore if doesn't exist
  }
  await fs.mkdir(framesDir, { recursive: true });

  for (let i = 0; i < totalFrames; i++) {
    const pixels = renderer.renderFrame(i, frameData[i]);

    // Convert RGBA to PNG using node-canvas
    // WebGL pixels are bottom-to-top, so flip them
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(WIDTH, HEIGHT);

    // Flip vertically
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const srcIdx = (y * WIDTH + x) * 4;
        const dstIdx = ((HEIGHT - 1 - y) * WIDTH + x) * 4;
        imageData.data[dstIdx] = pixels[srcIdx];
        imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
        imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
        imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(path.join(framesDir, `frame_${String(i).padStart(6, '0')}.png`), buffer);

    if (i % 30 === 0) {
      console.log(`Rendered ${i}/${totalFrames} frames`);
    }
  }

  // 5. Mux with ffmpeg
  console.log('Muxing video...');
  const outputPath = '/tmp/output.mp4';
  const finalPath = path.join(process.cwd(), 'test-output.mp4');
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-framerate', String(fps),
      '-i', path.join(framesDir, 'frame_%06d.png'),
      '-i', audioPath,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      '-y',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg mux failed with code ${code}`));
    });
  });

  // Copy to current directory for easy access
  await fs.copyFile(outputPath, finalPath);
  console.log(`Video saved to: ${finalPath}`);
  return outputPath;
}

// RunPod handler
export async function handler(event) {
  try {
    const params = {
      audioUrl: event.input.audioUrl,
      distortionType: event.input.distortionType,
      trailHue: event.input.trailHue,
      trailSat: event.input.trailSat,
      trailLight: event.input.trailLight,
      pngUrl: event.input.pngUrl,

      // Profile system parameters
      profile: event.input.profile,        // e.g., 'legacy', 'browser-match', 'high-energy'
      overrides: event.input.overrides     // Optional parameter overrides
    };

    const videoPath = await generateVideo(params);
    const videoBuffer = await fs.readFile(videoPath);
    const base64Video = videoBuffer.toString('base64');

    return {
      status: 'success',
      video: base64Video,
      duration: 'calculated from audio',
      profile: params.profile || 'legacy'
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      status: 'error',
      message: error.message
    };
  }
}

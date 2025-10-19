/**
 * FFT Scaling Strategies for Audio Analysis
 *
 * This module provides different strategies for converting raw FFT complex numbers
 * into normalized 0-255 frequency data, matching various audio API behaviors.
 *
 * Background:
 * - Browser Web Audio API uses sophisticated dB-based scaling
 * - Raw FFT libraries (like fft.js) output complex numbers that need normalization
 * - Different scaling produces dramatically different visual results
 *
 * Usage:
 *   const scaler = createFFTScaler({ strategy: 'decibels', minDb: -100, maxDb: -30 });
 *   const normalized = scaler.scale(complexArray, fftSize);
 */

/**
 * LINEAR SCALING STRATEGY
 *
 * Current/legacy behavior: multiply magnitude by arbitrary constant.
 * This is what the server currently uses with multiplier = 15.
 *
 * Pros:
 * - Simple, fast
 * - Predictable linear relationship
 *
 * Cons:
 * - Multiplier is arbitrary, not calibrated to audio standards
 * - Doesn't match Web Audio API behavior
 * - Weak signals get lost, strong signals clip
 * - No perceptual scaling
 *
 * Math:
 *   magnitude = sqrt(real² + imag²) / fftSize
 *   output = clamp(magnitude * 255 * multiplier, 0, 255)
 */
class LinearFFTScaler {
  constructor(config = {}) {
    this.multiplier = config.multiplier || 15;
  }

  /**
   * Scale FFT complex array to 0-255 frequency data
   *
   * @param {Float32Array} complexArray - FFT output [real0, imag0, real1, imag1, ...]
   * @param {number} fftSize - FFT size (bins = fftSize / 2)
   * @returns {Uint8Array} Normalized frequency data (0-255)
   */
  scale(complexArray, fftSize) {
    const frequencyBinCount = fftSize / 2;
    const frequencyData = new Uint8Array(frequencyBinCount);

    for (let i = 0; i < frequencyBinCount; i++) {
      const real = complexArray[i * 2];
      const imag = complexArray[i * 2 + 1];

      // Calculate magnitude and normalize by FFT size
      const magnitude = Math.sqrt(real * real + imag * imag) / fftSize;

      // Apply linear scaling with multiplier
      const scaled = magnitude * 255 * this.multiplier;

      // Clamp to 0-255 range
      frequencyData[i] = Math.min(255, Math.max(0, Math.floor(scaled)));
    }

    return frequencyData;
  }
}

/**
 * DECIBEL SCALING STRATEGY
 *
 * Matches Web Audio API's AnalyserNode behavior.
 * Converts magnitudes to decibels, then maps dB range to 0-255.
 *
 * Pros:
 * - Matches browser Web Audio API
 * - Perceptually calibrated (human hearing is logarithmic)
 * - Wide dynamic range without clipping
 * - Industry-standard approach
 *
 * Cons:
 * - Slightly more computation (log10)
 * - Requires dB range tuning
 *
 * Math:
 *   magnitude = sqrt(real² + imag²)
 *   dB = 20 * log10(magnitude / fftSize + epsilon)
 *   normalized = (dB - minDb) / (maxDb - minDb)
 *   output = clamp(normalized * 255, 0, 255)
 *
 * Web Audio API defaults:
 *   minDecibels: -100 dB (silence threshold)
 *   maxDecibels: -30 dB (loud signal threshold)
 *
 * Decibel scale reference:
 *   -100 dB: Near silence
 *   -60 dB: Quiet background
 *   -40 dB: Moderate signal
 *   -30 dB: Strong signal
 *   0 dB: Maximum (clipping)
 */
class DecibelFFTScaler {
  constructor(config = {}) {
    this.minDb = config.minDb ?? -100;  // Web Audio API default
    this.maxDb = config.maxDb ?? -30;   // Web Audio API default
    this.dbRange = this.maxDb - this.minDb;
    this.epsilon = 1e-10;  // Prevent log(0)
  }

  /**
   * Scale FFT complex array to 0-255 frequency data using dB conversion
   *
   * @param {Float32Array} complexArray - FFT output [real0, imag0, real1, imag1, ...]
   * @param {number} fftSize - FFT size (bins = fftSize / 2)
   * @returns {Uint8Array} Normalized frequency data (0-255)
   */
  scale(complexArray, fftSize) {
    const frequencyBinCount = fftSize / 2;
    const frequencyData = new Uint8Array(frequencyBinCount);

    for (let i = 0; i < frequencyBinCount; i++) {
      const real = complexArray[i * 2];
      const imag = complexArray[i * 2 + 1];

      // Calculate magnitude (don't normalize yet - dB formula handles it)
      const magnitude = Math.sqrt(real * real + imag * imag);

      // Convert to decibels (like Web Audio API)
      // Formula: 20 * log10(magnitude / reference)
      // reference = fftSize to normalize
      // epsilon prevents log(0) = -Infinity
      const db = 20 * Math.log10(magnitude / fftSize + this.epsilon);

      // Map dB range to 0-1
      const normalized = (db - this.minDb) / this.dbRange;

      // Scale to 0-255 and clamp
      frequencyData[i] = Math.min(255, Math.max(0, Math.floor(normalized * 255)));
    }

    return frequencyData;
  }
}

/**
 * TEMPORAL SMOOTHING WRAPPER
 *
 * Applies exponential moving average to each frequency bin over time.
 * Matches Web Audio API's AnalyserNode.smoothingTimeConstant behavior.
 *
 * Web Audio API behavior:
 *   analyser.smoothingTimeConstant = 0.8;
 *   // Each bin: smoothed = old * 0.8 + new * 0.2
 *
 * Pros:
 * - Reduces frame-to-frame jitter
 * - Smoother visuals
 * - Matches browser behavior exactly
 *
 * Cons:
 * - Adds lag to audio response
 * - Requires state (smoothed bins array)
 *
 * Usage:
 *   const scaler = createFFTScaler({
 *     strategy: 'decibels',
 *     temporalSmoothing: true,
 *     temporalSmoothingConstant: 0.8
 *   });
 */
class TemporalSmoothingWrapper {
  constructor(baseScaler, config = {}) {
    this.baseScaler = baseScaler;
    this.smoothingConstant = config.temporalSmoothingConstant ?? 0.8;
    this.smoothedBins = null;  // Initialized on first call
  }

  /**
   * Scale with temporal smoothing applied
   *
   * @param {Float32Array} complexArray - FFT output
   * @param {number} fftSize - FFT size
   * @returns {Uint8Array} Smoothed frequency data (0-255)
   */
  scale(complexArray, fftSize) {
    // Get raw scaled data from base scaler
    const rawData = this.baseScaler.scale(complexArray, fftSize);

    // Initialize smoothed bins on first call
    if (this.smoothedBins === null) {
      this.smoothedBins = new Float32Array(rawData.length);
      // Copy initial values
      for (let i = 0; i < rawData.length; i++) {
        this.smoothedBins[i] = rawData[i];
      }
      return rawData;
    }

    // Apply exponential moving average to each bin
    const output = new Uint8Array(rawData.length);
    const alpha = this.smoothingConstant;
    const beta = 1 - alpha;

    for (let i = 0; i < rawData.length; i++) {
      // Smoothed = old * alpha + new * beta
      this.smoothedBins[i] = this.smoothedBins[i] * alpha + rawData[i] * beta;
      output[i] = Math.floor(this.smoothedBins[i]);
    }

    return output;
  }

  /**
   * Reset smoothing state (e.g., when loading new audio)
   */
  reset() {
    this.smoothedBins = null;
  }
}

/**
 * Factory function to create FFT scaler based on configuration
 *
 * @param {Object} config - Scaler configuration
 * @param {string} config.strategy - 'linear' or 'decibels'
 * @param {number} [config.multiplier] - Linear scaling multiplier (default: 15)
 * @param {number} [config.minDb] - Minimum dB threshold (default: -100)
 * @param {number} [config.maxDb] - Maximum dB threshold (default: -30)
 * @param {boolean} [config.temporalSmoothing] - Enable per-bin smoothing (default: false)
 * @param {number} [config.temporalSmoothingConstant] - Smoothing factor (default: 0.8)
 * @returns {Object} FFT scaler with scale(complexArray, fftSize) method
 *
 * @example
 * // Legacy linear scaling (current server behavior)
 * const scaler = createFFTScaler({ strategy: 'linear', multiplier: 15 });
 *
 * @example
 * // Browser-match: dB scaling with temporal smoothing
 * const scaler = createFFTScaler({
 *   strategy: 'decibels',
 *   minDb: -100,
 *   maxDb: -30,
 *   temporalSmoothing: true,
 *   temporalSmoothingConstant: 0.8
 * });
 *
 * @example
 * // High-energy: dB scaling without smoothing for maximum reactivity
 * const scaler = createFFTScaler({
 *   strategy: 'decibels',
 *   temporalSmoothing: false
 * });
 */
export function createFFTScaler(config = {}) {
  const strategy = config.strategy || 'linear';

  // Create base scaler
  let scaler;
  if (strategy === 'linear') {
    scaler = new LinearFFTScaler(config);
  } else if (strategy === 'decibels') {
    scaler = new DecibelFFTScaler(config);
  } else {
    throw new Error(`Unknown FFT scaling strategy: "${strategy}". Use "linear" or "decibels".`);
  }

  // Wrap with temporal smoothing if enabled
  if (config.temporalSmoothing) {
    scaler = new TemporalSmoothingWrapper(scaler, config);
  }

  return scaler;
}

/**
 * Helper: Apply multiplier boost to any scaler
 *
 * Used when you want to boost all frequency values by a constant factor.
 * Useful for "high-energy" profiles.
 *
 * @param {Object} scaler - Base FFT scaler
 * @param {number} multiplier - Boost factor (e.g., 1.5 for 50% boost)
 * @returns {Object} Boosted scaler
 *
 * @example
 * const baseScaler = createFFTScaler({ strategy: 'decibels' });
 * const boostedScaler = applyMultiplierBoost(baseScaler, 1.5);
 */
export function applyMultiplierBoost(scaler, multiplier) {
  return {
    scale(complexArray, fftSize) {
      const baseData = scaler.scale(complexArray, fftSize);
      const boosted = new Uint8Array(baseData.length);

      for (let i = 0; i < baseData.length; i++) {
        boosted[i] = Math.min(255, Math.floor(baseData[i] * multiplier));
      }

      return boosted;
    },

    reset() {
      if (scaler.reset) scaler.reset();
    }
  };
}

/**
 * Diagnostic: Compare two scalers side-by-side
 *
 * Useful for debugging and calibration. Logs statistics about
 * the differences between two scaling strategies.
 *
 * @param {Float32Array} complexArray - FFT output to test
 * @param {number} fftSize - FFT size
 * @param {Object} scaler1 - First scaler
 * @param {Object} scaler2 - Second scaler
 * @param {string} label1 - Label for first scaler
 * @param {string} label2 - Label for second scaler
 */
export function compareScalers(complexArray, fftSize, scaler1, scaler2, label1 = 'Scaler 1', label2 = 'Scaler 2') {
  const data1 = scaler1.scale(complexArray, fftSize);
  const data2 = scaler2.scale(complexArray, fftSize);

  // Calculate statistics
  const stats1 = calculateStats(data1);
  const stats2 = calculateStats(data2);

  console.log('\n=== FFT Scaler Comparison ===');
  console.log(`\n${label1}:`);
  console.log(`  Min: ${stats1.min}`);
  console.log(`  Max: ${stats1.max}`);
  console.log(`  Mean: ${stats1.mean.toFixed(2)}`);
  console.log(`  Median: ${stats1.median}`);
  console.log(`  Non-zero bins: ${stats1.nonZero}/${data1.length}`);

  console.log(`\n${label2}:`);
  console.log(`  Min: ${stats2.min}`);
  console.log(`  Max: ${stats2.max}`);
  console.log(`  Mean: ${stats2.mean.toFixed(2)}`);
  console.log(`  Median: ${stats2.median}`);
  console.log(`  Non-zero bins: ${stats2.nonZero}/${data2.length}`);

  // Show first 10 bins side-by-side
  console.log(`\nFirst 10 bins:`);
  console.log(`Bin | ${label1.padEnd(12)} | ${label2.padEnd(12)} | Diff`);
  console.log('-'.repeat(50));
  for (let i = 0; i < Math.min(10, data1.length); i++) {
    const diff = data2[i] - data1[i];
    const sign = diff >= 0 ? '+' : '';
    console.log(`${i.toString().padStart(3)} | ${data1[i].toString().padStart(12)} | ${data2[i].toString().padStart(12)} | ${sign}${diff}`);
  }
}

function calculateStats(data) {
  const sorted = Array.from(data).sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const nonZero = sorted.filter(v => v > 0).length;

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    nonZero
  };
}

/**
 * Diagnostic: Log raw FFT magnitude ranges
 *
 * Helps determine appropriate scaling multipliers.
 * Call this before processing to understand your FFT output range.
 *
 * @param {Float32Array} complexArray - FFT output
 * @param {number} fftSize - FFT size
 */
export function logFFTMagnitudeRange(complexArray, fftSize) {
  const frequencyBinCount = fftSize / 2;
  let minMag = Infinity;
  let maxMag = -Infinity;
  const magnitudes = [];

  for (let i = 0; i < frequencyBinCount; i++) {
    const real = complexArray[i * 2];
    const imag = complexArray[i * 2 + 1];
    const magnitude = Math.sqrt(real * real + imag * imag);

    magnitudes.push(magnitude);
    minMag = Math.min(minMag, magnitude);
    maxMag = Math.max(maxMag, magnitude);
  }

  const sum = magnitudes.reduce((acc, val) => acc + val, 0);
  const mean = sum / magnitudes.length;

  console.log('\n=== Raw FFT Magnitude Analysis ===');
  console.log(`Min magnitude: ${minMag.toExponential(3)}`);
  console.log(`Max magnitude: ${maxMag.toExponential(3)}`);
  console.log(`Mean magnitude: ${mean.toExponential(3)}`);
  console.log(`Range: ${(maxMag - minMag).toExponential(3)}`);
  console.log(`Suggested linear multiplier: ${(255 / (maxMag / fftSize)).toFixed(1)}`);
}

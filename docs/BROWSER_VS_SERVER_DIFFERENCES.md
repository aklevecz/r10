# Browser vs Server Visual Differences Analysis

**Problem**: Same song produces very different visuals in browser vs headless server renderer.
**Symptom**: Server version has much less movement and fewer visual elements.

---

## Comparison Summary

| Aspect | Browser | Server | Impact |
|--------|---------|--------|--------|
| FFT Smoothing | 0.8 | NONE | Server has jittery frame-to-frame values |
| Frame Rate | 60fps | 30fps | Half temporal resolution |
| Rotation Speed | high × 0.8 | high × 1.8 | Server compensates for something |
| Distortion Threshold | 0.5 | 0.3 | Server triggers earlier |
| Distortion Amount | 0.6 | 0.7 | Server is stronger |
| FFT Magnitude Scaling | Web Audio built-in | Manual × 15 | Likely miscalibrated |

---

## Detailed Differences

### 1. Analyser Smoothing ⚠️ CRITICAL DIFFERENCE

**Browser** (AudioVisualizerWebGL.svelte:489):
```javascript
analyser.smoothingTimeConstant = 0.8;
```
- Web Audio API applies temporal smoothing to FFT bins
- Each frequency bin smoothed: `new = old × 0.8 + current × 0.2`
- Result: Smooth, continuous frequency data

**Server** (renderer.js:100-119):
```javascript
performFFT(samples) {
  const fft = new FFT(this.fftSize);
  // ... raw FFT, NO SMOOTHING
}
```
- Raw FFT calculated per frame
- No temporal smoothing between frames
- Result: Jittery, jumpy frequency data

**Impact**:
- Server frequency values jump wildly frame-to-frame
- Causes jittery motion even with exponential smoothing on bass/mid/high
- The 0.7/0.85 smoothing on bass/mid happens AFTER analysis, not during

---

### 2. FFT Magnitude Scaling ⚠️ LIKELY ROOT CAUSE

**Browser** (Web Audio API):
```javascript
analyser.getByteFrequencyData(dataArray);
// Returns values 0-255, automatically scaled by Web Audio API
// Sophisticated normalization and calibration
```

**Server** (renderer.js:100-119):
```javascript
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
                                                              ^^^^
  }

  return frequencyData;
}
```

**Problem**: The `× 15` multiplier is arbitrary
- Web Audio API has sophisticated scaling
- fft.js library outputs raw complex numbers
- Division by `fftSize` normalizes, but then needs scaling
- `× 15` appears to be a guess, likely wrong

**Hypothesis**: If this multiplier is too LOW:
- All frequency values will be weak
- bass/mid/high will be small numbers
- Power curves (bass³, mid^1.5) make them even smaller
- smoothedBass builds up very slowly
- scale stays near 0.15 (minimum)
- rotation barely moves
- distortion rarely triggers
- **Result: Static, boring visual** ✓ Matches observed behavior

---

### 3. Frame Rate Difference

**Browser**:
```javascript
animationId = requestAnimationFrame(animate);  // 60fps
```

**Server** (renderer.js:34):
```javascript
const fps = 30;
```

**Impact**:
- Half the temporal resolution
- Motion appears choppier
- Exponential smoothing updates half as often
  - At 60fps: smoothedBass updates 60 times/second
  - At 30fps: smoothedBass updates 30 times/second
  - Same smoothing factor (0.7) produces different results!

**Frame-rate dependence example**:
```javascript
// At 60fps (16.67ms frames):
smoothedBass = smoothedBass * 0.7 + bass * 0.3;
// Reaches 90% of target in ~10 frames = 166ms

// At 30fps (33.33ms frames):
smoothedBass = smoothedBass * 0.7 + bass * 0.3;
// Reaches 90% of target in ~10 frames = 333ms (2× slower!)
```

---

### 4. Rotation Speed Compensation

**Browser** (AudioVisualizerWebGL.svelte:559):
```javascript
rotation += high * 0.8;
```

**Server** (renderer.js:465):
```javascript
rotation += high * 1.8;  // 2.25× faster
```

**Why this exists**:
- Likely attempting to compensate for 30fps vs 60fps
- Or compensating for weaker `high` values from FFT scaling issue
- But 2.25× is not the right ratio (should be 2× for framerate alone)

**Problem**: If `high` values are already too weak, multiplying by 1.8 doesn't help much

---

### 5. Distortion Parameters

**Browser** (AudioVisualizerWebGL.svelte:553-555):
```javascript
const distortionThreshold = 0.5;
const distortionIntensity = Math.max(0, mid - distortionThreshold) / (1 - distortionThreshold);
const distortionAmount = distortionIntensity * 0.6;
```

**Server** (renderer.js:459-461):
```javascript
const distortionThreshold = 0.3;  // Lower threshold
const distortionIntensity = Math.max(0, mid - distortionThreshold) / (1 - distortionThreshold);
const distortionAmount = distortionIntensity * 0.7;  // Higher multiplier
```

**Why this exists**:
- Lower threshold (0.3 vs 0.5) means distortion triggers earlier
- Higher multiplier (0.7 vs 0.6) means stronger effect
- Both attempt to compensate for weak `mid` values

**Problem**: If `mid` values are below 0.3, neither version triggers distortion

---

## Root Cause Analysis

### Primary Issue: FFT Magnitude Miscalibration

The server's FFT magnitude calculation is likely producing values that are too low compared to Web Audio API.

**Evidence**:
1. Server has higher rotation speed multiplier (1.8 vs 0.8) - compensating
2. Server has lower distortion threshold (0.3 vs 0.5) - compensating
3. Server has higher distortion multiplier (0.7 vs 0.6) - compensating
4. Multiple parameters adjusted suggests core issue upstream

**Test to confirm**:
Add logging to compare raw frequency data:

```javascript
// In browser (AudioVisualizerWebGL.svelte:655):
console.log('Browser raw data:', dataArray.slice(0, 64));

// In server (renderer.js:446):
console.log('Server raw data:', frequencyData.slice(0, 64));
```

Compare the actual values for the same audio.

---

### Secondary Issue: Missing Temporal Smoothing

Web Audio API's `smoothingTimeConstant = 0.8` smooths each FFT bin over time.

Server calculates raw FFT each frame with no bin-level smoothing.

**Impact**: Even with bass/mid/high smoothing, the underlying data is jittery.

**Solution**: Add per-bin exponential smoothing:

```javascript
class AudioAnalyzer {
  constructor(audioPath) {
    this.audioPath = audioPath;
    this.sampleRate = 44100;
    this.fftSize = 256;
    this.frequencyBinCount = this.fftSize / 2;
    this.smoothingConstant = 0.8;  // Match browser
    this.smoothedBins = new Float32Array(this.frequencyBinCount);  // ADD THIS
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
      const rawValue = magnitude * 255 * 15;  // Current scaling

      // ADD TEMPORAL SMOOTHING (match Web Audio API)
      this.smoothedBins[i] = this.smoothedBins[i] * this.smoothingConstant +
                             rawValue * (1 - this.smoothingConstant);

      frequencyData[i] = Math.min(255, Math.floor(this.smoothedBins[i]));
    }

    return frequencyData;
  }
}
```

---

### Tertiary Issue: Frame Rate Mismatch

30fps vs 60fps causes different temporal behavior for exponential smoothing.

**Frame-rate independent smoothing**:

```javascript
// Convert smoothing factor to half-life
function getFrameRateIndependentSmoothing(halfLifeSeconds, fps) {
  const deltaTime = 1 / fps;
  return Math.pow(0.5, deltaTime / halfLifeSeconds);
}

// Usage:
const halfLife = 0.15;  // 150ms half-life (matches browser ~0.7 at 60fps)
const bassSmoothing = getFrameRateIndependentSmoothing(halfLife, 30);  // For 30fps
smoothedBass = smoothedBass * bassSmoothing + bass * (1 - bassSmoothing);
```

---

## Proposed Fixes (Priority Order)

### Fix 1: Recalibrate FFT Magnitude Scaling ⭐ HIGHEST PRIORITY

**Current** (renderer.js:115):
```javascript
frequencyData[i] = Math.min(255, Math.floor(magnitude * 255 * 15));
```

**Fix**: Add logging and empirical calibration:

```javascript
// Step 1: Log raw magnitudes to find typical range
const rawMagnitude = Math.sqrt(real * real + imag * imag);
if (i === 10 && frameNumber % 30 === 0) {  // Log bin 10 every second
  console.log(`Raw magnitude [bin ${i}]: ${rawMagnitude.toFixed(6)}`);
}

// Step 2: After finding typical range, adjust multiplier
// If typical range is 0.001-0.01, and we want 0-255 output:
// multiplier = 255 / typical_max
// Current "15" might need to be 50, or 5, depending on fft.js output
```

**Better approach**: Match Web Audio API's dB scaling:

```javascript
for (let i = 0; i < this.frequencyBinCount; i++) {
  const real = out[i * 2];
  const imag = out[i * 2 + 1];
  const magnitude = Math.sqrt(real * real + imag * imag);

  // Convert to decibels (like Web Audio API)
  const minDb = -100;
  const maxDb = -30;
  const db = 20 * Math.log10(magnitude / this.fftSize + 1e-10);

  // Map dB range to 0-255
  const normalized = (db - minDb) / (maxDb - minDb);
  frequencyData[i] = Math.min(255, Math.max(0, Math.floor(normalized * 255)));
}
```

---

### Fix 2: Add Temporal Smoothing ⭐ HIGH PRIORITY

Add per-bin smoothing to match Web Audio API:

```javascript
class AudioAnalyzer {
  constructor(audioPath) {
    // ... existing code ...
    this.smoothingConstant = 0.8;  // Match browser
    this.smoothedBins = new Float32Array(this.frequencyBinCount);
  }

  performFFT(samples) {
    // ... existing FFT code ...

    for (let i = 0; i < this.frequencyBinCount; i++) {
      const real = out[i * 2];
      const imag = out[i * 2 + 1];
      const magnitude = Math.sqrt(real * real + imag * imag) / this.fftSize;
      const rawValue = magnitude * 255 * CALIBRATED_MULTIPLIER;

      // Temporal smoothing
      this.smoothedBins[i] = this.smoothedBins[i] * this.smoothingConstant +
                             rawValue * (1 - this.smoothingConstant);

      frequencyData[i] = Math.min(255, Math.floor(this.smoothedBins[i]));
    }

    return frequencyData;
  }
}
```

---

### Fix 3: Frame-Rate Independent Motion ⭐ MEDIUM PRIORITY

Adjust smoothing factors for 30fps:

```javascript
// renderer.js:450-451
// OLD:
const bassSmoothing = 0.7;  // Calibrated for 60fps

// NEW:
const halfLife = 0.15;  // 150ms (same visual result as browser)
const bassSmoothing = Math.pow(0.5, (1/30) / halfLife);  // ≈ 0.855 for 30fps
this.smoothedBass = this.smoothedBass * bassSmoothing + bass * (1 - bassSmoothing);
```

---

### Fix 4: Remove Compensation Parameters ⭐ LOW PRIORITY

After fixing FFT scaling, revert compensations:

```javascript
// renderer.js:465
// OLD:
rotation += high * 1.8;  // Compensation

// NEW (after FFT fix):
rotation += high * 0.8;  // Match browser

// renderer.js:459-461
// OLD:
const distortionThreshold = 0.3;  // Compensation
const distortionAmount = distortionIntensity * 0.7;  // Compensation

// NEW (after FFT fix):
const distortionThreshold = 0.5;  // Match browser
const distortionAmount = distortionIntensity * 0.6;  // Match browser
```

---

## Testing Protocol

### Step 1: Add Diagnostic Logging

```javascript
// In renderer.js performFFT():
console.log(`Frame ${frameNumber}: raw magnitude range: ${Math.min(...magnitudes).toFixed(6)} - ${Math.max(...magnitudes).toFixed(6)}`);

// In renderer.js renderFrame():
console.log(`Frame ${frameNumber}: bass=${bass.toFixed(3)}, mid=${mid.toFixed(3)}, high=${high.toFixed(3)}, scale=${scale.toFixed(3)}`);
```

### Step 2: Compare with Browser

Run same audio in browser with logging:

```javascript
// In browser draw():
if (frameNumber % 30 === 0) {
  console.log(`Browser: bass=${bass.toFixed(3)}, mid=${mid.toFixed(3)}, high=${high.toFixed(3)}, scale=${scale.toFixed(3)}`);
}
```

### Step 3: Calibrate Multiplier

Adjust the FFT scaling multiplier until bass/mid/high values match between browser and server.

### Step 4: Visual Comparison

Generate video with calibrated settings and compare to browser visual.

---

## Expected Outcome

After fixes:
- ✅ Server frequency data matches browser ranges
- ✅ bass/mid/high values are similar
- ✅ scale changes are comparable
- ✅ rotation speed is similar
- ✅ distortion triggers at same intensity
- ✅ Visual output is nearly identical

---

*Analysis complete. Root cause is FFT magnitude miscalibration combined with missing temporal smoothing.*

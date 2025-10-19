# Audio Analysis & FFT Deep Dive

**A comprehensive guide to extracting musical features from audio for reactive visualizations**

> **Purpose**: Master the science of converting audio signals into meaningful visual parameters through FFT analysis, feature extraction, and signal processing.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Glossary](#glossary)
3. [Your Current Implementation](#your-current-implementation)
4. [FFT Fundamentals](#fft-fundamentals)
5. [Frequency Binning Strategies](#frequency-binning-strategies)
6. [Audio Features Library](#audio-features-library)
7. [Normalization & Scaling](#normalization--scaling)
8. [Smoothing & Envelopes](#smoothing--envelopes)
9. [Beat & Onset Detection](#beat--onset-detection)
10. [Advanced Analysis Techniques](#advanced-analysis-techniques)
11. [Performance Optimization](#performance-optimization)
12. [Debugging Tools](#debugging-tools)
13. [Common Mistakes](#common-mistakes)
14. [Copy-Paste Snippets](#copy-paste-snippets)
15. [Progression Path](#progression-path)

---

## Quick Start

**Get better audio analysis in 5 minutes:**

### 1. Understand Your Current System
You use **3-band analysis** with Web Audio API:
```javascript
// Lines 504-529 of AudioVisualizerWebGL.svelte
const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
analyserNode.getByteFrequencyData(dataArray);

// Bass: 0-86 Hz (bins 0-10)
// Mid: 86-689 Hz (bins 11-84)
// High: 689-2756 Hz (bins 85-336)
```

### 2. Try This First
**Add adaptive normalization** for consistent response across different songs:

```javascript
// Track running maximum for each band
let maxBass = 0.001;
let maxMid = 0.001;
let maxHigh = 0.001;

// In your analysis loop
maxBass = Math.max(maxBass, bass);
maxMid = Math.max(maxMid, mid);
maxHigh = Math.max(maxHigh, high);

// Slowly decay maximums (5 seconds half-life)
maxBass *= 0.999;
maxMid *= 0.999;
maxHigh *= 0.999;

// Normalize
bass = bass / maxBass;
mid = mid / maxMid;
high = high / maxHigh;
```

### 3. Test With Music
- **Quiet song** → Auto-adjusts to be responsive
- **Loud song** → Auto-scales to prevent clipping
- **Dynamic song** → Adapts in real-time

**Result**: Consistent visual response regardless of song volume or mastering.

---

## Glossary

### Core Concepts

- **FFT (Fast Fourier Transform)**: Algorithm that converts time-domain audio signal into frequency-domain spectrum. Tells you "how much of each frequency is present."
- **Time Domain**: Audio as amplitude over time (what you see in a waveform).
- **Frequency Domain**: Audio as energy per frequency band (what you see in a spectrum analyzer).
- **Bin**: A single frequency range in FFT output. Bin N represents frequencies from N×(sampleRate/FFTSize) to (N+1)×(sampleRate/FFTSize).
- **Sample Rate**: Audio samples per second (typically 44100 Hz or 48000 Hz for music).
- **Nyquist Frequency**: Half the sample rate. Maximum frequency that can be represented (e.g., 22050 Hz for 44100 Hz sample rate).

### FFT Parameters

- **FFT Size**: Number of samples analyzed at once. Must be power of 2 (256, 512, 1024, 2048, etc.). Larger = better frequency resolution but worse time resolution.
- **Frequency Resolution**: sampleRate / FFTSize. How wide each frequency bin is in Hz.
- **Time Resolution**: FFTSize / sampleRate. How long each analysis window is in seconds.
- **Bin Count**: FFTSize / 2. Number of usable frequency bins (FFT produces symmetric output, only use half).
- **Window Function**: Mathematical function applied to audio before FFT to reduce spectral leakage (Hann, Hamming, Blackman, etc.).

### Audio Features

- **RMS (Root Mean Square)**: Overall energy/loudness of signal. Formula: √(Σx²/N).
- **Spectral Centroid**: "Center of mass" of spectrum. Indicates brightness/timbre. Bright sounds = high centroid.
- **Spectral Flux**: Rate of change in spectrum between frames. Measures novelty/onset strength.
- **Zero Crossing Rate (ZCR)**: How often signal crosses zero amplitude. High ZCR = noisy/percussive.
- **Onset**: Sudden increase in energy. Typically corresponds to note attacks, drum hits.
- **Beat**: Regular, periodic onset. Typically kick drum in most music.
- **Tempo (BPM)**: Beats per minute. Derived from inter-beat intervals.

### Signal Processing

- **Normalization**: Scaling values to standard range (typically 0-1).
- **Peak Normalization**: Divide by maximum value.
- **RMS Normalization**: Divide by RMS energy to achieve target loudness.
- **Adaptive Normalization**: Track running maximum and adjust in real-time.
- **Smoothing**: Reducing rapid fluctuations. Makes motion less jittery.
- **Exponential Smoothing**: `output = output × (1-α) + input × α`. Simple, effective.
- **Attack/Release**: Different smoothing rates for rising (attack) vs falling (release) signals.
- **Envelope Follower**: Tracks amplitude contour of signal. Like smoothing but preserves dynamics.

### Musical Terms

- **Sub-Bass**: 20-60 Hz. Felt more than heard. Rare in most music.
- **Bass**: 60-250 Hz. Kick drums, bass guitar, low synths.
- **Low-Mid**: 250-500 Hz. Warmth, body of most instruments.
- **Mid**: 500-2000 Hz. Vocals, guitars, snares.
- **High-Mid**: 2000-4000 Hz. Presence, clarity, definition.
- **High**: 4000-8000 Hz. Brightness, air, cymbals.
- **Very High**: 8000-20000 Hz. Sparkle, hi-hats, breath.
- **Fundamental**: Lowest frequency of a note. Determines perceived pitch.
- **Harmonic**: Integer multiple of fundamental. Determines timbre.

---

## Your Current Implementation

### Complete Code Analysis

**Lines 444-470: Audio Context Setup**
```javascript
// Line 446-448: Create AudioContext
audioContext = new (window.AudioContext || window.webkitAudioContext)();
const source = audioContext.createMediaElementSource(audio);
const analyser = audioContext.createAnalyser();

// Line 452-454: FFT Configuration
analyser.fftSize = 2048;
// This creates 1024 frequency bins (fftSize / 2)
// At 48kHz sample rate: 48000 / 2048 = 23.4 Hz per bin
// Frequency resolution: 23.4 Hz
// Time resolution: 2048 / 48000 = 42.7 ms

analyser.smoothingTimeConstant = 0.8;
// Built-in exponential smoothing: output = 0.8 × old + 0.2 × new
// This is applied BEFORE you get the data

// Line 457: Create data buffer
const dataArray = new Uint8Array(analyser.frequencyBinCount);
// frequencyBinCount = 1024 (half of fftSize)
// Each element is 0-255 (Uint8Array)
```

**Lines 504-529: Frequency Band Extraction**

```javascript
// Line 504-506: Get current frequency data
const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
analyserNode.getByteFrequencyData(dataArray);
// dataArray[i] = 0-255 representing energy in bin i

// Line 508-511: Bass extraction (0-86 Hz)
let bass = 0;
for (let i = 0; i < 11; i++) {
    bass += dataArray[i];
}
bass /= 11;  // Average of bins 0-10
bass /= 255; // Normalize to 0-1

// Why bins 0-10?
// Bin 0: 0-23.4 Hz
// Bin 10: 234-257.4 Hz
// Wait... this is 0-257 Hz, not 0-86 Hz!
// The comment might be outdated, or calculation is approximate

// Line 513-516: Mid extraction (86-689 Hz)
let mid = 0;
for (let i = 11; i < 85; i++) {
    mid += dataArray[i];
}
mid /= 74;   // Average of bins 11-84
mid /= 255;  // Normalize to 0-1

// Bins 11-84 span:
// Bin 11: 257-280 Hz
// Bin 84: 1966-1989 Hz
// Actual range: 257-1989 Hz (much wider than 86-689 Hz)

// Line 518-521: High extraction (689-2756 Hz)
let high = 0;
for (let i = 85; i < 337; i++) {
    high += dataArray[i];
}
high /= 252;  // Average of bins 85-336
high /= 255;  // Normalize to 0-1

// Bins 85-336 span:
// Bin 85: 1989-2012 Hz
// Bin 336: 7862-7885 Hz
// Actual range: 1989-7885 Hz (different from comment)

// Line 524-526: Power curve normalization
bass = Math.pow(bass, 3.0);
mid = Math.pow(mid, 1.0);  // No change (x^1 = x)
high = Math.pow(high, 1.5);

// Why power curves?
// Bass^3: Emphasizes strong bass, suppresses weak bass
//   0.5^3 = 0.125 (weak bass almost disappears)
//   0.8^3 = 0.512 (strong bass stays strong)
// High^1.5: Moderate emphasis
//   0.5^1.5 = 0.354
//   0.8^1.5 = 0.715

// Line 528-529: Exponential smoothing
smoothedBass = smoothedBass * 0.7 + bass * 0.3;
smoothedMid = smoothedMid * 0.85 + mid * 0.15;

// Different smoothing rates:
// Bass: 0.7/0.3 = faster response (30% new value)
// Mid: 0.85/0.15 = slower response (15% new value)
// High: No smoothing applied (immediate response)
```

### Actual Frequency Ranges

Based on typical 48kHz sample rate and fftSize=2048:

| Band | Comment Says | Actually Is | Reason for Difference |
|------|--------------|-------------|----------------------|
| **Bass** | 0-86 Hz | 0-257 Hz | Bins 0-10 × 23.4 Hz/bin = 257 Hz |
| **Mid** | 86-689 Hz | 257-1989 Hz | Bins 11-84 × 23.4 Hz/bin |
| **High** | 689-2756 Hz | 1989-7885 Hz | Bins 85-336 × 23.4 Hz/bin |

**Note**: The actual ranges make more musical sense!
- Bass: 0-257 Hz captures kick drums (40-100 Hz) + low bass (100-250 Hz)
- Mid: 257-1989 Hz captures low-mids, mids, vocals
- High: 1989-7885 Hz captures high-mids, highs, cymbals

### Visual Representation

**FFT Bin Layout**:
```
Sample Rate: 48000 Hz
FFT Size: 2048
Bin Resolution: 23.4 Hz
Bin Count: 1024

Bin#   Frequency Range        Your Band    Musical Content
────────────────────────────────────────────────────────────────
0      0 - 23.4 Hz           ]            Sub-bass rumble
1      23.4 - 46.8 Hz        ]
2      46.8 - 70.2 Hz        ]  BASS      Kick drum fundamental
5      117 - 140 Hz          ]            Bass guitar low notes
10     234 - 257 Hz          ]

11     257 - 280 Hz          ]            Low-mids warmth
20     468 - 491 Hz          ]            Vocals low range
40     936 - 959 Hz          ]  MID       Vocals main range
60     1404 - 1427 Hz        ]            Guitars, snare
84     1966 - 1989 Hz        ]

85     1989 - 2012 Hz        ]            Presence range
100    2340 - 2363 Hz        ]            Vocal clarity
200    4680 - 4703 Hz        ]  HIGH      Cymbals, hi-hats
300    7020 - 7043 Hz        ]            Air, sparkle
336    7862 - 7885 Hz        ]

337+   7885+ Hz              (unused)     Very high frequencies
...
1023   23906 - 23930 Hz      (unused)     Near Nyquist (24kHz)
```

**Smoothing Timeline** (at 60 fps):
```
Bass smoothing (0.7/0.3):
Frame 0:  1.0 → 1.0
Frame 1:  0.0 → 0.3     (30% of change immediate)
Frame 2:  0.0 → 0.21    (70% of 0.3)
Frame 3:  0.0 → 0.147   (decay)
Half-life: ~1.9 frames (32ms)

Mid smoothing (0.85/0.15):
Frame 0:  1.0 → 1.0
Frame 1:  0.0 → 0.15    (15% of change immediate)
Frame 2:  0.0 → 0.1275
Frame 3:  0.0 → 0.1084
Half-life: ~4.3 frames (72ms)
```

**Power Curve Effects**:
```
Input  Bass(x³)  High(x^1.5)
─────  ────────  ───────────
0.0    0.000     0.000
0.1    0.001     0.032
0.2    0.008     0.089
0.3    0.027     0.164
0.4    0.064     0.253
0.5    0.125     0.354      ← Half intensity becomes 1/8 and 1/3
0.6    0.216     0.465
0.7    0.343     0.585
0.8    0.512     0.715
0.9    0.729     0.854
1.0    1.000     1.000

Effect: Suppresses weak signals, preserves strong signals
```

### Strengths of Current Implementation

1. **Simple and Fast**: Linear bin averaging, minimal CPU cost
2. **Musically Relevant**: Actual frequency ranges (not the comments) align with instruments
3. **Different Response Rates**: Bass fast, mid slow, high instant - creates visual variety
4. **Power Curve Emphasis**: Prevents weak signals from cluttering visualization
5. **Built-in Smoothing**: analyser.smoothingTimeConstant provides first layer of stability

### Limitations and Opportunities

**Current Limitations**:
```javascript
// ❌ No adaptive normalization
// Quiet songs = weak response, loud songs = clipping

// ❌ Linear binning in logarithmic frequency space
// Low frequencies over-represented, high frequencies under-represented

// ❌ Simple averaging loses detail
// Multiple instruments in same band = single blurred value

// ❌ No onset/beat detection
// Can't detect kick drum hits specifically

// ❌ No spectral features
// Missing brightness, timbre, harmonic content

// ❌ Fixed frequency ranges
// Can't adapt to different genres or instruments
```

**Improvement Opportunities**:
```javascript
// ✅ Logarithmic binning
// Align with human perception and musical octaves

// ✅ Onset detection
// Detect specific drum hits, note attacks

// ✅ Beat tracking
// Lock effects to musical tempo

// ✅ Spectral centroid
// Map brightness to visual parameters

// ✅ Adaptive normalization
// Consistent response across songs

// ✅ Multi-band expansion
// 10-band or 31-band for detailed control
```

---

## FFT Fundamentals

### What FFT Actually Does

**Time Domain to Frequency Domain**:

```
Time Domain (Waveform):
  Amplitude
     |     /\    /\    /\
     |    /  \  /  \  /  \     "Wave going up and down"
     |___/____\/____\/____\____→ Time
     |        \/    \/

FFT Analysis ↓

Frequency Domain (Spectrum):
  Energy
     |
     |    █
     |    █
     |  █ █ █
     |__█_█_█_____________→ Frequency
       100Hz 200Hz 300Hz    "100Hz wave + 200Hz wave + 300Hz wave"
```

**Mathematical Intuition** (no complex math required):

FFT asks: "How much does this signal look like a sine wave at frequency F?"

For every frequency:
1. Generate a perfect sine wave at that frequency
2. Multiply it with your audio signal
3. Sum the results
4. Large sum = audio contains that frequency
5. Small sum = audio doesn't contain that frequency

Do this for all frequencies → Full spectrum!

### FFT Size Tradeoff

**Frequency Resolution vs Time Resolution**:

```
FFT Size = 256 (Small)
├─ Frequency Resolution: 48000/256 = 187.5 Hz per bin (poor)
├─ Time Resolution: 256/48000 = 5.3 ms (excellent)
├─ Bin Count: 128
└─ Use Case: Rapid transients, percussion, real-time games

FFT Size = 2048 (Your Current)
├─ Frequency Resolution: 48000/2048 = 23.4 Hz per bin (good)
├─ Time Resolution: 2048/48000 = 42.7 ms (good)
├─ Bin Count: 1024
└─ Use Case: Music visualization, balanced

FFT Size = 8192 (Large)
├─ Frequency Resolution: 48000/8192 = 5.9 Hz per bin (excellent)
├─ Time Resolution: 8192/48000 = 170.7 ms (poor)
├─ Bin Count: 4096
└─ Use Case: Precise pitch detection, frequency analysis

FFT Size = 16384 (Very Large)
├─ Frequency Resolution: 48000/16384 = 2.9 Hz per bin (extreme)
├─ Time Resolution: 16384/48000 = 341.3 ms (very poor)
├─ Bin Count: 8192
└─ Use Case: Detailed spectral analysis, not real-time
```

**Visualization**:
```
Time Resolution vs Frequency Resolution:

Small FFT (256):
Time:  |─||─||─||─||─||─||─||─||─|  Fast updates!
Freq:  [────────][────────][────]   Blurry bins

Large FFT (8192):
Time:  |────────────────────────|  Slow updates
Freq:  [─|─|─|─|─|─|─|─|─|─|─|─]   Sharp bins

You (2048):
Time:  |────||────||────||────|    Balanced
Freq:  [───|───|───|───|───|───]   Balanced
```

**Rule of Thumb**: For music visualization, 1024-4096 is ideal.

### Bin Calculation

**Converting Frequency to Bin Number**:

```javascript
function frequencyToBin(frequency, sampleRate, fftSize) {
    return Math.floor(frequency / (sampleRate / fftSize));
}

// Example: Find bin for 440 Hz (A4 note)
const bin = frequencyToBin(440, 48000, 2048);
// Result: Math.floor(440 / 23.4) = 18

// Bin 18 contains frequencies: 421.2 - 444.6 Hz
```

**Converting Bin to Frequency**:

```javascript
function binToFrequency(bin, sampleRate, fftSize) {
    const binWidth = sampleRate / fftSize;
    return bin * binWidth;
}

// Example: What frequency is bin 100?
const freq = binToFrequency(100, 48000, 2048);
// Result: 100 × 23.4 = 2340 Hz
```

**Summing Frequency Range**:

```javascript
function sumFrequencyRange(dataArray, minFreq, maxFreq, sampleRate, fftSize) {
    const minBin = frequencyToBin(minFreq, sampleRate, fftSize);
    const maxBin = frequencyToBin(maxFreq, sampleRate, fftSize);

    let sum = 0;
    for (let i = minBin; i <= maxBin; i++) {
        sum += dataArray[i];
    }

    const count = maxBin - minBin + 1;
    return sum / count / 255; // Average and normalize
}

// Example: Get energy in kick drum range (40-100 Hz)
const kickEnergy = sumFrequencyRange(dataArray, 40, 100, 48000, 2048);
```

### Nyquist Frequency and Aliasing

**Nyquist Limit**: Can only represent frequencies up to sampleRate / 2.

```
Sample Rate: 48000 Hz
Nyquist Frequency: 24000 Hz
Maximum Representable Frequency: 24000 Hz

Sample Rate: 44100 Hz (CD quality)
Nyquist Frequency: 22050 Hz
Maximum Representable Frequency: 22050 Hz

Human Hearing: 20 Hz - 20000 Hz
Both sample rates capture full human range!
```

**Why FFT Size Must Be Power of 2**:

FFT algorithm uses recursive divide-and-conquer:
- Split N samples into two N/2 groups
- Process each half
- Combine results
- Repeat recursively

Only works if you can keep dividing by 2!

Valid: 256, 512, 1024, 2048, 4096, 8192, 16384
Invalid: 100, 1000, 3000, 5000

### Window Functions

**The Problem**: FFT assumes signal repeats infinitely.

```
What FFT Sees (fftSize=8):

Your audio:     ╱╲    ╱╲    ╱╲    ╱
FFT assumes: ╲╱  ╲╱  ╲╱  ╲╱  ╲╱  ╲╱  ← Repeats!

Discontinuity at edges creates "spectral leakage"
(false frequencies appear in analysis)
```

**The Solution**: Window functions taper edges to zero.

```javascript
// Hann Window (most common)
function hannWindow(n, N) {
    return 0.5 * (1 - Math.cos(2 * Math.PI * n / N));
}

// Apply to audio before FFT
for (let i = 0; i < fftSize; i++) {
    const window = hannWindow(i, fftSize);
    audioData[i] *= window;
}

// Visual representation:
Original:  ████████████████   (rectangular)
Hann:          ╱───╲          (bell-shaped)
Applied:       ╱███╲          (tapered edges)
```

**Window Comparison**:

| Window | Shape | Frequency Resolution | Leakage Suppression | Use Case |
|--------|-------|---------------------|---------------------|----------|
| **Rectangular** | Rectangle | Best | Worst | None (don't use) |
| **Hann** | Bell | Good | Good | General purpose |
| **Hamming** | Bell (flatter top) | Good | Better | Narrow peaks |
| **Blackman** | Bell (more taper) | Worse | Best | Wide dynamic range |
| **Flat-Top** | Flat top, steep sides | Worst | Good | Amplitude accuracy |

**Note**: Web Audio API's AnalyserNode doesn't expose window function control. It uses a built-in window (likely Blackman). For custom windowing, you need to use ScriptProcessorNode or AudioWorklet.

---

## Frequency Binning Strategies

### Strategy 1: Linear Binning (Your Current)

**Concept**: Evenly spaced frequency bins.

```
Bin Width: Constant (23.4 Hz for your setup)

0 Hz     500 Hz    1000 Hz   1500 Hz   2000 Hz
├────────┼────────┼────────┼────────┼────────┤
 23.4Hz   23.4Hz   23.4Hz   23.4Hz   23.4Hz

Each bin covers same frequency range.
```

**Advantages**:
- Simple to implement
- Fast computation
- Directly maps to FFT output

**Disadvantages**:
- Doesn't match human perception (we hear logarithmically)
- Wastes bins on low frequencies (already well-resolved)
- Insufficient resolution for high frequencies

**Example Problem**:
```
Bass range (40-100 Hz):
  Bins: 2-4 (only 3 bins!)
  Too few for detail

High range (4000-8000 Hz):
  Bins: 171-342 (171 bins!)
  Wasted resolution (can't hear this detail)
```

### Strategy 2: Logarithmic Binning

**Concept**: Bin width proportional to frequency.

```
Musical Octaves (each octave is 2× frequency):

C1    C2    C3    C4    C5    C6    C7    C8
32Hz  65Hz  131Hz 262Hz 523Hz 1046Hz 2093Hz 4186Hz
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─
  33Hz  66Hz  131Hz 261Hz 523Hz 1047Hz 2093Hz

Bin width doubles each octave!
```

**Implementation**:

```javascript
function getLogBins(dataArray, sampleRate, fftSize, binsPerOctave = 12) {
    const minFreq = 20; // Start of hearing range
    const maxFreq = sampleRate / 2; // Nyquist
    const octaves = Math.log2(maxFreq / minFreq);
    const totalBins = Math.floor(octaves * binsPerOctave);

    const logBins = [];

    for (let i = 0; i < totalBins; i++) {
        // Frequency at this log position
        const freq = minFreq * Math.pow(2, i / binsPerOctave);
        const nextFreq = minFreq * Math.pow(2, (i + 1) / binsPerOctave);

        // Find FFT bins in this range
        const minBin = Math.floor(freq / (sampleRate / fftSize));
        const maxBin = Math.floor(nextFreq / (sampleRate / fftSize));

        // Average energy in this range
        let sum = 0;
        let count = 0;
        for (let b = minBin; b <= maxBin && b < dataArray.length; b++) {
            sum += dataArray[b];
            count++;
        }

        logBins.push(count > 0 ? sum / count / 255 : 0);
    }

    return logBins;
}

// Usage
const logSpectrum = getLogBins(dataArray, 48000, 2048, 12);
// Returns 12 bins per octave (musical semitones)
// ~9 octaves × 12 = 108 bins total
```

**Result**: Matches human perception and musical structure.

### Strategy 3: Perceptual Scales

**Mel Scale** (perceptual pitch):

```javascript
// Frequency to Mel
function freqToMel(freq) {
    return 2595 * Math.log10(1 + freq / 700);
}

// Mel to Frequency
function melToFreq(mel) {
    return 700 * (Math.pow(10, mel / 2595) - 1);
}

// Create Mel-spaced bins
function getMelBins(dataArray, sampleRate, fftSize, numBins = 40) {
    const maxFreq = sampleRate / 2;
    const maxMel = freqToMel(maxFreq);

    const melBins = [];

    for (let i = 0; i < numBins; i++) {
        const melStart = (i / numBins) * maxMel;
        const melEnd = ((i + 1) / numBins) * maxMel;

        const freqStart = melToFreq(melStart);
        const freqEnd = melToFreq(melEnd);

        const binStart = Math.floor(freqStart / (sampleRate / fftSize));
        const binEnd = Math.floor(freqEnd / (sampleRate / fftSize));

        let sum = 0;
        let count = 0;
        for (let b = binStart; b <= binEnd && b < dataArray.length; b++) {
            sum += dataArray[b];
            count++;
        }

        melBins.push(count > 0 ? sum / count / 255 : 0);
    }

    return melBins;
}
```

**Bark Scale** (critical bands):

```javascript
// 24 critical bands matching ear's frequency resolution
function freqToBark(freq) {
    return 13 * Math.atan(0.00076 * freq) + 3.5 * Math.atan(Math.pow(freq / 7500, 2));
}

function barkToFreq(bark) {
    // Approximate inverse (complex exact formula)
    return 1960 / (26.81 / (bark + 0.53) - 1);
}

// Similar implementation to Mel bins
```

### Strategy 4: Musical Binning

**Concept**: Align bins with musical notes and instruments.

```javascript
const musicalBands = {
    subBass: { min: 20, max: 60 },      // Felt, not heard
    bass: { min: 60, max: 250 },        // Kick, bass guitar
    lowMid: { min: 250, max: 500 },     // Warmth, body
    mid: { min: 500, max: 2000 },       // Vocals, melody
    highMid: { min: 2000, max: 4000 },  // Presence, clarity
    high: { min: 4000, max: 8000 },     // Air, cymbals
    veryHigh: { min: 8000, max: 20000 } // Sparkle, shimmer
};

function getMusicalBins(dataArray, sampleRate, fftSize) {
    const bins = {};

    for (const [name, range] of Object.entries(musicalBands)) {
        const value = sumFrequencyRange(
            dataArray,
            range.min,
            range.max,
            sampleRate,
            fftSize
        );
        bins[name] = value;
    }

    return bins;
}

// Usage
const music = getMusicalBins(dataArray, 48000, 2048);
console.log(music.bass);      // Kick drum energy
console.log(music.mid);       // Vocal energy
console.log(music.high);      // Cymbal energy
```

### Strategy 5: Instrument-Specific Binning

**Target specific instruments**:

```javascript
const instrumentRanges = {
    // Percussion
    kickDrum: { min: 40, max: 100 },
    snare: { min: 150, max: 250 },
    hiHat: { min: 6000, max: 12000 },
    crash: { min: 8000, max: 16000 },

    // Bass
    bassGuitar: { min: 40, max: 400 },
    synthBass: { min: 30, max: 500 },

    // Mids
    acousticGuitar: { min: 80, max: 1200 },
    electricGuitar: { min: 80, max: 5000 },
    piano: { min: 27, max: 4200 },

    // Vocals
    maleVocal: { min: 100, max: 900 },
    femaleVocal: { min: 200, max: 1200 },
    vocalPresence: { min: 2000, max: 5000 },

    // Synths
    synthLead: { min: 500, max: 8000 },
    synthPad: { min: 100, max: 2000 },

    // Overall
    rumble: { min: 20, max: 40 },
    clarity: { min: 4000, max: 8000 },
    air: { min: 10000, max: 20000 }
};

// Get energy for specific instrument
function getInstrumentEnergy(dataArray, instrument, sampleRate, fftSize) {
    const range = instrumentRanges[instrument];
    if (!range) throw new Error(`Unknown instrument: ${instrument}`);

    return sumFrequencyRange(dataArray, range.min, range.max, sampleRate, fftSize);
}

// Usage - map specific instruments to visual parameters
const kickEnergy = getInstrumentEnergy(dataArray, 'kickDrum', 48000, 2048);
const vocalEnergy = getInstrumentEnergy(dataArray, 'femaleVocal', 48000, 2048);

// Use kick for pulsing, vocals for color
scale = 0.5 + kickEnergy * 0.5;
hue = (baseHue + vocalEnergy * 60) % 360;
```

### Binning Strategy Comparison

| Strategy | Bins | Resolution Distribution | Use Case |
|----------|------|------------------------|----------|
| **Linear** (yours) | 1024 | Even across spectrum | Simple, fast |
| **Logarithmic** | 108 (12/oct) | Dense bass, sparse high | Musical, perceptual |
| **Mel** | 40 | Perceptually uniform | Speech, ML models |
| **Bark** | 24 | Matches ear's critical bands | Psychoacoustics |
| **Musical** | 7 | Instrument-aligned | Genre-specific |
| **Instrument** | Custom | Targeted | Specific element tracking |

---

## Audio Features Library

### Feature 1: RMS Energy

**Definition**: Overall loudness/energy of signal.

```javascript
class RMSEnergy {
    calculate(dataArray) {
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const normalized = dataArray[i] / 255;
            sumSquares += normalized * normalized;
        }
        return Math.sqrt(sumSquares / dataArray.length);
    }
}

// Usage
const rms = new RMSEnergy();
const energy = rms.calculate(dataArray);
// Range: 0-1, represents overall loudness
```

**Use Cases**:
- Overall brightness/intensity
- Fade in/out detection
- Dynamic range compression
- Trigger effects on loud sections

### Feature 2: Spectral Centroid

**Definition**: "Center of mass" of spectrum. Indicates brightness/timbre.

```javascript
class SpectralCentroid {
    calculate(dataArray, sampleRate, fftSize) {
        let numerator = 0;
        let denominator = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const frequency = i * sampleRate / fftSize;
            const magnitude = dataArray[i] / 255;

            numerator += frequency * magnitude;
            denominator += magnitude;
        }

        return denominator > 0 ? numerator / denominator : 0;
    }
}

// Usage
const centroid = new SpectralCentroid();
const brightness = centroid.calculate(dataArray, 48000, 2048);
// Range: 0-24000 Hz (low = dark/warm, high = bright/harsh)

// Normalize to 0-1
const normalizedBrightness = brightness / 10000; // Typical music ~2000-8000 Hz
```

**Use Cases**:
- Map brightness to color temperature
- Detect timbre changes (acoustic→electric)
- Identify instrument changes
- Create "sparkle" effects on bright sounds

**Visual Meaning**:
```
Dark/Warm Sound (low centroid):
  Energy
    |  █
    |  █ █
    |  █ █ █
    └─────────→ Frequency
    Low  Mid  High

Bright/Harsh Sound (high centroid):
  Energy
    |        █
    |      █ █
    |  █ █ █ █
    └─────────→ Frequency
    Low  Mid  High
```

### Feature 3: Spectral Flux

**Definition**: Rate of change in spectrum. Measures novelty/onset strength.

```javascript
class SpectralFlux {
    constructor() {
        this.previousSpectrum = null;
    }

    calculate(dataArray) {
        if (!this.previousSpectrum) {
            this.previousSpectrum = new Float32Array(dataArray);
            return 0;
        }

        let flux = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const diff = (dataArray[i] / 255) - (this.previousSpectrum[i] / 255);
            // Only sum positive differences (increases in energy)
            flux += Math.max(0, diff);
        }

        this.previousSpectrum.set(dataArray);
        return flux / dataArray.length;
    }
}

// Usage
const flux = new SpectralFlux();

// In animation loop
const novelty = flux.calculate(dataArray);
// Range: 0-1, spikes on note attacks, drum hits

// Trigger flash effect on high novelty
if (novelty > 0.3) {
    flashIntensity = 1.0;
}
```

**Use Cases**:
- Onset detection (note attacks)
- Beat detection (drum hits)
- Scene change detection
- Trigger particle bursts

### Feature 4: Zero Crossing Rate

**Definition**: How often signal crosses zero amplitude.

**Note**: Requires time-domain data, not frequency-domain. Use `getByteTimeDomainData()` instead.

```javascript
class ZeroCrossingRate {
    calculate(timeDomainData) {
        let crossings = 0;

        for (let i = 1; i < timeDomainData.length; i++) {
            const prev = timeDomainData[i - 1] - 128; // Center at 0
            const curr = timeDomainData[i] - 128;

            if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
                crossings++;
            }
        }

        return crossings / timeDomainData.length;
    }
}

// Usage
const timeDomainData = new Uint8Array(analyserNode.fftSize);
analyserNode.getByteTimeDomainData(timeDomainData);

const zcr = new ZeroCrossingRate();
const rate = zcr.calculate(timeDomainData);
// Range: 0-1 (low = tonal, high = noisy/percussive)

// Use for detecting hi-hats, white noise, distortion
if (rate > 0.4) {
    // Likely percussive or noisy sound
    addGrainTexture = true;
}
```

### Feature 5: Spectral Rolloff

**Definition**: Frequency below which X% of spectral energy exists.

```javascript
class SpectralRolloff {
    calculate(dataArray, sampleRate, fftSize, percentile = 0.85) {
        let totalEnergy = 0;
        for (let i = 0; i < dataArray.length; i++) {
            totalEnergy += dataArray[i];
        }

        const threshold = totalEnergy * percentile;
        let cumulativeEnergy = 0;

        for (let i = 0; i < dataArray.length; i++) {
            cumulativeEnergy += dataArray[i];
            if (cumulativeEnergy >= threshold) {
                return i * sampleRate / fftSize;
            }
        }

        return sampleRate / 2; // Nyquist
    }
}

// Usage
const rolloff = new SpectralRolloff();
const freq = rolloff.calculate(dataArray, 48000, 2048);
// Range: 0-24000 Hz (low = bass-heavy, high = bright)
```

**Use Cases**:
- Similar to centroid but more robust
- Genre classification
- Brightness measure
- Filter parameter control

### Feature 6: Peak Frequency

**Definition**: Frequency with highest energy.

```javascript
class PeakFrequency {
    calculate(dataArray, sampleRate, fftSize) {
        let maxBin = 0;
        let maxValue = 0;

        for (let i = 0; i < dataArray.length; i++) {
            if (dataArray[i] > maxValue) {
                maxValue = dataArray[i];
                maxBin = i;
            }
        }

        return {
            frequency: maxBin * sampleRate / fftSize,
            magnitude: maxValue / 255,
            bin: maxBin
        };
    }
}

// Usage
const peakFinder = new PeakFrequency();
const peak = peakFinder.calculate(dataArray, 48000, 2048);

console.log(`Dominant frequency: ${peak.frequency} Hz`);
console.log(`Strength: ${peak.magnitude}`);

// Map peak frequency to hue
const hue = (peak.frequency / 24000) * 360; // 0-360°
```

### Feature 7: Spectral Flatness

**Definition**: How noise-like vs tone-like the signal is.

```javascript
class SpectralFlatness {
    calculate(dataArray) {
        let geometricMean = 0;
        let arithmeticMean = 0;
        let count = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const value = dataArray[i] / 255 + 1e-10; // Avoid log(0)
            geometricMean += Math.log(value);
            arithmeticMean += value;
            count++;
        }

        geometricMean = Math.exp(geometricMean / count);
        arithmeticMean = arithmeticMean / count;

        return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
    }
}

// Usage
const flatness = new SpectralFlatness();
const noisy = flatness.calculate(dataArray);
// Range: 0-1 (0 = pure tone, 1 = white noise)

// Use for detecting noise vs music
if (noisy < 0.1) {
    // Musical, tonal
    colorSaturation = 100;
} else {
    // Noisy, percussive
    colorSaturation = 50; // Desaturate
}
```

### Feature 8: Frequency Band Ratios

**Definition**: Relative energy between frequency bands.

```javascript
class BandRatios {
    calculate(dataArray, sampleRate, fftSize) {
        const bass = sumFrequencyRange(dataArray, 20, 250, sampleRate, fftSize);
        const mid = sumFrequencyRange(dataArray, 250, 4000, sampleRate, fftSize);
        const high = sumFrequencyRange(dataArray, 4000, 20000, sampleRate, fftSize);

        const total = bass + mid + high + 1e-10;

        return {
            bassRatio: bass / total,      // 0-1
            midRatio: mid / total,        // 0-1
            highRatio: high / total,      // 0-1
            bassToHigh: bass / (high + 1e-10),  // >1 = bass-heavy
            midToRest: mid / (bass + high + 1e-10) // >1 = mid-focused
        };
    }
}

// Usage
const ratios = new BandRatios();
const balance = ratios.calculate(dataArray, 48000, 2048);

// Genre detection
if (balance.bassRatio > 0.6) {
    console.log('Bass-heavy (EDM, Hip-Hop)');
} else if (balance.midRatio > 0.5) {
    console.log('Mid-focused (Vocals, Rock)');
} else {
    console.log('Balanced (Classical, Jazz)');
}

// Adapt visualization to genre
if (balance.bassToHigh > 2) {
    // Bass-heavy: Use warm colors, slow movement
    baseHue = 0; // Red
    smoothingFactor = 0.85;
} else if (balance.bassToHigh < 0.5) {
    // Treble-heavy: Use cool colors, fast movement
    baseHue = 200; // Blue
    smoothingFactor = 0.5;
}
```

---

## Normalization & Scaling

### Problem: Varying Audio Levels

**Challenge**: Different songs have vastly different loudness.

```
Quiet acoustic song:    Max amplitude = 0.3
Loudly mastered EDM:    Max amplitude = 0.99

Using same threshold:
  Quiet song → Weak visual response
  Loud song → Constant maxed-out visuals
```

### Solution 1: Peak Normalization

**Concept**: Divide by maximum value observed.

```javascript
class PeakNormalizer {
    constructor(decayFactor = 0.9999) {
        this.peak = 0.001;
        this.decayFactor = decayFactor;
    }

    normalize(value) {
        // Update peak
        this.peak = Math.max(this.peak, value);

        // Slowly decay peak (adapts to quieter sections)
        this.peak *= this.decayFactor;

        // Prevent division by zero
        this.peak = Math.max(this.peak, 0.001);

        // Normalize
        return Math.min(1, value / this.peak);
    }
}

// Usage - separate normalizer for each band
const bassNorm = new PeakNormalizer(0.9999);
const midNorm = new PeakNormalizer(0.9999);
const highNorm = new PeakNormalizer(0.9999);

// In analysis loop
let normalizedBass = bassNorm.normalize(bass);
let normalizedMid = midNorm.normalize(mid);
let normalizedHigh = highNorm.normalize(high);
```

**Decay Rate Guide**:
```
Decay Factor    Half-Life (60fps)    Use Case
──────────────────────────────────────────────
0.99            69 frames (1.2s)     Fast adaptation
0.999           693 frames (11.5s)   Balanced
0.9999          6931 frames (115s)   Slow, stable
0.99999         69315 frames (19m)   Very stable
```

### Solution 2: RMS Normalization

**Concept**: Normalize to target RMS level.

```javascript
class RMSNormalizer {
    constructor(targetRMS = 0.3) {
        this.targetRMS = targetRMS;
        this.currentRMS = 0.001;
        this.alpha = 0.01; // Smoothing factor
    }

    normalize(value, currentRMS) {
        // Update smoothed RMS
        this.currentRMS = this.currentRMS * (1 - this.alpha) + currentRMS * this.alpha;

        // Calculate gain to achieve target RMS
        const gain = this.targetRMS / Math.max(this.currentRMS, 0.001);

        // Limit gain to prevent over-amplification
        const limitedGain = Math.min(gain, 10);

        return value * limitedGain;
    }
}

// Usage
const rmsNorm = new RMSNormalizer(0.3);
const rmsCalc = new RMSEnergy();

// In analysis loop
const currentRMS = rmsCalc.calculate(dataArray);
const normalizedBass = rmsNorm.normalize(bass, currentRMS);
```

### Solution 3: Adaptive Range Normalization

**Concept**: Track min and max, normalize to 0-1 range.

```javascript
class AdaptiveRangeNormalizer {
    constructor() {
        this.min = 1.0;
        this.max = 0.0;
        this.decayRate = 0.9995;
    }

    normalize(value) {
        // Update range
        this.min = Math.min(this.min, value);
        this.max = Math.max(this.max, value);

        // Decay toward center (allows range to shrink)
        const center = (this.min + this.max) / 2;
        this.min = this.min * this.decayRate + center * (1 - this.decayRate);
        this.max = this.max * this.decayRate + center * (1 - this.decayRate);

        // Ensure minimum range
        const range = Math.max(this.max - this.min, 0.01);

        // Normalize
        return (value - this.min) / range;
    }
}
```

### Solution 4: Percentile Normalization

**Concept**: Normalize based on Nth percentile (robust to outliers).

```javascript
class PercentileNormalizer {
    constructor(percentile = 0.95, historySize = 300) {
        this.percentile = percentile;
        this.history = [];
        this.historySize = historySize;
    }

    normalize(value) {
        // Add to history
        this.history.push(value);
        if (this.history.length > this.historySize) {
            this.history.shift();
        }

        // Find percentile value
        const sorted = [...this.history].sort((a, b) => a - b);
        const index = Math.floor(sorted.length * this.percentile);
        const percentileValue = sorted[index] || 0.001;

        // Normalize
        return Math.min(1, value / percentileValue);
    }
}

// Usage - 95th percentile becomes 1.0
const norm = new PercentileNormalizer(0.95, 300);
// Ignores brief loud spikes (top 5%)
```

### Power Curve Revisited

**Your Current Implementation**:
```javascript
bass = Math.pow(bass, 3.0);  // x³
high = Math.pow(high, 1.5);  // x^1.5
```

**Why This Works**: Emphasizes strong signals, suppresses weak ones.

**Mathematical Effect**:

```
f(x) = x^n

n < 1: Expands (boosts weak signals)
n = 1: Linear (no change)
n > 1: Compresses (suppresses weak signals)

Examples:
  x^0.5 (sqrt): Boosts weak (0.25 → 0.5, 0.5 → 0.71)
  x^1.0 (linear): No change
  x^2.0: Moderate compression (0.5 → 0.25)
  x^3.0: Strong compression (0.5 → 0.125)
  x^4.0: Extreme compression (0.5 → 0.0625)
```

**Custom Power Curves for Different Needs**:

```javascript
// Gentle emphasis (subtle)
value = Math.pow(value, 1.2);

// Medium emphasis (balanced)
value = Math.pow(value, 2.0);

// Strong emphasis (your bass)
value = Math.pow(value, 3.0);

// Extreme emphasis (only strong signals)
value = Math.pow(value, 5.0);

// Expansion (boost weak signals)
value = Math.pow(value, 0.5);

// Gentle expansion
value = Math.pow(value, 0.8);
```

**Threshold-Based Power Curve**:

```javascript
function thresholdPowerCurve(value, threshold = 0.3, belowExp = 0.5, aboveExp = 2.0) {
    if (value < threshold) {
        // Below threshold: expand (boost weak signals)
        const normalized = value / threshold;
        return Math.pow(normalized, belowExp) * threshold;
    } else {
        // Above threshold: compress (control strong signals)
        const normalized = (value - threshold) / (1 - threshold);
        return threshold + Math.pow(normalized, aboveExp) * (1 - threshold);
    }
}

// Example: Boost quiet passages, control loud ones
const processed = thresholdPowerCurve(bass, 0.3, 0.5, 2.0);
```

---

## Smoothing & Envelopes

### Your Current Smoothing

**Exponential Smoothing (Lines 528-529)**:

```javascript
smoothedBass = smoothedBass * 0.7 + bass * 0.3;
smoothedMid = smoothedMid * 0.85 + mid * 0.15;
```

**Formula**: `y[n] = y[n-1] × (1-α) + x[n] × α`

Where α = mixing coefficient (0-1)

**Characteristics**:

```
α = 0.3 (bass):
  - 30% new value, 70% old value
  - Faster response
  - Half-life: ~1.9 frames (32ms at 60fps)

α = 0.15 (mid):
  - 15% new value, 85% old value
  - Slower response
  - Half-life: ~4.3 frames (72ms at 60fps)

α = 1.0 (high, no smoothing):
  - 100% new value
  - Instant response
  - No lag
```

**Half-Life Calculation**:

```javascript
function alphaFromHalfLife(halfLifeFrames) {
    return 1 - Math.pow(0.5, 1 / halfLifeFrames);
}

function halfLifeFromAlpha(alpha) {
    return -1 / Math.log2(1 - alpha);
}

// Examples:
alphaFromHalfLife(5);  // 0.129 (5 frames to half)
halfLifeFromAlpha(0.3); // 1.94 frames
```

### Attack/Release Envelopes

**Concept**: Different smoothing for rising vs falling signals.

```javascript
class AttackRelease {
    constructor(attackTime = 0.1, releaseTime = 0.3) {
        this.attackAlpha = attackTime;
        this.releaseAlpha = releaseTime;
        this.value = 0;
    }

    process(input) {
        const alpha = input > this.value ? this.attackAlpha : this.releaseAlpha;
        this.value = this.value * (1 - alpha) + input * alpha;
        return this.value;
    }
}

// Usage
const bassEnv = new AttackRelease(0.3, 0.1);
// Fast attack (0.3) = responds quickly to hits
// Slow release (0.1) = holds value longer

// In analysis loop
const smoothedBass = bassEnv.process(bass);
```

**Visual Representation**:

```
Input Signal (bass hits):
  1.0 |    █     █     █
      |   ███   ███   ███
  0.5 |  █████ █████ █████
  0.0 |▁▁█████▁█████▁█████

Fast Attack, Slow Release:
  1.0 |   ▄▀▀▄  ▄▀▀▄  ▄▀▀▄
      |  ▄▀  ▀▄▄▀  ▀▄▄▀  ▀▄
  0.5 | ▄▀            ▀▄
  0.0 |▀                ▀

Slow Attack, Fast Release:
  1.0 |     ▄▖    ▄▖    ▄▖
      |    ▄▀▚   ▄▀▚   ▄▀▚
  0.5 |   ▄▀ ▝▄ ▄▀ ▝▄ ▄▀ ▝▄
  0.0 |▁▁▀     ▀     ▀     ▀
```

**Use Cases**:

| Attack | Release | Effect | Use For |
|--------|---------|--------|---------|
| Fast | Slow | Punchy, sustained | Bass drums, impacts |
| Slow | Fast | Gradual rise, quick fall | Buildups, risers |
| Fast | Fast | Responsive, jittery | Hi-hats, fast percussion |
| Slow | Slow | Smooth, laggy | Ambient, pads |

### Ballistics

**Concept**: Peak detection with different rise/fall rates.

```javascript
class PeakFollower {
    constructor(riseTime = 0.0, fallTime = 0.01) {
        this.riseAlpha = riseTime;
        this.fallAlpha = fallTime;
        this.peak = 0;
    }

    process(input) {
        if (input > this.peak) {
            // Instant rise (or fast)
            this.peak = this.peak * (1 - this.riseAlpha) + input * this.riseAlpha;
        } else {
            // Slow fall
            this.peak = this.peak * (1 - this.fallAlpha) + input * this.fallAlpha;
        }
        return this.peak;
    }
}

// Usage - VU meter style
const peakMeter = new PeakFollower(1.0, 0.02);
// Instant rise, slow fall (holds peaks briefly)

const peakLevel = peakMeter.process(bass);
// Shows peak energy, decays slowly
```

### One-Pole Filter (Alternative Formulation)

**Your current smoothing is a one-pole lowpass filter**:

```javascript
class OnePoleFilter {
    constructor(cutoffFreq, sampleRate = 60) {
        // Convert cutoff frequency to alpha
        const omega = 2 * Math.PI * cutoffFreq / sampleRate;
        this.alpha = omega / (omega + 1);
        this.value = 0;
    }

    process(input) {
        this.value = this.value * (1 - this.alpha) + input * this.alpha;
        return this.value;
    }
}

// Usage
const bassFilter = new OnePoleFilter(5); // 5 Hz cutoff at 60fps
// Removes fluctuations faster than 5Hz
```

### Multi-Stage Smoothing

**Concept**: Apply smoothing multiple times for different time scales.

```javascript
class MultiStageSmooth {
    constructor(stages = [0.3, 0.1, 0.05]) {
        this.stages = stages.map(alpha => ({ alpha, value: 0 }));
    }

    process(input) {
        let output = input;
        for (const stage of this.stages) {
            stage.value = stage.value * (1 - stage.alpha) + output * stage.alpha;
            output = stage.value;
        }
        return output;
    }
}

// Usage - three stages of smoothing
const multiSmooth = new MultiStageSmooth([0.3, 0.1, 0.05]);
// Creates very smooth output with minimal lag
```

---

## Beat & Onset Detection

### Simple Beat Detector (Energy-Based)

**Concept**: Beat occurs when energy exceeds recent average.

```javascript
class SimpleBeatDetector {
    constructor(threshold = 1.4, historySize = 43) {
        this.threshold = threshold;
        this.history = [];
        this.historySize = historySize;
        this.lastBeatTime = 0;
        this.minInterval = 200; // Min 200ms between beats (max 300 BPM)
    }

    detectBeat(energy) {
        // Calculate average of recent history
        const avg = this.history.length > 0
            ? this.history.reduce((a, b) => a + b, 0) / this.history.length
            : 0;

        // Add current energy to history
        this.history.push(energy);
        if (this.history.length > this.historySize) {
            this.history.shift();
        }

        // Check if current energy exceeds threshold
        const now = performance.now();
        const timeSinceLastBeat = now - this.lastBeatTime;

        const isBeat =
            energy > avg * this.threshold &&
            energy > 0.3 && // Minimum absolute threshold
            timeSinceLastBeat > this.minInterval;

        if (isBeat) {
            this.lastBeatTime = now;
        }

        return {
            isBeat,
            strength: Math.max(0, energy - avg),
            confidence: avg > 0 ? energy / avg : 0
        };
    }
}

// Usage
const beatDetector = new SimpleBeatDetector(1.4, 43);

// In analysis loop
const beat = beatDetector.detectBeat(smoothedBass);

if (beat.isBeat) {
    console.log(`Beat detected! Strength: ${beat.strength}`);
    // Trigger visual effect
    flashIntensity = 1.0;
    scale = 1.5;
}
```

**Parameters Explained**:

```
threshold: 1.4
  - Beat energy must be 1.4× average
  - Lower (1.2) = more sensitive (more false positives)
  - Higher (1.8) = less sensitive (may miss beats)

historySize: 43 frames
  - At 60fps: 43 frames = 716ms history
  - Covers ~1.4 beats at 120 BPM
  - Larger = more stable, slower adaptation
  - Smaller = faster adaptation, more false positives

minInterval: 200ms
  - Prevents detecting same beat multiple times
  - 200ms = 300 BPM maximum
  - Adjust based on expected tempo range
```

### Spectral Flux Beat Detector

**Concept**: Use onset detection (spectral flux) for beat detection.

```javascript
class SpectralFluxBeatDetector {
    constructor(threshold = 0.15) {
        this.flux = new SpectralFlux();
        this.detector = new SimpleBeatDetector(1.3, 30);
    }

    detectBeat(dataArray) {
        const fluxValue = this.flux.calculate(dataArray);
        return this.detector.detectBeat(fluxValue);
    }
}

// Usage - more accurate for complex music
const fluxBeat = new SpectralFluxBeatDetector();
const beat = fluxBeat.detectBeat(dataArray);
```

### Multi-Band Beat Detection

**Concept**: Detect beats in different frequency ranges.

```javascript
class MultiBandBeatDetector {
    constructor() {
        this.bassDetector = new SimpleBeatDetector(1.5, 43);
        this.snareDetector = new SimpleBeatDetector(1.4, 30);
        this.hihatDetector = new SimpleBeatDetector(1.3, 20);
    }

    detectBeats(dataArray, sampleRate, fftSize) {
        const bassEnergy = sumFrequencyRange(dataArray, 40, 100, sampleRate, fftSize);
        const snareEnergy = sumFrequencyRange(dataArray, 150, 250, sampleRate, fftSize);
        const hihatEnergy = sumFrequencyRange(dataArray, 6000, 12000, sampleRate, fftSize);

        return {
            kick: this.bassDetector.detectBeat(bassEnergy),
            snare: this.snareDetector.detectBeat(snareEnergy),
            hihat: this.hihatDetector.detectBeat(hihatEnergy)
        };
    }
}

// Usage
const multiDetector = new MultiBandBeatDetector();
const beats = multiDetector.detectBeats(dataArray, 48000, 2048);

if (beats.kick.isBeat) {
    // Kick drum hit → Big scale pulse
    scale = 1.5;
}

if (beats.snare.isBeat) {
    // Snare hit → Color flash
    saturation = 100;
}

if (beats.hihat.isBeat) {
    // Hi-hat → Small sparkle
    glowIntensity = 0.8;
}
```

### Tempo Estimation

**Concept**: Measure time between beats to estimate BPM.

```javascript
class TempoEstimator {
    constructor(historySize = 8) {
        this.beatTimes = [];
        this.historySize = historySize;
    }

    onBeat() {
        const now = performance.now();
        this.beatTimes.push(now);

        if (this.beatTimes.length > this.historySize) {
            this.beatTimes.shift();
        }
    }

    estimateTempo() {
        if (this.beatTimes.length < 2) return null;

        // Calculate intervals
        const intervals = [];
        for (let i = 1; i < this.beatTimes.length; i++) {
            intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
        }

        // Average interval
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

        // Convert to BPM
        const bpm = 60000 / avgInterval;

        // Confidence (based on variance)
        const variance = intervals.reduce((sum, interval) => {
            return sum + Math.pow(interval - avgInterval, 2);
        }, 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        const confidence = Math.max(0, 1 - stdDev / avgInterval);

        return { bpm, confidence, interval: avgInterval };
    }
}

// Usage
const tempoEst = new TempoEstimator();
const beatDetector = new SimpleBeatDetector();

// In analysis loop
const beat = beatDetector.detectBeat(smoothedBass);
if (beat.isBeat) {
    tempoEst.onBeat();
}

const tempo = tempoEst.estimateTempo();
if (tempo && tempo.confidence > 0.8) {
    console.log(`Tempo: ${tempo.bpm.toFixed(1)} BPM`);

    // Sync visual effects to tempo
    const beatPeriod = tempo.interval / 1000; // seconds
    const rotationSpeed = (2 * Math.PI) / beatPeriod; // radians per second
}
```

---

## Advanced Analysis Techniques

### Technique 1: Frequency Tracking

**Concept**: Track specific frequency peaks over time.

```javascript
class FrequencyTracker {
    constructor(targetFreq, bandwidth = 50) {
        this.targetFreq = targetFreq;
        this.bandwidth = bandwidth;
        this.history = [];
        this.maxHistory = 30;
    }

    track(dataArray, sampleRate, fftSize) {
        const minFreq = this.targetFreq - this.bandwidth;
        const maxFreq = this.targetFreq + this.bandwidth;

        const energy = sumFrequencyRange(dataArray, minFreq, maxFreq, sampleRate, fftSize);

        this.history.push(energy);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        // Calculate trend
        const recent = this.history.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const older = this.history.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
        const trend = recent - older; // Positive = increasing

        return {
            energy,
            trend,
            isIncreasing: trend > 0,
            history: this.history
        };
    }
}

// Usage - track kick drum fundamental (60Hz)
const kickTracker = new FrequencyTracker(60, 30);

const kickData = kickTracker.track(dataArray, 48000, 2048);
if (kickData.energy > 0.7 && kickData.isIncreasing) {
    // Kick drum onset
}
```

### Technique 2: Harmonic Analysis

**Concept**: Detect harmonically related frequencies.

```javascript
class HarmonicAnalyzer {
    constructor(fundamentalFreq) {
        this.fundamental = fundamentalFreq;
    }

    analyze(dataArray, sampleRate, fftSize, numHarmonics = 8) {
        const harmonics = [];

        for (let n = 1; n <= numHarmonics; n++) {
            const harmonicFreq = this.fundamental * n;
            const bin = Math.floor(harmonicFreq / (sampleRate / fftSize));

            if (bin < dataArray.length) {
                harmonics.push({
                    harmonic: n,
                    frequency: harmonicFreq,
                    magnitude: dataArray[bin] / 255
                });
            }
        }

        // Calculate harmonic energy ratio
        const fundamentalEnergy = harmonics[0]?.magnitude || 0;
        const totalHarmonicEnergy = harmonics.reduce((sum, h) => sum + h.magnitude, 0);

        return {
            harmonics,
            fundamentalEnergy,
            totalHarmonicEnergy,
            harmonicRatio: totalHarmonicEnergy > 0 ? fundamentalEnergy / totalHarmonicEnergy : 0
        };
    }
}

// Usage - analyze 440Hz (A4 note)
const harmonicAnalyzer = new HarmonicAnalyzer(440);
const analysis = harmonicAnalyzer.analyze(dataArray, 48000, 2048);

console.log('Harmonics:', analysis.harmonics);
// [{ harmonic: 1, frequency: 440, magnitude: 0.8 },
//  { harmonic: 2, frequency: 880, magnitude: 0.4 },
//  { harmonic: 3, frequency: 1320, magnitude: 0.2 }, ...]
```

### Technique 3: Onset Strength Function

**Concept**: Sophisticated onset detection using multiple features.

```javascript
class OnsetStrength {
    constructor() {
        this.flux = new SpectralFlux();
        this.prevEnergy = 0;
        this.prevCentroid = 0;
    }

    calculate(dataArray, sampleRate, fftSize) {
        // Feature 1: Spectral flux
        const flux = this.flux.calculate(dataArray);

        // Feature 2: Energy increase
        const energy = new RMSEnergy().calculate(dataArray);
        const energyDelta = Math.max(0, energy - this.prevEnergy);
        this.prevEnergy = energy;

        // Feature 3: Centroid shift
        const centroid = new SpectralCentroid().calculate(dataArray, sampleRate, fftSize);
        const centroidDelta = Math.abs(centroid - this.prevCentroid);
        this.prevCentroid = centroid;

        // Combine features (weighted)
        const onsetStrength =
            flux * 0.5 +
            energyDelta * 0.3 +
            (centroidDelta / 1000) * 0.2;

        return onsetStrength;
    }
}

// Usage
const onsetDetector = new OnsetStrength();
const strength = onsetDetector.calculate(dataArray, 48000, 2048);

// Threshold for onset
if (strength > 0.2) {
    // Strong onset detected
}
```

### Technique 4: Dynamic Range Analysis

**Concept**: Measure loudness variation over time.

```javascript
class DynamicRangeAnalyzer {
    constructor(windowSize = 60) {
        this.energyHistory = [];
        this.windowSize = windowSize;
    }

    analyze(energy) {
        this.energyHistory.push(energy);
        if (this.energyHistory.length > this.windowSize) {
            this.energyHistory.shift();
        }

        if (this.energyHistory.length < 2) {
            return { dynamicRange: 0, variance: 0 };
        }

        // Find min and max
        const min = Math.min(...this.energyHistory);
        const max = Math.max(...this.energyHistory);
        const dynamicRange = max - min;

        // Calculate variance
        const mean = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        const variance = this.energyHistory.reduce((sum, val) => {
            return sum + Math.pow(val - mean, 2);
        }, 0) / this.energyHistory.length;

        return {
            dynamicRange,
            variance,
            min,
            max,
            mean,
            isCompressed: dynamicRange < 0.3, // Highly compressed audio
            isDynamic: dynamicRange > 0.6     // Wide dynamic range
        };
    }
}

// Usage
const rangeAnalyzer = new DynamicRangeAnalyzer(120); // 2 seconds at 60fps

const range = rangeAnalyzer.analyze(rmsEnergy);

if (range.isCompressed) {
    // Heavily compressed/mastered music (modern pop, EDM)
    // Use less smoothing, more responsive
    smoothingFactor = 0.2;
} else if (range.isDynamic) {
    // Dynamic music (classical, jazz)
    // Use more smoothing, prevent jarring changes
    smoothingFactor = 0.8;
}
```

### Technique 5: Genre Classification

**Concept**: Use audio features to identify genre.

```javascript
class GenreClassifier {
    classify(features) {
        const {
            bassRatio,
            spectralCentroid,
            tempo,
            dynamicRange,
            zcr
        } = features;

        // Simple rule-based classification
        let genre = 'unknown';

        // Electronic/EDM: Strong bass, moderate centroid, fast tempo
        if (bassRatio > 0.5 && tempo > 120 && dynamicRange < 0.4) {
            genre = 'electronic';
        }

        // Rock: Balanced, moderate-high centroid, medium tempo
        else if (
            bassRatio > 0.3 && bassRatio < 0.5 &&
            spectralCentroid > 1500 && spectralCentroid < 4000 &&
            tempo > 80 && tempo < 140
        ) {
            genre = 'rock';
        }

        // Classical: Wide dynamic range, varying centroid
        else if (dynamicRange > 0.6) {
            genre = 'classical';
        }

        // Hip-Hop: Very strong bass, moderate tempo
        else if (bassRatio > 0.6 && tempo > 70 && tempo < 110) {
            genre = 'hiphop';
        }

        // Ambient: Low dynamics, slow changes
        else if (dynamicRange < 0.3 && zcr < 0.1) {
            genre = 'ambient';
        }

        return genre;
    }
}

// Usage - adapt visualization to genre
const genre = new GenreClassifier().classify({
    bassRatio: 0.65,
    spectralCentroid: 2000,
    tempo: 128,
    dynamicRange: 0.25,
    zcr: 0.15
});

console.log(`Detected genre: ${genre}`);

// Load genre-specific color palette
const palette = genrePalettes[genre] || genrePalettes.default;
```

---

## Performance Optimization

### Optimization 1: Reduce FFT Size

**Trade-off**: Lower resolution, faster computation.

```javascript
// Current: fftSize = 2048
// Try: fftSize = 1024 (2× faster, half the bins)

analyserNode.fftSize = 1024;
// Bin count: 512 (vs 1024)
// Frequency resolution: 46.8 Hz (vs 23.4 Hz)
// Still good for music visualization
```

### Optimization 2: Reduce Update Rate

**Concept**: Don't analyze every frame.

```javascript
let frameCount = 0;
let cachedBass = 0;
let cachedMid = 0;
let cachedHigh = 0;

function draw() {
    frameCount++;

    // Only analyze every 2 frames (30Hz instead of 60Hz)
    if (frameCount % 2 === 0) {
        // Perform FFT analysis
        analyserNode.getByteFrequencyData(dataArray);

        // Calculate bands
        cachedBass = calculateBass(dataArray);
        cachedMid = calculateMid(dataArray);
        cachedHigh = calculateHigh(dataArray);
    }

    // Use cached values
    smoothedBass = smoothedBass * 0.7 + cachedBass * 0.3;
    // ... render using smoothed values
}

// Result: ~2× faster (analysis is expensive part)
```

### Optimization 3: Optimize Band Calculation

**Current** (your implementation):
```javascript
// Three separate loops
for (let i = 0; i < 11; i++) bass += dataArray[i];
for (let i = 11; i < 85; i++) mid += dataArray[i];
for (let i = 85; i < 337; i++) high += dataArray[i];
```

**Optimized** (single loop):
```javascript
function calculateBands(dataArray) {
    let bass = 0, mid = 0, high = 0;

    for (let i = 0; i < 337; i++) {
        const value = dataArray[i];
        if (i < 11) bass += value;
        else if (i < 85) mid += value;
        else high += value;
    }

    return {
        bass: bass / 11 / 255,
        mid: mid / 74 / 255,
        high: high / 252 / 255
    };
}

// Faster: Single loop, better cache locality
```

### Optimization 4: Use Typed Arrays

**Concept**: Pre-allocate arrays for calculations.

```javascript
// Pre-allocate buffers
const bassHistory = new Float32Array(100);
const midHistory = new Float32Array(100);
let historyIndex = 0;

function updateHistory(bass, mid) {
    bassHistory[historyIndex] = bass;
    midHistory[historyIndex] = mid;
    historyIndex = (historyIndex + 1) % 100;
}

// Faster than:
// const history = [];
// history.push(value);
// if (history.length > 100) history.shift(); // Slow!
```

### Optimization 5: Avoid Unnecessary Math

**Heavy operations**:
```javascript
// SLOW
const normalized = Math.pow(value, 1.5); // ~20ns
const smoothed = Math.exp(-value);       // ~30ns

// FAST
const normalized = value * value;        // ~2ns
const clamped = Math.min(value, 1.0);    // ~5ns
```

**Pre-calculate constants**:
```javascript
// BAD: Calculate every frame
const binWidth = sampleRate / fftSize;

// GOOD: Calculate once
const BIN_WIDTH = 48000 / 2048; // 23.4375
```

### Optimization 6: Limit Feature Calculation

**Don't calculate features you don't use**:

```javascript
// BAD: Calculate everything
const rms = new RMSEnergy().calculate(dataArray);
const centroid = new SpectralCentroid().calculate(dataArray, 48000, 2048);
const flux = new SpectralFlux().calculate(dataArray);
const rolloff = new SpectralRolloff().calculate(dataArray, 48000, 2048);
// ... but only use bass/mid/high!

// GOOD: Only calculate what you need
const bands = calculateBands(dataArray);
const bass = bands.bass;
```

### Performance Budget

**Target**: 60 fps = 16.67ms per frame

**Typical Costs**:
```
FFT (getByteFrequencyData):     ~0.5-1.0ms
Band calculation (3 bands):     ~0.05ms
Beat detection (simple):        ~0.02ms
Spectral centroid:              ~0.1ms
Smoothing (3 values):           ~0.01ms
WebGL rendering:                ~2-5ms
────────────────────────────────────────
Total:                          ~2.7-6.2ms
Remaining:                      ~10-14ms (plenty of headroom)
```

**When to Optimize**:
- If total frame time > 16ms (check DevTools Performance)
- If running on mobile/low-end devices
- If adding many visual layers
- If increasing FFT size to 4096+

---

## Debugging Tools

### Tool 1: FFT Spectrum Visualizer

```javascript
function drawSpectrum(ctx, dataArray, width, height, sampleRate, fftSize) {
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / dataArray.length;

    for (let i = 0; i < dataArray.length; i++) {
        const value = dataArray[i];
        const percent = value / 255;
        const barHeight = percent * height;

        // Color by frequency
        const hue = (i / dataArray.length) * 300; // 0-300°
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;

        const x = i * barWidth;
        const y = height - barHeight;

        ctx.fillRect(x, y, barWidth - 1, barHeight);
    }

    // Draw frequency labels
    ctx.fillStyle = 'white';
    ctx.font = '10px monospace';
    const frequencies = [100, 500, 1000, 5000, 10000];
    for (const freq of frequencies) {
        const bin = Math.floor(freq / (sampleRate / fftSize));
        const x = bin * barWidth;
        ctx.fillText(`${freq}Hz`, x, 10);
    }
}

// Usage
const canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 200;
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

// In animation loop
drawSpectrum(ctx, dataArray, 800, 200, 48000, 2048);
```

### Tool 2: Band Energy Meters

```javascript
function drawBandMeters(ctx, bass, mid, high, x, y, width, height) {
    const barHeight = height / 3;

    // Bass
    ctx.fillStyle = 'red';
    ctx.fillRect(x, y, width * bass, barHeight - 5);
    ctx.fillStyle = 'white';
    ctx.fillText(`Bass: ${(bass * 100).toFixed(0)}%`, x + 5, y + 15);

    // Mid
    ctx.fillStyle = 'green';
    ctx.fillRect(x, y + barHeight, width * mid, barHeight - 5);
    ctx.fillText(`Mid: ${(mid * 100).toFixed(0)}%`, x + 5, y + barHeight + 15);

    // High
    ctx.fillStyle = 'blue';
    ctx.fillRect(x, y + barHeight * 2, width * high, barHeight - 5);
    ctx.fillText(`High: ${(high * 100).toFixed(0)}%`, x + 5, y + barHeight * 2 + 15);
}

// Usage
drawBandMeters(ctx, smoothedBass, smoothedMid, high, 10, 10, 200, 150);
```

### Tool 3: Beat Detection Visualizer

```javascript
function drawBeatIndicator(ctx, isBeat, strength, x, y, radius) {
    const alpha = isBeat ? 1.0 : strength;
    const size = isBeat ? radius * 1.5 : radius;

    ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    if (isBeat) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

// Usage
const beat = beatDetector.detectBeat(smoothedBass);
drawBeatIndicator(ctx, beat.isBeat, beat.strength, 50, 50, 20);
```

### Tool 4: Feature Timeline

```javascript
class FeatureTimeline {
    constructor(width, height, historySize = 300) {
        this.width = width;
        this.height = height;
        this.history = [];
        this.historySize = historySize;
    }

    addValue(value) {
        this.history.push(value);
        if (this.history.length > this.historySize) {
            this.history.shift();
        }
    }

    draw(ctx, x, y, color = 'green') {
        if (this.history.length < 2) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const xStep = this.width / this.historySize;

        for (let i = 0; i < this.history.length; i++) {
            const value = this.history[i];
            const px = x + i * xStep;
            const py = y + this.height - value * this.height;

            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }

        ctx.stroke();
    }
}

// Usage - multiple timelines
const bassTimeline = new FeatureTimeline(400, 50);
const midTimeline = new FeatureTimeline(400, 50);
const beatTimeline = new FeatureTimeline(400, 50);

// In loop
bassTimeline.addValue(smoothedBass);
midTimeline.addValue(smoothedMid);
beatTimeline.addValue(beat.isBeat ? 1 : 0);

// Draw
bassTimeline.draw(ctx, 10, 220, 'red');
midTimeline.draw(ctx, 10, 280, 'green');
beatTimeline.draw(ctx, 10, 340, 'yellow');
```

### Tool 5: Console Stats

```javascript
class AudioStats {
    constructor() {
        this.frameCount = 0;
        this.startTime = performance.now();
        this.lastLog = this.startTime;
    }

    log(bass, mid, high, isBeat) {
        this.frameCount++;

        const now = performance.now();
        if (now - this.lastLog > 1000) { // Log every second
            const elapsed = (now - this.startTime) / 1000;
            const fps = this.frameCount / elapsed;

            console.log(`[${elapsed.toFixed(1)}s] FPS: ${fps.toFixed(1)}`);
            console.log(`  Bass: ${(bass * 100).toFixed(0)}%`);
            console.log(`  Mid:  ${(mid * 100).toFixed(0)}%`);
            console.log(`  High: ${(high * 100).toFixed(0)}%`);
            console.log(`  Beat: ${isBeat ? 'YES' : 'no'}`);

            this.lastLog = now;
        }
    }
}

// Usage
const stats = new AudioStats();

// In loop
stats.log(smoothedBass, smoothedMid, high, beat.isBeat);
```

---

## Common Mistakes

### Mistake 1: Forgetting to Normalize

**Problem**:
```javascript
// ❌ BAD
const bass = sumBassFrequencies(); // 0-2805 (11 bins × 255)
// Used directly without normalization
scale = 0.5 + bass; // scale = 0.5-2805.5 (broken!)
```

**Solution**:
```javascript
// ✅ GOOD
const bass = sumBassFrequencies() / 11 / 255; // 0-1
scale = 0.5 + bass * 0.5; // scale = 0.5-1.0 (correct)
```

### Mistake 2: Using Wrong FFT Data Method

**Problem**:
```javascript
// ❌ BAD - Time domain for frequency analysis
analyserNode.getByteTimeDomainData(dataArray);
const bass = calculateBands(dataArray); // Wrong domain!
```

**Solution**:
```javascript
// ✅ GOOD - Frequency domain for bands
analyserNode.getByteFrequencyData(dataArray);
const bass = calculateBands(dataArray);

// Use time domain only for waveform or ZCR
analyserNode.getByteTimeDomainData(dataArray);
const zcr = calculateZCR(dataArray);
```

### Mistake 3: Not Considering Sample Rate

**Problem**:
```javascript
// ❌ BAD - Hardcoded for 48kHz
const bassMaxBin = 10; // Assumes 48kHz

// On 44.1kHz system:
// Bin 10 = 10 × (44100/2048) = 215 Hz (not 234 Hz!)
```

**Solution**:
```javascript
// ✅ GOOD - Calculate dynamically
const sampleRate = audioContext.sampleRate;
const fftSize = analyserNode.fftSize;
const bassMaxFreq = 250; // Hz
const bassMaxBin = Math.floor(bassMaxFreq / (sampleRate / fftSize));
```

### Mistake 4: Too Much Smoothing

**Problem**:
```javascript
// ❌ BAD - Over-smoothed
smoothedBass = smoothedBass * 0.99 + bass * 0.01;
// Half-life: ~69 frames (1.15 seconds)
// Visuals lag way behind music!
```

**Solution**:
```javascript
// ✅ GOOD - Responsive but stable
smoothedBass = smoothedBass * 0.7 + bass * 0.3;
// Half-life: ~1.9 frames (32ms)
// Follows music closely
```

### Mistake 5: Ignoring analyserNode Smoothing

**Your code** (line 454):
```javascript
analyser.smoothingTimeConstant = 0.8;
```

This applies smoothing BEFORE you get the data!

**Effect**:
```javascript
// Data from analyserNode is already smoothed
analyserNode.getByteFrequencyData(dataArray);
// Then you smooth again:
smoothedBass = smoothedBass * 0.7 + bass * 0.3;

// Total smoothing = compound effect
// Effective alpha = 0.8 × 0.7 = 0.56 (slower than either alone)
```

**Solution**: Either use built-in smoothing OR manual smoothing, not both.

```javascript
// Option A: Use only built-in
analyser.smoothingTimeConstant = 0.7;
// Don't smooth manually

// Option B: Disable built-in, smooth manually
analyser.smoothingTimeConstant = 0.0; // No built-in smoothing
// Then control smoothing in your code
smoothedBass = smoothedBass * 0.7 + bass * 0.3;

// Recommended: Option B (more control)
```

### Mistake 6: Beat Detection Too Sensitive

**Problem**:
```javascript
// ❌ BAD - Detects every slight increase
if (bass > 0.3) {
    isBeat = true; // Triggers constantly!
}
```

**Solution**:
```javascript
// ✅ GOOD - Compare to recent average
const avgBass = calculateAverage(bassHistory);
if (bass > avgBass * 1.5 && bass > 0.3) {
    isBeat = true; // Only significant increases
}
```

### Mistake 7: Not Handling Silence

**Problem**:
```javascript
// ❌ BAD - Division by zero risk
const normalized = value / max; // If max = 0, NaN!
```

**Solution**:
```javascript
// ✅ GOOD - Guard against zero
const normalized = value / Math.max(max, 0.001);
// Or
const normalized = max > 0 ? value / max : 0;
```

---

## Copy-Paste Snippets

### Snippet 1: Complete Improved Audio Analyzer

**Drop-in replacement for your current analysis** (lines 504-529):

```javascript
class ImprovedAudioAnalyzer {
    constructor(sampleRate = 48000, fftSize = 2048) {
        this.sampleRate = sampleRate;
        this.fftSize = fftSize;

        // Normalizers for each band
        this.bassNorm = new PeakNormalizer(0.9999);
        this.midNorm = new PeakNormalizer(0.9999);
        this.highNorm = new PeakNormalizer(0.9999);

        // Smoothing with attack/release
        this.bassSmooth = new AttackRelease(0.3, 0.1);
        this.midSmooth = new AttackRelease(0.15, 0.05);
        this.highSmooth = new AttackRelease(0.5, 0.3);

        // Beat detection
        this.beatDetector = new SimpleBeatDetector(1.4, 43);
    }

    analyze(dataArray) {
        // Calculate raw bands
        const bassRaw = sumFrequencyRange(dataArray, 20, 250, this.sampleRate, this.fftSize);
        const midRaw = sumFrequencyRange(dataArray, 250, 2000, this.sampleRate, this.fftSize);
        const highRaw = sumFrequencyRange(dataArray, 2000, 8000, this.sampleRate, this.fftSize);

        // Normalize
        const bassNorm = this.bassNorm.normalize(bassRaw);
        const midNorm = this.midNorm.normalize(midRaw);
        const highNorm = this.highNorm.normalize(highRaw);

        // Apply power curves
        const bassPower = Math.pow(bassNorm, 3.0);
        const midPower = Math.pow(midNorm, 1.0);
        const highPower = Math.pow(highNorm, 1.5);

        // Smooth
        const bass = this.bassSmooth.process(bassPower);
        const mid = this.midSmooth.process(midPower);
        const high = this.highSmooth.process(highPower);

        // Beat detection
        const beat = this.beatDetector.detectBeat(bass);

        return { bass, mid, high, beat };
    }
}

// Usage
const analyzer = new ImprovedAudioAnalyzer(
    audioContext.sampleRate,
    analyserNode.fftSize
);

// In draw loop
const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
analyserNode.getByteFrequencyData(dataArray);

const audio = analyzer.analyze(dataArray);
// Use audio.bass, audio.mid, audio.high, audio.beat
```

### Snippet 2: Multi-Band Frequency Analyzer

```javascript
// 10-band analyzer (like a graphic EQ)
const bands = [
    { name: 'sub', min: 20, max: 60 },
    { name: 'bass', min: 60, max: 250 },
    { name: 'lowMid', min: 250, max: 500 },
    { name: 'mid', min: 500, max: 1000 },
    { name: 'highMid', min: 1000, max: 2000 },
    { name: 'presence', min: 2000, max: 4000 },
    { name: 'brilliance', min: 4000, max: 6000 },
    { name: 'high', min: 6000, max: 8000 },
    { name: 'veryHigh', min: 8000, max: 12000 },
    { name: 'air', min: 12000, max: 20000 }
];

function getMultiBandSpectrum(dataArray, sampleRate, fftSize) {
    const spectrum = {};

    for (const band of bands) {
        spectrum[band.name] = sumFrequencyRange(
            dataArray,
            band.min,
            band.max,
            sampleRate,
            fftSize
        );
    }

    return spectrum;
}

// Usage
const spectrum = getMultiBandSpectrum(dataArray, 48000, 2048);
console.log(spectrum);
// { sub: 0.1, bass: 0.7, lowMid: 0.5, mid: 0.6, ... }

// Map to different visual parameters
scale = 0.5 + spectrum.bass * 0.5;
hue = (baseHue + spectrum.presence * 60) % 360;
rotation += spectrum.high * 2;
glowIntensity = spectrum.air;
```

### Snippet 3: Beat-Synced Effect Trigger

```javascript
class BeatEffectTrigger {
    constructor() {
        this.beatDetector = new SimpleBeatDetector(1.4, 43);
        this.flashDecay = 0;
        this.pulseDecay = 0;
    }

    update(bass) {
        const beat = this.beatDetector.detectBeat(bass);

        if (beat.isBeat) {
            this.flashDecay = 1.0;
            this.pulseDecay = 1.0;
        }

        // Fast decay for flash
        this.flashDecay *= 0.85;

        // Slow decay for pulse
        this.pulseDecay *= 0.95;

        return {
            isBeat: beat.isBeat,
            flash: this.flashDecay,      // 0-1, quick flash
            pulse: this.pulseDecay,      // 0-1, sustained pulse
            strength: beat.strength
        };
    }
}

// Usage
const beatEffect = new BeatEffectTrigger();

// In draw loop
const effect = beatEffect.update(smoothedBass);

// Apply effects
const saturation = baseSat + effect.flash * 40;        // Flash boost
const scale = 0.5 + bass * 0.3 + effect.pulse * 0.2;  // Pulse size
const glowIntensity = baseGlow + effect.flash * 0.5;  // Flash glow

gl.uniform1f(saturationLocation, saturation);
gl.uniform1f(scaleLocation, scale);
gl.uniform1f(glowIntensityLocation, glowIntensity);
```

### Snippet 4: Adaptive Threshold Beat Detector

```javascript
// Automatically adjusts threshold based on music dynamics
class AdaptiveBeatDetector {
    constructor() {
        this.history = [];
        this.historySize = 100;
        this.lastBeatTime = 0;
        this.minInterval = 200;
    }

    detectBeat(energy) {
        this.history.push(energy);
        if (this.history.length > this.historySize) {
            this.history.shift();
        }

        // Calculate adaptive threshold
        const sorted = [...this.history].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const p90 = sorted[Math.floor(sorted.length * 0.9)];

        // Threshold = median + 40% of range to 90th percentile
        const threshold = median + (p90 - median) * 0.4;

        // Check beat
        const now = performance.now();
        const timeSinceLastBeat = now - this.lastBeatTime;

        const isBeat =
            energy > threshold &&
            timeSinceLastBeat > this.minInterval;

        if (isBeat) {
            this.lastBeatTime = now;
        }

        return {
            isBeat,
            energy,
            threshold,
            strength: Math.max(0, energy - threshold)
        };
    }
}
```

### Snippet 5: Spectral Centroid Brightness Mapper

```javascript
// Map spectral centroid to visual brightness/color
class BrightnessMapper {
    constructor() {
        this.centroid = new SpectralCentroid();
        this.smoothedCentroid = 2000; // Start at typical value
    }

    update(dataArray, sampleRate, fftSize) {
        const rawCentroid = this.centroid.calculate(dataArray, sampleRate, fftSize);

        // Smooth
        this.smoothedCentroid =
            this.smoothedCentroid * 0.9 +
            rawCentroid * 0.1;

        // Normalize to 0-1 (typical music: 1000-6000 Hz)
        const normalized = (this.smoothedCentroid - 1000) / 5000;
        const clamped = Math.max(0, Math.min(1, normalized));

        return {
            centroid: this.smoothedCentroid,
            brightness: clamped,
            isDark: clamped < 0.3,
            isBright: clamped > 0.7
        };
    }

    getColorTemperature() {
        // Map to warm (low) vs cool (high)
        const temp = 2000 + this.smoothedCentroid / 10000 * 7000;
        return Math.min(9000, Math.max(2000, temp));
    }
}

// Usage
const brightnessMapper = new BrightnessMapper();

const brightness = brightnessMapper.update(dataArray, 48000, 2048);

// Use for color
const hue = brightness.isDark ? 30 : 200; // Warm if dark, cool if bright
const lightness = 40 + brightness.brightness * 30; // 40-70%

// Or temperature
const kelvin = brightnessMapper.getColorTemperature();
const rgb = kelvinToRGB(kelvin);
```

---

## Progression Path

### Beginner (2-3 hours)

**Goal**: Understand current FFT implementation and improve normalization.

**Checklist**:
- [ ] Read "Your Current Implementation" section
- [ ] Understand what FFT does (time→frequency)
- [ ] Verify actual frequency ranges vs comments
- [ ] Implement adaptive normalization (Snippet 1)
- [ ] Test with different volume songs
- [ ] Adjust smoothing parameters to taste

**Expected Result**: Consistent visual response across different songs, better understanding of FFT.

### Intermediate (4-6 hours)

**Goal**: Add beat detection and experiment with different frequency binning.

**Checklist**:
- [ ] Read "Beat & Onset Detection" section
- [ ] Implement simple beat detector
- [ ] Trigger visual effects on beats
- [ ] Try logarithmic binning
- [ ] Implement 10-band analyzer
- [ ] Map different bands to different visual parameters
- [ ] Create debug spectrum visualizer

**Expected Result**: Beat-synced effects, more detailed frequency control, visual debugging tools.

### Advanced (8-12 hours)

**Goal**: Extract advanced features and create genre-adaptive system.

**Checklist**:
- [ ] Read "Audio Features Library" section
- [ ] Implement spectral centroid
- [ ] Implement spectral flux
- [ ] Add onset detection
- [ ] Create multi-band beat detector (kick/snare/hihat)
- [ ] Implement tempo estimation
- [ ] Build genre classifier
- [ ] Adapt visualizations to detected genre

**Expected Result**: Sophisticated audio analysis with multiple features, genre-aware visualization.

### Expert (12+ hours)

**Goal**: Custom feature extraction, optimization, professional debugging.

**Checklist**:
- [ ] Read "Advanced Analysis Techniques" section
- [ ] Implement harmonic analyzer
- [ ] Create dynamic range analyzer
- [ ] Build custom feature combinations
- [ ] Optimize performance for mobile
- [ ] Create comprehensive debug dashboard
- [ ] Profile and optimize hotspots
- [ ] Build automated testing suite

**Expected Result**: Production-ready audio analysis system with professional debugging tools and optimal performance.

---

## References

### Web Audio API
- **MDN**: Web Audio API documentation
- **Spec**: W3C Web Audio API specification
- **Book**: "Web Audio API" by Boris Smus

### DSP & Audio
- **Book**: "The Scientist and Engineer's Guide to Digital Signal Processing" by Steven W. Smith
- **Course**: Coursera "Audio Signal Processing for Music Applications"
- **Paper**: "Music Information Retrieval" resources at ISMIR

### FFT & Analysis
- **Article**: "Understanding the FFT Algorithm" (Jake VanderPlas)
- **Interactive**: "An Interactive Guide to the Fourier Transform" (Better Explained)
- **Tool**: Sonic Visualiser for analyzing audio files

### Beat Detection
- **Paper**: "Beat Tracking by Dynamic Programming" (Ellis, 2007)
- **Library**: BeatDetektor.js (open source)
- **Tutorial**: "Creating a Beat Detector" (Chris Wilson)

### Implementation Examples
- **CodePen**: Web Audio visualizer examples
- **GitHub**: Meyda.js (audio feature extraction library)
- **Demo**: Chrome Music Lab experiments

---

## Next Steps

Now that you understand audio analysis and FFT:

1. **Try the Quick Start** - Add adaptive normalization immediately
2. **Implement Beat Detection** - Trigger effects on kick drums
3. **Experiment with Features** - Try spectral centroid, flux
4. **Optimize** - Profile and optimize for 60fps
5. **Build Debug Tools** - Visualize spectrum and features

**Related Guides**:
- **Audio-Reactive Design Patterns** - For mapping features to visual parameters
- **Color Theory for Audio Visualization** - For mapping features to color
- **Shader Optimization Techniques** - For optimizing the complete pipeline

---

**Remember**: Audio analysis is the foundation of your visualizer. Understanding FFT deeply unlocks infinite creative possibilities - every audio feature is a potential visual parameter!

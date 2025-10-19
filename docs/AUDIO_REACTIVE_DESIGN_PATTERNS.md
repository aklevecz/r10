# Audio-Reactive Design Patterns

## 🚀 Quick Start

**Want to add a new effect RIGHT NOW?**

1. Choose audio feature: `bass` / `mid` / `high`
2. Choose visual param: `scale` / `rotation` / `color` / `distortion`
3. Copy this template:

```javascript
const myValue = Math.pow(audioFeature, 2.0);
smoothed = smoothed * 0.7 + myValue * 0.3;
visualParam = baseValue + smoothed * range;
```

4. Test and tune threshold/range (see [Calibration Guide](#calibration-guide))
5. Done!

---

## How to Use This Guide

**If you're...**

🎨 **A Designer**: Focus on [Pattern Library](#pattern-library), [Genre-Specific](#genre-specific-patterns), [Design Principles](#design-principles)
🔧 **A Developer**: Focus on [Mapping Strategies](#mapping-strategies), [Code Snippets](#copy-paste-code-snippets), [Implementation Checklist](#implementation-checklist)
🐛 **Debugging**: Jump to [Troubleshooting](#troubleshooting-guide), [Anti-Patterns](#anti-patterns-to-avoid)
🎵 **A Musician**: Focus on [Genre-Specific](#genre-specific-patterns), [Calibration](#calibration-guide)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Glossary](#glossary)
3. [Your Current Implementation](#your-current-implementation)
4. [Core Concepts](#core-concepts)
5. [Mapping Strategies](#mapping-strategies)
6. [Pattern Library](#pattern-library)
7. [Combination Patterns](#combination-patterns)
8. [Genre-Specific Patterns](#genre-specific-patterns)
9. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
10. [Design Principles](#design-principles)
11. [Calibration Guide](#calibration-guide)
12. [Troubleshooting Guide](#troubleshooting-guide)
13. [Visual Representations](#visual-representations)
14. [Copy-Paste Code Snippets](#copy-paste-code-snippets)
15. [Accessibility Guidelines](#accessibility-guidelines)
16. [Debugging Tools](#debugging-tools)
17. [Performance Metrics](#performance-metrics)
18. [Testing Protocol](#testing-protocol)
19. [Progression Path](#progression-path)
20. [References & Inspiration](#references--inspiration)

---

## Introduction

This guide provides a comprehensive library of design patterns for mapping audio features to visual parameters. Each pattern includes the mathematical formula, implementation code, visual description, and best use cases.

Think of these as "recipes" for creating compelling audio-reactive behaviors that feel natural, musical, and visually interesting.

**What makes this different**: This isn't just theory - it's based on YOUR actual working implementation in `AudioVisualizerWebGL.svelte`, with practical guidance for extending it.

---

## Glossary

Essential terms used throughout this guide:

| Term | Definition |
|------|------------|
| **FFT** | Fast Fourier Transform - converts time-domain audio to frequency spectrum |
| **Bass/Mid/High** | Frequency bands: bass (0-86Hz), mid (86-689Hz), high (689-2756Hz) |
| **RMS** | Root Mean Square - average loudness/energy level |
| **Spectral Centroid** | "Center of mass" of frequency spectrum - indicates brightness |
| **Onset** | Sudden increase in energy (transient) |
| **Attack** | How quickly a value rises to its peak |
| **Release** | How quickly a value falls after the peak |
| **Decay** | Rate of exponential decrease over time |
| **Smoothing Factor** | 0-1 value controlling responsiveness (higher = smoother) |
| **Power Curve** | Non-linear mapping using exponents (x^n) |
| **Threshold** | Minimum value before an effect activates |
| **Cooldown** | Minimum time between repeated triggers |
| **UV Coordinates** | Texture coordinates in 0-1 range for pixel sampling |
| **HSV** | Hue-Saturation-Value color space (easier for hue rotation) |

---

## Your Current Implementation

**Location**: `/Users/arielklevecz/r10/src/lib/components/AudioVisualizerWebGL.svelte`

### What You Already Have

#### ✅ Pattern #1: Pulse (Bass → Scale)
**Lines**: 540-547

```javascript
// Current code
const bassSmoothing = 0.7;
smoothedBass = smoothedBass * bassSmoothing + bass * (1 - bassSmoothing);
const scale = 0.15 + smoothedBass * 0.8;  // Range: 0.15-0.95
```

**Analysis**:
- Power curve: `bass^3.0` (lines 524) - very selective, only strong kicks
- Smoothing: 0.7 factor - balanced responsiveness
- Range: 15% to 95% - excellent dynamic range
- ✅ **Well-tuned for kick drums**

**How to modify**:
- More aggressive pulse: Change `* 0.8` to `* 1.2` (range 0.15-1.35)
- Smoother motion: Change `0.7` to `0.85`
- Tighter response: Change `bass^3.0` to `bass^4.0`

---

#### ✅ Pattern #2: Spin (High → Rotation)
**Lines**: 559-560

```javascript
// Current code
rotation += high * 0.8;  // Accumulator
rotation = rotation % 360;  // Wrap at 360°
```

**Analysis**:
- Power curve: `high^1.5` (line 526) - moderate emphasis
- No smoothing - intentionally responsive
- Speed: 0.8°/frame at full high energy
- ✅ **Responsive to hi-hats and cymbals**

**How to modify**:
- Faster spin: Change `* 0.8` to `* 1.5`
- Bi-directional: `rotation += (high - 0.5) * 1.6`
- Smooth deceleration: Add `rotation *= 0.98` when `high < 0.1`

---

#### ✅ Pattern #3: Color Shift (High → Hue)
**Lines**: 563

```javascript
// Current code
const hueShift = high * 240;  // 0-240° range
```

**Analysis**:
- Range: 2/3 of color wheel (preserves base color identity)
- No smoothing - rapid color changes
- Applied to both trails and texture (different intensities)
- ✅ **Creates rainbow shifts during high-frequency moments**

**How to modify**:
- Full spectrum: Change `* 240` to `* 360`
- Slower shifts: Add smoothing or change to `* 120`
- Discrete colors: `Math.floor(high * 6) * 60` (steps of 60°)

---

#### ✅ Pattern #4: Flash Inversion (Bass → Color Flip)
**Lines**: 565-576

```javascript
// Current code
if (bass > 0.7 && currentTime - lastInversionTime > 500) {
    isInverted = true;
    inversionStartTime = currentTime;
}
// Auto-revert after 300ms
if (isInverted && currentTime - inversionStartTime > 300) {
    isInverted = false;
}
```

**Analysis**:
- Threshold: 0.7 (only strong bass)
- Cooldown: 500ms (prevents strobing)
- Duration: 300ms (brief flash)
- ✅ **Safe and dramatic punctuation**

**How to modify**:
- More frequent: Lower threshold to `0.6`
- Longer flash: Change `300` to `500`
- Tighter cooldown: Change `500` to `300` (but watch for strobing!)

---

#### ✅ Pattern #5: Glitch Distortion (Mid → UV Warp)
**Lines**: 553-557

```javascript
// Current code
const distortionThreshold = 0.5;
const distortionIntensity = Math.max(0, mid - distortionThreshold) / (1 - distortionThreshold);
const distortionAmount = distortionIntensity * 0.6;
```

**Analysis**:
- Threshold-gated: Only activates above 50% mid energy
- Max intensity: 0.6 (60% distortion)
- Smoothing: 0.85 factor (line 551) - reduces strobing
- ✅ **Triggers on snares and synth stabs**

**How to modify**:
- More sensitive: Lower threshold to `0.3`
- More intense: Change `* 0.6` to `* 1.0`
- Always-on subtle: Remove threshold, use `mid * 0.3`

---

#### ✅ Pattern #6: Glow Intensity (Bass → Edge Brightness)
**Lines**: 616 (uniform), shader lines 282-289

```glsl
// Current shader code
float glowBoost = 1.0 + u_glowIntensity * 3.0;  // 1x to 4x
textureColorHSV.z = min(1.0, textureColorHSV.z * glowBoost);
```

**Analysis**:
- Uses raw bass (no smoothing) for immediate response
- Boost range: 1x to 4x brightness
- Applied to complementary color on texture
- ✅ **Creates punchy neon effect on kicks**

**How to modify**:
- Subtler glow: Change `* 3.0` to `* 1.5` (1x to 2.5x)
- Extreme glow: Change to `* 5.0` (1x to 6x)
- Colored glow: Shift hue in addition to brightness

---

### What You Could Add

Based on the [Pattern Library](#pattern-library):

1. **Trail Decay Rate** (Pattern #7): Make trails longer/shorter based on RMS
2. **Zoom Wobble** (Pattern #8): Add secondary vibration to scale
3. **Particle Burst** (Pattern #10): Spawn elements on bass hits
4. **Attack-Release** (Mapping Strategy #7): More natural motion curves

---

## Core Concepts

### Audio Features

The raw materials you have to work with:

| Feature | Range | Characteristics | Best For | Current Use |
|---------|-------|-----------------|----------|-------------|
| **Bass** | 0-1 | Sparse, impactful | Punctuation, emphasis | ✅ Scale, Glow, Flash |
| **Mid** | 0-1 | Continuous, melodic | Sustained effects, flow | ✅ Distortion |
| **High** | 0-1 | Rapid, textural | Fast changes, detail | ✅ Rotation, Color |
| **RMS (Volume)** | 0-1 | Overall loudness | Universal scaling | ⚪ Not used yet |
| **Spectral Centroid** | Hz | Brightness of sound | Color temperature | ⚪ Not used yet |
| **Zero Crossings** | Count | Noisiness | Chaos/order | ⚪ Not used yet |

### Visual Parameters

The destinations you can affect:

| Parameter | Type | Perceptual Impact | Current Use |
|-----------|------|-------------------|-------------|
| **Position** | vec2/vec3 | Location in space | ⚪ Not used |
| **Scale** | float | Size, importance | ✅ Bass pulse |
| **Rotation** | float | Spin, orientation | ✅ High spin |
| **Color** | vec3 | Emotion, energy | ✅ Hue shift, inversion |
| **Opacity** | float | Visibility, layering | ⚪ Not used |
| **Distortion** | float | Chaos, intensity | ✅ Mid glitch |
| **Blur** | float | Focus, depth | ⚪ Not used |
| **Glow** | float | Emphasis, magic | ✅ Bass glow |
| **Trail Decay** | float | Motion persistence | 🔸 Fixed (0.92) |

---

## Mapping Strategies

### Visual Comparison

```
POWER CURVES: y = x^n

Input value (x):  0.0    0.3    0.5    0.7    0.9    1.0
────────────────────────────────────────────────────────
x^0.5 (√x)       0.00   0.55   0.71   0.84   0.95   1.00  ← Very sensitive
x^1.0 (linear)   0.00   0.30   0.50   0.70   0.90   1.00  ← Neutral
x^1.5            0.00   0.16   0.35   0.58   0.85   1.00  ← Moderate (current high)
x^2.0            0.00   0.09   0.25   0.49   0.81   1.00  ← Strong emphasis
x^3.0            0.00   0.03   0.13   0.34   0.73   1.00  ← Very selective (current bass)
x^4.0            0.00   0.01   0.06   0.24   0.66   1.00  ← Extreme peaks only

Visual curve shapes:

Sensitive (x^0.5)    Linear (x^1.0)    Selective (x^3.0)
│      ╱╱            │    ╱             │        ╱╱
│    ╱╱              │   ╱              │      ╱╱
│  ╱╱                │  ╱               │    ╱╱
│╱╱                  │ ╱                │  ╱╱
└────────            └────              └────────
Responds to all      Proportional       Only peaks

Use when:            Use when:          Use when:
- Subtle input       - 1:1 mapping      - Emphasizing
- Always active      - Predictable      - Sparse events
- Quiet sources      - Testing          - Strong beats
```

---

### Smoothing Factor Comparison

```
EXPONENTIAL SMOOTHING: smoothed = smoothed * factor + audio * (1-factor)

Factor  │ Half-life │ Response │ Use Case              │ Current Use
────────┼───────────┼──────────┼───────────────────────┼─────────────
0.95    │ ~14 fr    │ Very lag │ Extremely smooth      │
0.85    │ ~7 fr     │ Slow     │ Prevent jitter        │ ✅ Mid (distortion)
0.70    │ ~3 fr     │ Balanced │ Natural motion        │ ✅ Bass (scale)
0.50    │ ~1 fr     │ Fast     │ Responsive            │
0.00    │ instant   │ Instant  │ No smoothing          │ ✅ High (rotation, color)

Visual response to sudden change (0 → 1.0):

Factor 0.95 (sluggish)    Factor 0.70 (balanced)    Factor 0.00 (instant)
1.0│        ╭────          1.0│     ╭───             1.0│█
   │      ╭╯               │    ╭╯                    │
0.5│   ╭╯                  0.5│ ╭╯                   0.5│
   │ ╭╯                     │╭╯                        │
0.0└────────               0.0└────                  0.0└────
   0  5  10 15 frames         0  5  10 frames           0 frame

When to use:               When to use:              When to use:
- Trailing effects         - Scale, position         - Rotation, color
- Smooth motion            - General purpose         - Immediate response
- Prevent strobing         - Bass reactions          - Fast events
```

---

### Threshold Mapping Comparison

```
HARD THRESHOLD vs GATED (SMOOTHSTEP)

Hard Threshold:                  Gated (Smoothstep):
Output                           Output
1.0│    ████████                 1.0│       ╭████████
   │    █                           │     ╭╯
   │    █                           │   ╭╯
0.0│████                         0.0│███
   └────────── Input               └────────── Input
        0.7                              0.5  0.7

Code:                            Code:
if (audio > 0.7)                 smoothstep(0.5, 0.7, audio)
    value = 1.0;
else                             Smooth fade between
    value = 0.0;                 0.5 and 0.7

Use for:                         Use for:
- Binary states                  - Gradual activation
- Triggers                       - Fades
- Flash effects                  - Glow intensity
- Color inversion                - Opacity
```

---

### 1. Direct Mapping (Linear)

**Formula**: `visual = audio * scale + offset`

```javascript
float scale = bass * 0.8 + 0.2;  // Range: 0.2 to 1.0
```

**Characteristics**:
- Immediate 1:1 response
- Predictable and reliable
- Can feel mechanical

**Best for**: Clear cause-and-effect relationships

---

### 2. Threshold Mapping (Step Function)

**Formula**: `visual = audio > threshold ? onValue : offValue`

```javascript
bool glitchActive = mid > 0.7;
float distortion = glitchActive ? 1.0 : 0.0;
```

**Characteristics**:
- Binary on/off behavior
- Creates dramatic moments
- Clear activation points

**Best for**: Triggering discrete events (flashes, glitches, inversions)

**YOUR IMPLEMENTATION** (line 567):
```javascript
if (bass > 0.7 && currentTime - lastInversionTime > 500) {
    isInverted = true;  // Flash inversion trigger
}
```

---

### 3. Gated Mapping (Soft Threshold)

**Formula**: `visual = smoothstep(low, high, audio) * intensity`

```glsl
float glow = smoothstep(0.5, 0.8, bass) * 2.0;
```

**Characteristics**:
- Smooth fade-in/fade-out
- Prevents harsh jumps
- More organic than hard threshold

**Best for**: Gradual activations, fade effects

**HOW TO ADD TO YOUR CODE**:
```javascript
// In draw() function, add:
const glowFade = smoothstep(0.5, 0.8, bass);
// Use glowFade instead of raw bass for smoother glow
```

---

### 4. Power Curve Mapping (Non-linear)

**Formula**: `visual = pow(audio, exponent) * scale`

```javascript
float intensity = pow(bass, 3.0);  // Emphasizes peaks
```

**Exponent Effects** (see [Visual Comparison](#visual-comparison) above):
- `< 1.0`: Expands low values (more sensitive)
- `= 1.0`: Linear (neutral)
- `> 1.0`: Compresses low values (only reacts to peaks)

**Best for**: Controlling response sensitivity

**YOUR IMPLEMENTATION** (lines 524-526):
```javascript
bass = Math.pow(bass, 3.0);   // Very selective - only strong kicks
mid = Math.pow(mid, 1.5);     // Moderate emphasis
high = Math.pow(high, 1.5);   // Moderate emphasis
```

---

### 5. Exponential Smoothing

**Formula**: `smoothed = smoothed * decay + audio * (1 - decay)`

```javascript
smoothedBass = smoothedBass * 0.7 + bass * 0.3;
```

**Decay values** (see [Smoothing Comparison](#smoothing-factor-comparison) above):
- `0.9`: Very smooth, sluggish (90% history)
- `0.7`: Balanced (70% history) ← **Your bass uses this**
- `0.5`: Responsive (50% history)
- `0.2`: Twitchy (20% history)

**Best for**: Preventing jitter, creating inertia

**YOUR IMPLEMENTATION** (lines 544-545, 550-551):
```javascript
smoothedBass = smoothedBass * 0.7 + bass * 0.3;      // Scale smoothing
smoothedMid = smoothedMid * 0.85 + mid * 0.15;       // Distortion smoothing
```

---

### 6. Peak Detection with Decay

**Formula**: `peak = max(peak * decay, audio)`

```javascript
peakBass = Math.max(peakBass * 0.95, bass);
```

**Characteristics**:
- Captures sudden spikes
- Slowly decays when audio drops
- Creates "envelope follower" behavior

**Best for**: Pulsing effects that fade naturally

**HOW TO ADD TO YOUR CODE**:
```javascript
// Add to state
let peakBass = $state(0);

// In draw() function
peakBass = Math.max(peakBass * 0.95, bass);
// Use peakBass for effects that should hold and fade
```

---

### 7. Attack-Release Envelope

**Formula**: Dual-smoothing with different rates

```javascript
if (audio > smoothed) {
    smoothed = smoothed * 0.3 + audio * 0.7;  // Fast attack (70% new value)
} else {
    smoothed = smoothed * 0.9 + audio * 0.1;  // Slow release (90% history)
}
```

**Characteristics**:
- Snappy onset (fast attack)
- Graceful fade (slow release)
- Mimics natural instruments

**Best for**: Realistic feeling motion

**HOW TO ADD TO YOUR CODE**:
```javascript
// Replace simple smoothing with attack-release
if (bass > smoothedBass) {
    smoothedBass = smoothedBass * 0.3 + bass * 0.7;  // Snap to peak
} else {
    smoothedBass = smoothedBass * 0.9 + bass * 0.1;  // Gentle fall
}
```

---

### 8. Accumulator (Integration)

**Formula**: `value += audio * rate; value %= wrapPoint;`

```javascript
rotation += high * 0.8;
rotation = rotation % 360;
```

**Characteristics**:
- Never resets
- Builds over time
- Creates continuous motion

**Best for**: Rotation, scrolling, cyclic animations

**YOUR IMPLEMENTATION** (lines 559-560):
```javascript
rotation += high * 0.8;
rotation = rotation % 360;  // Wrap to prevent overflow
```

---

## Pattern Library

### Pattern 1: Pulse (Bass-Driven Scale)

**Audio Feature**: Bass
**Visual Parameter**: Scale
**Behavior**: Object grows on kick drums

**YOUR CURRENT CODE** (lines 540-547):
```javascript
// Analysis (line 524)
bass = Math.pow(bass, 3.0);  // Only strong kicks

// Smoothing (lines 544-545)
const bassSmoothing = 0.7;
smoothedBass = smoothedBass * bassSmoothing + bass * (1 - bassSmoothing);

// Mapping (line 547)
const scale = 0.15 + smoothedBass * 0.8;  // Range: 0.15 to 0.95
```

**GLSL Application** (shader line 250):
```glsl
vec2 rotated = rotate(uv - center, u_rotation) / u_scale + center;
// Dividing by scale zooms in (larger scale = more zoom)
```

**Visual Description**:
- Idle state: Small (15% scale = zoomed in)
- Peak bass: Large (95% scale = zoomed out more)
- Smooth transitions prevent jarring jumps
- 3-frame half-life creates natural pulse

**Use Cases**: EDM drops, hip-hop beats, any kick-heavy music

**Variations**:
```javascript
// Inverse pulse (shrinks on bass)
const scale = 1.0 - bass * 0.5;

// Dual pulse (different scales for bass vs mid)
const bassScale = 0.15 + smoothedBass * 0.6;
const midScale = bassScale + mid * 0.2;  // Add wobble

// Extreme pulse (wider range)
const scale = 0.05 + smoothedBass * 1.5;  // 0.05 to 1.55
```

---

### Pattern 2: Spin (High-Frequency Accumulation)

**Audio Feature**: High frequencies
**Visual Parameter**: Rotation
**Behavior**: Continuous rotation, faster with cymbals/hi-hats

**YOUR CURRENT CODE** (lines 559-560):
```javascript
// Analysis (line 526)
high = Math.pow(high, 1.5);

// Accumulation
rotation += high * 0.8;  // Degrees per frame
rotation = rotation % 360;
```

**GLSL Application** (shader lines 250, 590-591):
```glsl
vec2 rotate(vec2 v, float a) {
    float s = sin(a);
    float c = cos(a);
    mat2 m = mat2(c, -s, s, c);
    return m * v;
}

vec2 rotated = rotate(uv - center, u_rotation) + center;
```

**Visual Description**:
- Silence: Stationary
- High-hats (high ~0.3): Slow spin (~0.24°/frame, 14.4°/sec @ 60fps)
- Cymbal crash (high ~1.0): Fast spin (~0.8°/frame, 48°/sec @ 60fps)
- Accumulates forever (never resets)

**Use Cases**: DJ scratches, hi-hat patterns, cymbal work

**Variations**:
```javascript
// Bi-directional (can reverse)
rotation += (high - 0.5) * 1.6;  // Negative when high < 0.5

// Spring-back (slows naturally)
rotation += high * 0.8;
rotation *= 0.98;  // 2% friction

// Discrete steps (snap to 45° increments)
rotation += high * 0.8;
const snappedRotation = Math.round(rotation / 45) * 45;
```

---

### Pattern 3: Color Shift (High-Frequency Hue Rotation)

**Audio Feature**: High frequencies
**Visual Parameter**: Hue (HSV color space)
**Behavior**: Cycles through color spectrum

**YOUR CURRENT CODE** (line 563):
```javascript
const hueShift = high * 240;  // 0-240 degrees (2/3 of color wheel)
```

**GLSL Application** (shader lines 292-298):
```glsl
vec3 trailColorHSV = rgb2hsv(u_trailColor);
float colorHueShift = (u_hueShift / 360.0) * 1.0;
trailColorHSV.x = fract(trailColorHSV.x + colorHueShift);
trailColorHSV.y = min(1.0, trailColorHSV.y * 1.4);  // Boost saturation
trailColorHSV.z = min(1.0, trailColorHSV.z * 1.3);  // Boost brightness
vec3 shiftedTrailColor = hsv2rgb(trailColorHSV);
```

**Visual Description**:
- Silence: Base color (e.g., hot pink - hue 330°)
- Active highs: Shifts through red, orange, yellow, green, cyan
- Maximum shift: 240° (preserves some identity, doesn't wrap fully)
- No smoothing = rapid rainbow effect

**Color Wheel Reference**:
```
Hue Degrees:
0°   = Red
60°  = Yellow
120° = Green
180° = Cyan
240° = Blue
300° = Magenta
360° = Red (wraps)

Your base: Random from 12 swatches (line 54)
Shift range: Base + 0-240°
```

**Use Cases**: Energetic music, festivals, kaleidoscopic effects

**Variations**:
```javascript
// Full spectrum (complete rainbow)
const hueShift = high * 360;

// Slower shifts (half range)
const hueShift = high * 120;

// Complementary snap (jump 180°)
const hueShift = high > 0.7 ? 180 : 0;

// Discrete palette (steps of 60°)
const hueShift = Math.floor(high * 6) * 60;
```

---

### Pattern 4: Flash Inversion (Bass Threshold Trigger)

**Audio Feature**: Bass
**Visual Parameter**: Color inversion boolean
**Behavior**: Brief color flip on strong bass hits

**YOUR CURRENT CODE** (lines 565-576):
```javascript
const currentTime = Date.now();

// Trigger conditions
if (bass > 0.7 && currentTime - lastInversionTime > 500) {
    isInverted = true;
    inversionStartTime = currentTime;
    lastInversionTime = currentTime;
}

// Auto-revert after 300ms
if (isInverted && currentTime - inversionStartTime > 300) {
    isInverted = false;
}
```

**GLSL Application** (shader lines 326-332):
```glsl
if (u_invertColors) {
    float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
    if (luminance > 0.1) {  // Preserve black background
        finalColor = vec3(1.0) - finalColor;
    }
}
```

**Timing Diagram**:
```
Time:     0ms    500ms   800ms   1300ms  1600ms  2100ms
Bass:     0.8    0.3     0.9     0.4     0.8     0.5
          ↓                ↓                ↓
Trigger:  ✓      (cool)   ✓       (cool)  ✓      (cool)
          ↓                ↓                ↓
Invert:   ████           ████            ████
          0-300ms        800-1100ms      1600-1900ms

Cooldown: |---500ms---|  |---500ms---|  |---500ms---|
```

**Visual Description**:
- Sudden color negative on kick (white↔color, black stays black)
- 500ms cooldown prevents seizure-inducing strobing
- 300ms flash duration (brief but noticeable)
- Requires bass > 0.7 (about 34% of max with power curve)

**Safety Features**:
- ✅ Max flash rate: 2 per second (500ms cooldown)
- ✅ Limited duration (300ms)
- ✅ High threshold (0.7) prevents accidental triggers
- ✅ Preserves black (maintains visual anchors)

**Use Cases**: Dubstep drops, aggressive bass moments

**Variations**:
```javascript
// Hue shift instead of invert (safer)
if (bass > 0.7 && currentTime - lastFlash > 500) {
    hueShift += 180;  // Complementary color
    setTimeout(() => hueShift -= 180, 300);
}

// Saturation boost (dramatic but safe)
if (bass > 0.7) {
    saturationBoost = 2.0;
    setTimeout(() => saturationBoost = 1.0, 300);
}

// Brightness flash (additive white)
if (bass > 0.7) {
    brightnessAdd = 0.5;
    setTimeout(() => brightnessAdd = 0.0, 200);
}
```

---

### Pattern 5: Glitch Distortion (Mid-Frequency Intensity)

**Audio Feature**: Mid frequencies
**Visual Parameter**: Distortion amount
**Behavior**: UV warping increases with mid-range energy

**YOUR CURRENT CODE** (lines 549-557):
```javascript
// Smooth to reduce strobing (lines 550-551)
const smoothingFactor = 0.85;
smoothedMid = smoothedMid * smoothingFactor + mid * (1 - smoothingFactor);

// Only activate above threshold (lines 553-555)
const distortionThreshold = 0.5;
const distortionIntensity = Math.max(0, mid - distortionThreshold) / (1 - distortionThreshold);
const distortionAmount = distortionIntensity * 0.6;

// Speed up animation when glitching (lines 556-557)
const distortionSpeed = 0.02 + distortionIntensity * 0.2;
time += distortionSpeed;
```

**GLSL Application** (shader lines 204-246 - Type 4 Enhanced Glitch):
```glsl
float glitchSeed = floor(u_time * 3.5);  // Changes every ~0.29 sec
float block1 = step(0.6, sin(uv.y * 15.0 + glitchSeed * 13.7));
float disp1 = (random(vec2(glitchSeed, 1.0)) - 0.5);
uv.x += block1 * disp1 * u_distortionAmount * 0.12;
// ... multiple layers of glitch
```

**Activation Curve**:
```
Mid Input:    0.0   0.3   0.5   0.7   0.9   1.0
              ↓     ↓     ↓     ↓     ↓     ↓
After ^1.5:   0.00  0.16  0.35  0.58  0.85  1.00
After smooth: (smoothed over ~7 frames)
After gate:   0.00  0.00  0.00  0.16  0.70  1.00  ← distortionIntensity
Final amount: 0.00  0.00  0.00  0.10  0.42  0.60  ← distortionAmount

Visual:       None  None  None  Mild  Strong Max
```

**Visual Description**:
- Below 50% mid: No distortion (clean)
- 50-70% mid: Subtle horizontal shifts
- 70-90% mid: Obvious datamosh effect
- 90-100% mid: Severe corruption
- Changes every ~0.29 seconds (glitchSeed updates)
- Time speeds up during glitch (creates more chaotic motion)

**Use Cases**: Snare drums, synth stabs, vocal processing, aggressive moments

**Variations**:
```javascript
// Lower threshold (more sensitive)
const distortionThreshold = 0.3;

// Different distortion type per band
const distortionType = bass > 0.7 ? 4 : (mid > 0.5 ? 2 : 0);

// Smooth/hard toggle
const distortionAmount = mid > 0.7 ? 0.8 : 0.0;  // Hard switch
```

---

### Pattern 6: Glow Intensity (Bass-Driven Brightness)

**Audio Feature**: Bass
**Visual Parameter**: Edge glow brightness
**Behavior**: Edges brighten on bass hits

**YOUR CURRENT CODE** (line 616):
```javascript
const glowIntensityLocation = gl.getUniformLocation(program, 'u_glowIntensity');
gl.uniform1f(glowIntensityLocation, bass);  // Raw bass, no smoothing
```

**GLSL Application** (shader lines 282-289, 301-302):
```glsl
// Texture glow (lines 282-289)
float glowBoost = 1.0 + u_glowIntensity * 3.0;  // 1x to 4x
textureColorHSV.z = min(1.0, textureColorHSV.z * glowBoost);
vec3 textureColor = hsv2rgb(textureColorHSV);

float colorMixAmount = gray * texColor.a * (0.8 + u_glowIntensity * 0.5);
normalColor = mix(normalColor, textureColor * gray, colorMixAmount);

// Edge glow (lines 301-302)
vec3 coloredEdge = shiftedTrailColor * edge * 1.5;
normalColor += coloredEdge;  // Additive blending
```

**Brightness Curve**:
```
Bass Input:   0.0   0.3   0.5   0.7   0.9   1.0
              ↓     ↓     ↓     ↓     ↓     ↓
After ^3.0:   0.00  0.03  0.13  0.34  0.73  1.00
Glow boost:   1.0x  1.1x  1.4x  2.0x  3.2x  4.0x
```

**Visual Description**:
- Silence: Subtle colored outlines (1.0x baseline brightness)
- Moderate bass (0.5): Noticeable glow (1.4x brightness)
- Strong bass (0.7): Bright glow (2.0x brightness)
- Peak bass (1.0): Intense HDR-like overbright (4.0x brightness)
- No smoothing = immediate, punchy response

**Use Cases**: Neon aesthetics, emphasis on rhythm, sci-fi looks

**Variations**:
```javascript
// Smoother glow (add smoothing)
smoothedBassForGlow = smoothedBassForGlow * 0.5 + bass * 0.5;
gl.uniform1f(glowIntensityLocation, smoothedBassForGlow);

// Subtler glow (reduce multiplier)
// In shader: float glowBoost = 1.0 + u_glowIntensity * 1.5;  // 1x to 2.5x

// Extreme glow (increase multiplier)
// In shader: float glowBoost = 1.0 + u_glowIntensity * 5.0;  // 1x to 6x

// Color temperature shift (warm glow)
// In shader: textureColorHSV.x -= u_glowIntensity * 0.1;  // Shift toward red/orange
```

---

### Pattern 7: Trail Decay Rate (Dynamic Persistence)

**Audio Feature**: Mid frequencies or RMS
**Visual Parameter**: Trail fade speed
**Behavior**: Trails linger longer during loud parts

```javascript
// NOT CURRENTLY IMPLEMENTED - here's how to add it:

// Calculate RMS from dataArray
function calculateRMS(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        const normalized = data[i] / 255;
        sum += normalized * normalized;
    }
    return Math.sqrt(sum / data.length);
}

// In draw() function
const rms = calculateRMS(dataArray);
const trailDecay = 0.85 + rms * 0.1;  // Range: 0.85 to 0.95

// Pass to shader
const trailDecayLocation = gl.getUniformLocation(program, 'u_trailDecay');
gl.uniform1f(trailDecayLocation, trailDecay);
```

**GLSL** (already in shader at lines 305-306):
```glsl
vec4 previousTrail = texture2D(u_trailTexture, v_texCoord);
vec3 decayedTrail = previousTrail.rgb * u_trailDecay;
```

**Decay Comparison**:
```
Decay Rate:   0.85      0.90      0.95      0.98
              ↓         ↓         ↓         ↓
Half-life:    4 frames  7 frames  14 frames 35 frames
Visible for:  ~15 fr    ~25 fr    ~50 fr    ~120 fr
              (250ms)   (417ms)   (833ms)   (2000ms)

Visual:       Sharp     Natural   Long      Very long
              trails    trails    trails    trails
```

**Visual Description**:
- Quiet passage (RMS low): Fast fade (0.85) → crisp, defined trails
- Loud section (RMS high): Slow fade (0.95) → ethereal, ghostly trails
- Creates breathing, organic quality
- Trails accumulate during intense moments

**Use Cases**: Dynamic range expression, ambient sections, build-ups

**Current Implementation**: Fixed at 0.92 (line 620)

**Variations**:
```javascript
// Inverse mapping (long trails when quiet - more ethereal)
const trailDecay = 0.95 - rms * 0.1;

// Threshold-based (trails on/off completely)
const trailDecay = rms > 0.5 ? 0.95 : 0.7;

// Bass-driven (trails on kicks)
const trailDecay = 0.85 + bass * 0.12;  // 0.85 to 0.97
```

---

### Pattern 8: Zoom Wobble (Bass + Mid Combination)

**Audio Feature**: Bass (primary) + Mid (modulation)
**Visual Parameter**: Scale with oscillation
**Behavior**: Pulse with secondary wobble

```javascript
// NOT CURRENTLY IMPLEMENTED - here's how to add it:

const bass = Math.pow(bassRaw, 3.0);
const mid = Math.pow(midRaw, 1.5);

smoothedBass = smoothedBass * 0.7 + bass * 0.3;

// Primary scale from bass
const baseScale = 0.15 + smoothedBass * 0.6;

// Wobble from mid (±20%)
const wobble = Math.sin(time * 10) * mid * 0.2;

const finalScale = baseScale + wobble;
```

**Visual Description**:
- Bass provides main pulse (slow, rhythmic)
- Mids add high-frequency vibration (fast, jittery)
- Creates "dubstep wobble" visual effect
- Wobble frequency: 10 rad/sec ≈ 1.6 Hz

**Use Cases**: Dubstep, wobble bass, modulated synths, LFO-heavy music

**HOW TO ADD TO YOUR CODE**:
Replace line 547 with:
```javascript
const baseScale = 0.15 + smoothedBass * 0.6;
const wobble = Math.sin(time * 10) * smoothedMid * 0.15;  // Use smoothedMid
const scale = baseScale + wobble;
```

**Variations**:
```javascript
// Faster wobble (higher frequency)
const wobble = Math.sin(time * 20) * mid * 0.2;  // 3.2 Hz

// Triangle wave (sharper wobble)
const wobble = (((time * 10) % (Math.PI * 2)) / Math.PI - 1) * mid * 0.2;

// Random wobble (chaotic)
const wobble = (Math.random() - 0.5) * mid * 0.3;
```

---

### Pattern 9: Strobe (Threshold with Timer)

**Audio Feature**: Any (typically bass or mid)
**Visual Parameter**: Opacity
**Behavior**: Rapid on/off flashing

```javascript
// ⚠️ USE WITH EXTREME CAUTION - SEIZURE RISK

const bass = Math.pow(bassRaw, 3.0);
let strobeActive = false;
let strobeStartTime = 0;

if (bass > 0.8) {
    strobeActive = true;
    strobeStartTime = Date.now();
}

let opacity = 1.0;
if (strobeActive) {
    const elapsed = Date.now() - strobeStartTime;
    const strobeFreq = 10;  // Hz (REDUCED from 20)
    opacity = Math.sin(elapsed * strobeFreq * Math.PI / 500) > 0 ? 0.7 : 1.0;

    if (elapsed > 300) strobeActive = false;  // 300ms duration
}

// Apply opacity in shader
gl.uniform1f(opacityLocation, opacity);
```

**⚠️ SAFETY WARNINGS**:
- **SEIZURE RISK**: Photosensitive epilepsy can be triggered by 15-25 Hz flashing
- **DO NOT** use frequencies above 10 Hz
- **DO NOT** use high-contrast flashing (white↔black)
- **ALWAYS** provide user toggle to disable
- **CONSIDER** not implementing this pattern at all

**Safer Alternatives**:
```javascript
// Opacity range (0.3-1.0 instead of 0.0-1.0)
opacity = Math.sin(elapsed * 5 * Math.PI / 500) * 0.35 + 0.65;  // 0.3 to 1.0

// Sine wave (smooth instead of square)
opacity = 0.5 + 0.3 * Math.sin(elapsed * 5 * Math.PI / 500);  // 0.2 to 0.8

// Lower frequency (5 Hz instead of 20 Hz)
const strobeFreq = 5;
```

**Use Cases**: Extreme moments (sparingly!), EDM buildups (with user consent)

---

### Pattern 10: Particle Burst (Onset Detection)

**Audio Feature**: Onset/transient detection
**Visual Parameter**: Particle spawn
**Behavior**: Explosion of elements on sudden sounds

```javascript
// NOT CURRENTLY IMPLEMENTED - requires particle system

// Simple onset detection
let previousRMS = 0;

function detectOnset(dataArray) {
    const currentRMS = calculateRMS(dataArray);
    const rmsDelta = currentRMS - previousRMS;
    previousRMS = currentRMS;

    return rmsDelta;
}

// In draw() function
const onset = detectOnset(dataArray);

if (onset > 0.3 && Date.now() - lastBurst > 200) {
    spawnParticles({
        count: Math.floor(onset * 50),
        velocity: onset * 5,
        color: currentColor,
        position: [centerX, centerY]
    });
    lastBurst = Date.now();
}
```

**Visual Description**:
- Sudden loud moment → particle explosion
- Particle count based on onset intensity (0-50 particles)
- Initial velocity based on loudness
- 200ms cooldown prevents particle spam

**Use Cases**: Drum fills, drops, impacts, transitions

**Variations**:
```javascript
// Direction based on frequency
const direction = bass > 0.7 ? 'down' : (high > 0.7 ? 'up' : 'outward');

// Size based on spectral content
const particleSize = map(spectralCentroid, 2000, 8000, 2, 10);

// Lifetime based on sustain
const lifetime = map(currentRMS, 0, 1, 500, 2000);  // ms
```

---

## Combination Patterns

### Multi-Dimensional Mapping

**Principle**: Use different frequency bands for different visual dimensions

**YOUR CURRENT IMPLEMENTATION** - You're already doing this well!

```javascript
// Bass → Scale (size)
const scale = 0.15 + smoothedBass * 0.8;  ✅

// Mid → Distortion (chaos)
const distortion = Math.max(0, mid - 0.5) * 1.2;  ✅

// High → Rotation (spin)
rotation += high * 0.8;  ✅

// High → Color (hue)
const hueShift = high * 240;  ✅

// Bass trigger → Flash (punctuation)
if (bass > 0.7) triggerFlash();  ✅
```

**Why this works**:
- Each frequency band affects a different visual dimension
- Bass (low, sparse) → slow, big changes (scale, flash)
- Mid (sustained) → continuous effects (distortion)
- High (fast, textural) → rapid changes (rotation, color)
- **Result**: Rich, layered response without overwhelming the viewer

**What you could add**:
```javascript
// RMS → Trail decay (overall energy affects motion blur)
const trailDecay = 0.85 + rms * 0.1;

// Bass → Glow (already implemented!)
gl.uniform1f(glowIntensityLocation, bass);  ✅

// Spectral Centroid → Color temperature
const warmth = map(spectralCentroid, 2000, 8000, 0.3, 0.8);
```

---

### Layered Effects with Priority

**Principle**: Some effects should override others

```javascript
// Priority system for your distortion types

function selectDistortionType(bass, mid, high) {
    // Priority 1: Flash inverts everything (highest)
    if (isInverted) {
        return currentDistortionType;  // Keep current, just invert
    }

    // Priority 2: Extreme bass forces glitch
    if (bass > 0.9) {
        return 4;  // Enhanced glitch
    }

    // Priority 3: High mids trigger glitch
    if (mid > 0.7) {
        return 4;  // Enhanced glitch
    }

    // Priority 4: Normal state
    return defaultDistortionType;  // Random from startup
}
```

**YOUR CURRENT IMPLEMENTATION**: Fixed distortion type (random at startup, line 58)

**HOW TO ADD DYNAMIC SWITCHING**:
```javascript
// In draw() function, before setting uniforms
const newDistortionType = selectDistortionType(bass, mid, high);
if (newDistortionType !== distortionType) {
    distortionType = newDistortionType;
}
```

---

### Crossfading Between States

**Principle**: Smooth transitions between effect modes

```javascript
// Smooth distortion type changes

let currentDistortionOpacity = 1.0;
let targetDistortionType = 0;

function updateDistortionType(target) {
    if (target !== targetDistortionType) {
        targetDistortionType = target;
    }
}

// In draw() function
const transitionSpeed = 0.05;

if (targetDistortionType !== currentDistortionType) {
    // Fade out current effect
    currentDistortionOpacity = Math.max(0, currentDistortionOpacity - transitionSpeed);

    if (currentDistortionOpacity === 0) {
        currentDistortionType = targetDistortionType;
    }
} else {
    // Fade in
    currentDistortionOpacity = Math.min(1, currentDistortionOpacity + transitionSpeed);
}

// Apply opacity to distortion amount
const finalDistortionAmount = distortionAmount * currentDistortionOpacity;
```

---

## Genre-Specific Patterns

### Electronic/EDM

**Characteristics**: Heavy bass, clear structure, builds & drops

```javascript
// Extreme bass response
const bass = Math.pow(bassRaw, 4.0);  // Very selective (current: 3.0)
const scale = 0.1 + bass * 1.5;  // Wide range (current: 0.15 + 0.8)

// Build-up detection (increasing high energy)
let highTrend = 0;
highTrend = highTrend * 0.95 + (high - previousHigh) * 0.05;

if (highTrend > 0.05) {  // Rising highs
    glitchIntensity += 0.01;  // Accumulate chaos
    glitchIntensity = Math.min(glitchIntensity, 1.0);
}

// Drop detection (sudden bass after build)
if (bass > 0.8 && previousBass < 0.3) {
    triggerDrop();  // Max all effects simultaneously
}

function triggerDrop() {
    // Flash
    isInverted = true;
    setTimeout(() => isInverted = false, 500);

    // Extreme distortion
    distortionAmount = 1.0;

    // Reset rotation for visual impact
    rotation = 0;
}
```

**HOW TO ADAPT YOUR CODE FOR EDM**:
1. Increase bass power curve: `3.0` → `4.0` (line 524)
2. Wider scale range: `0.15 + bass * 0.8` → `0.1 + bass * 1.5` (line 547)
3. Add build-up detection as shown above
4. Reduce distortion threshold: `0.5` → `0.3` (line 553)

---

### Hip-Hop/Trap

**Characteristics**: Sparse kicks, snare emphasis, hi-hat rolls

```javascript
// Hard-hitting bass (minimal smoothing)
const bassSmoothing = 0.5;  // More responsive (current: 0.7)
smoothedBass = smoothedBass * bassSmoothing + bass * (1 - bassSmoothing);
const scale = 0.5 + bass * 0.5;  // Immediate, punchy response

// Hi-hat roll detection (rapid high-freq changes)
let highChangeRate = 0;
highChangeRate = Math.abs(high - previousHigh);

if (highChangeRate > 0.3) {  // Rapid change
    spinSpeed = 3.0;  // Triple rotation speed
} else {
    spinSpeed = 1.0;  // Normal
}

rotation += high * 0.8 * spinSpeed;

// 808 sub-bass (very low freq - bins 0-2)
const subBass = (dataArray[0] + dataArray[1] + dataArray[2]) / 3 / 255;
if (subBass > 0.6) {
    // Camera shake or extra glow
    glowBoost = 2.0;
}
```

**HOW TO ADAPT YOUR CODE FOR HIP-HOP**:
1. Reduce bass smoothing: `0.7` → `0.5` (line 544)
2. Add hi-hat roll detection as shown
3. Consider sub-bass separately from main bass

---

### Rock/Live Instruments

**Characteristics**: Full spectrum, dynamic range, less quantized

```javascript
// Broad mid-range for guitar/vocals
// Wider frequency band (bins 4-32 instead of 4-16)
let midSum = 0;
for (let i = 4; i < 32; i++) {
    midSum += dataArray[i];
}
let mid = midSum / 28 / 255;
mid = Math.pow(mid, 1.5);

const glow = smoothstep(0.3, 0.7, mid);

// Cymbal crashes (high + loud simultaneously)
const rms = calculateRMS(dataArray);
if (high > 0.7 && rms > 0.6) {
    flashWhite();  // Bright burst
}

function flashWhite() {
    // Add white overlay instead of inversion
    brightnessBoost = 0.5;
    setTimeout(() => brightnessBoost = 0.0, 200);
}

// Natural dynamics (less aggressive power curve)
const bass = Math.pow(bassRaw, 2.0);  // Gentler (current: 3.0)
const scale = 0.3 + bass * 0.4;  // Follow overall loudness
```

**HOW TO ADAPT YOUR CODE FOR ROCK**:
1. Gentler bass curve: `3.0` → `2.0` (line 524)
2. Wider mid band: `4-16` → `4-32` (lines 512-514)
3. Add cymbal crash detection (high + loud)

---

### Ambient/Atmospheric

**Characteristics**: Sustained tones, slow evolution, subtle changes

```javascript
// Very slow smoothing (hold state longer)
smoothedRMS = smoothedRMS * 0.95 + rms * 0.05;  // Very sluggish

// Long trails (persistent motion blur)
const trailDecay = 0.98;  // Very slow fade (current: 0.92)

// Gentle color drift (continuous, not reactive)
hue += 0.1;  // Slow constant shift
hue = hue % 360;

// Spectral centroid → color temperature
const spectralCentroid = calculateSpectralCentroid(dataArray);
const warmth = map(spectralCentroid, 2000, 8000, 0.8, 0.2);
// 0.8 = warm (low freq), 0.2 = cool (high freq)

function calculateSpectralCentroid(data) {
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < data.length; i++) {
        const freq = i * (sampleRate / 2) / data.length;
        const magnitude = data[i] / 255;
        numerator += freq * magnitude;
        denominator += magnitude;
    }
    return denominator > 0 ? numerator / denominator : 2000;
}

// Minimal bass response (subtle pulse)
const scale = 0.5 + bass * 0.2;  // Small range (current: 0.15 + 0.8)
```

**HOW TO ADAPT YOUR CODE FOR AMBIENT**:
1. Increase trail decay: `0.92` → `0.98` (line 620)
2. Reduce scale range: `0.15 + bass * 0.8` → `0.5 + bass * 0.2` (line 547)
3. Add continuous slow hue drift instead of reactive
4. Very slow smoothing: `0.7` → `0.95`

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Over-Responsiveness

**Problem**: Every tiny audio change creates visual jitter

```javascript
// BAD: No smoothing, raw data
const scale = bass;  // Twitchy and unpleasant
```

**What happens**: Scale jumps erratically, causes nausea, looks unprofessional

**Solution**: Apply appropriate smoothing
```javascript
// GOOD: Smoothed for natural motion
smoothedBass = smoothedBass * 0.7 + bass * 0.3;
const scale = smoothedBass;
```

**YOUR CODE**: ✅ Already doing this correctly (lines 544-545)

---

### ❌ Anti-Pattern 2: Visual Overload

**Problem**: Too many effects responding simultaneously

```javascript
// BAD: Everything reacts to everything
rotation += bass + mid + high;  // Chaotic mess
scale += bass + mid + high;
hue += bass + mid + high;
```

**What happens**: Viewer can't understand cause-effect, overwhelming, confusing

**Solution**: Orthogonal mapping (different bands → different dimensions)
```javascript
// GOOD: Dedicated mappings
rotation += high;  // Only highs spin
scale += bass;     // Only bass scales
hue += high;       // Only highs shift color
```

**YOUR CODE**: ✅ Already doing this correctly

---

### ❌ Anti-Pattern 3: Imperceptible Changes

**Problem**: Visual response is too subtle to notice

```javascript
// BAD: 1% change in scale
const scale = 0.995 + bass * 0.005;  // Barely visible
```

**What happens**: User thinks nothing is happening, wasted CPU/GPU

**Solution**: Sufficient dynamic range
```javascript
// GOOD: 15% to 95% range
const scale = 0.15 + bass * 0.8;  // Clear pulse
```

**YOUR CODE**: ✅ Excellent dynamic range (0.15 to 0.95)

---

### ❌ Anti-Pattern 4: Strobing/Seizures

**Problem**: Rapid high-contrast flashing

```javascript
// DANGEROUS: Rapid color inversion
if (bass > 0.5) {  // Too low threshold
    invertColors();  // Could flash 30+ times per second
}
// No cooldown = SEIZURE RISK
```

**What happens**: Photosensitive epilepsy trigger, legal liability, user harm

**Solution**: Cooldowns and smooth transitions
```javascript
// SAFE: Cooldown + duration limit + high threshold
if (bass > 0.7 && Date.now() - lastFlash > 500) {
    triggerFlash(300);  // 300ms duration, 500ms cooldown
}
```

**YOUR CODE**: ✅ Safe implementation (threshold 0.7, 500ms cooldown, 300ms duration)

---

### ❌ Anti-Pattern 5: Unintentional Feedback

**Problem**: Values accumulate without bounds

```javascript
// BAD: Continuous accumulation without bounds
rotation += high;  // Grows forever → eventually overflows
scale += bass;     // Grows forever → eventually invisible
```

**What happens**: After minutes/hours, values become astronomical, visual breaks

**Solution**: Use modulo or clamping
```javascript
// GOOD: Bounded behavior
rotation = (rotation + high) % 360;  // Wraps at 360°
scale = Math.min(2.0, 0.15 + bass * 0.8);  // Clamped at 2.0
```

**YOUR CODE**: ✅ Rotation wrapped (line 560), scale naturally bounded

---

## Design Principles

### Principle 1: Predictable Causality

**Users should intuitively understand what audio causes what visual**

**Natural Mappings** (based on perceptual psychology):
- **Bass → Big/near things**: Scale, zoom, camera movement
  - Why: Low frequencies feel "heavy" and "large"
  - Your code: ✅ Bass → scale

- **High → Fast/small things**: Rotation, detail, color shifts
  - Why: High frequencies feel "quick" and "light"
  - Your code: ✅ High → rotation, hue shift

- **Mid → Sustained effects**: Distortion, continuous flow
  - Why: Mids are melodic and sustained
  - Your code: ✅ Mid → distortion

**Counter-intuitive mappings** (use sparingly, only for artistic effect):
- Bass → color (works, but less intuitive)
- High → scale (feels backwards)
- Random → any (breaks causality)

---

### Principle 2: Musical Structure Awareness

**Respect the song's dynamics**

Typical song structure:
- **Intro**: Minimal (show baseline aesthetic)
- **Verse**: Subtle, restrained (30-50% effect intensity)
- **Chorus**: Moderate, building (60-80% effect intensity)
- **Drop**: Maximum intensity (100% effect intensity)
- **Bridge/Breakdown**: Minimal or inverted (different aesthetic)
- **Outro**: Fade out

**Implementation** (energy-adaptive effects):
```javascript
// Track average RMS over time
let averageRMS = 0;
averageRMS = averageRMS * 0.999 + rms * 0.001;  // Very slow average

// Detect energy trends
const energyTrend = currentRMS - averageRMS;

let effectIntensityMultiplier = 1.0;
if (energyTrend > 0.2) {
    effectIntensityMultiplier = 1.5;  // Amp up for high-energy sections
} else if (energyTrend < -0.2) {
    effectIntensityMultiplier = 0.5;  // Pull back for low-energy sections
}

// Apply to all effects
const adjustedScale = baseScale * effectIntensityMultiplier;
const adjustedDistortion = distortionAmount * effectIntensityMultiplier;
```

---

### Principle 3: Negative Space

**Not everything needs to be reacting all the time**

```javascript
// BAD: Constant motion even in silence
rotation += high * 0.8;  // Always adding

// BETTER: Only spin when highs are present
if (high > 0.3) {
    rotation += high * 0.8;
} else {
    rotation *= 0.95;  // Slow down naturally (friction)
}
```

**Benefits of negative space**:
- Creates contrast (makes active moments more impactful)
- Prevents visual fatigue
- Allows viewer to "reset"
- More professional/polished feel

**YOUR CODE**: Could benefit from this
```javascript
// Add to line 560:
if (high > 0.2) {
    rotation += high * 0.8;
} else {
    rotation *= 0.98;  // Gentle friction
}
```

---

### Principle 4: Complementary Motions

**Effects should enhance, not fight each other**

```javascript
// GOOD: Scale and rotation create secondary rhythm
const scale = 0.5 + bass * 0.5;
const rotationSpeed = high * (2.0 - scale);  // Faster when smaller
rotation += rotationSpeed;

// When scale is large (1.0): rotationSpeed = high * 1.0 (normal)
// When scale is small (0.5): rotationSpeed = high * 1.5 (50% faster)
```

**Result**: Visual complexity without chaos

**Other complementary combinations**:
- Distortion + slow rotation: Chaotic shape + smooth motion
- Fast color shift + steady scale: Dynamic hue + stable size
- Trails + pulsing: Motion blur + rhythmic emphasis

---

### Principle 5: Escape Hatches

**Provide variety to prevent monotony**

```javascript
// Every 16 beats, introduce variation
let beatCount = 0;

// Simple beat detection
if (bass > 0.7 && Date.now() - lastBeat > 300) {
    beatCount++;
    lastBeat = Date.now();
}

if (beatCount % 16 === 0) {
    // Randomize something
    distortionType = Math.floor(Math.random() * 5);

    // Or cycle through options
    const colorPalette = colorPalettes[beatCount % colorPalettes.length];
}
```

**YOUR CODE**: Distortion type is random at startup but never changes
```javascript
// Line 58 - consider making dynamic:
let distortionType = $state(Math.floor(Math.random() * 5));

// Add periodic randomization in draw():
if (beatCount % 32 === 0) {
    distortionType = Math.floor(Math.random() * 5);
}
```

---

## Calibration Guide

### Understanding Threshold Values

**What does "bass > 0.7" actually mean?**

```
Raw bass from FFT:     0-255 (per frequency bin)
Normalized:            0-1   (divided by 255)
Averaged (bins 0-3):   0-1   (sum of 4 bins / 4)
Power curve (^3.0):    0-1   (emphasizes peaks)
Smoothed (0.7 factor): 0-1   (delayed by ~3 frames)

So bass > 0.7 means:
- After power curve: Original value was ~0.89 (0.89^3 ≈ 0.7)
- After averaging: Sum of bins 0-3 was ~227/255
- In practice: Strong kick drum, not background rumble
```

### Calibration Checklist

Test your effects with these scenarios:

**□ Silence Test**
- Play no audio
- Expected: Minimal/baseline visuals
- All effects should show base state

**□ Kick Drum Test**
- Play isolated kick drum pattern
- Expected: Only bass effects activate (scale, glow, flash)
- Mid and high effects should be quiet

**□ Hi-Hat Test**
- Play isolated hi-hat pattern
- Expected: Only high effects activate (rotation, color)
- Bass and mid effects should be quiet

**□ Snare Test**
- Play isolated snare pattern
- Expected: Mid effects activate (distortion)
- May trigger some bass if snare has low-end

**□ Full Mix Test**
- Play complete song
- Expected: All effects work together
- Check for visual overload

**□ Quiet Track Test**
- Play quiet/acoustic track
- Expected: Effects still visible but subtle
- Thresholds should not be too high

**□ Loud Track Test**
- Play heavily compressed/limited track (pop/EDM)
- Expected: Effects don't max out constantly
- Power curves should prevent saturation

**□ Dynamic Range Test**
- Play classical or jazz (wide dynamics)
- Expected: Effects respond to full range
- Quiet passages should still show some activity

### Reference Tracks

Suggested test songs with timestamps:

**For Bass Testing**:
- Electronic: Skrillex - "Scary Monsters and Nice Sprites" (drop at 0:56)
- Hip-Hop: Travis Scott - "SICKO MODE" (bass at 0:32)
- Expectation: Bass value should hit 0.7-1.0 on kicks

**For Mid Testing**:
- Electronic: deadmau5 - "Strobe" (synths at 3:30)
- Rock: Red Hot Chili Peppers - "Can't Stop" (guitar at 0:15)
- Expectation: Mid value should exceed 0.5 on snares/synths

**For High Testing**:
- Electronic: Daft Punk - "Around the World" (hi-hats throughout)
- Jazz: Whiplash Soundtrack - "Caravan" (cymbals at 1:00)
- Expectation: High value should spike on hi-hats/cymbals

### Tuning Process

1. **Add debug overlay** (see [Debugging Tools](#debugging-tools))
2. **Play reference track**
3. **Observe audio values in real-time**
4. **Adjust thresholds**:
   - If bass never reaches 0.7 → lower threshold or reduce power curve
   - If bass always above 0.7 → increase power curve exponent
5. **Iterate until feels right**

### Common Calibration Issues

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| Bass never triggers | Power curve too high (^3.0) | Reduce to ^2.0 or ^2.5 |
| Bass always maxed | Audio too loud / compressed | Increase power curve to ^4.0 |
| Scale barely changes | Dynamic range too small | Increase multiplier (0.8 → 1.5) |
| Rotation too fast | High multiplier too large | Reduce (0.8 → 0.4) |
| Distortion strobes | Smoothing too low | Increase smoothing (0.85 → 0.92) |
| Flash too frequent | Threshold too low | Increase (0.7 → 0.8) |
| No color change | High values too low | Reduce power curve (^1.5 → ^1.0) |

---

## Troubleshooting Guide

### Problem: Effects are jittery/twitchy

**Symptoms**: Visual parameters jump erratically

**Diagnosis**:
```javascript
// Check if smoothing is applied
console.log('Raw bass:', bass, 'Smoothed:', smoothedBass);
// If they're the same → no smoothing
```

**Solutions**:
1. Increase smoothing factor: `0.7` → `0.85`
2. Add smoothing to unsmoothed values (rotation, color)
3. Check for NaN values: `if (isNaN(smoothedBass)) smoothedBass = 0;`

---

### Problem: Bass threshold never triggers

**Symptoms**: Flash inversion never happens, scale barely changes

**Diagnosis**:
```javascript
// Add debug logging
console.log('Bass value:', bass);
// Play a kick-heavy track - if bass never exceeds 0.7, threshold is too high
```

**Solutions**:
1. Lower threshold: `0.7` → `0.5` or `0.6`
2. Reduce power curve: `^3.0` → `^2.0`
3. Check audio source volume (might be too quiet)
4. Try different audio source (some files are heavily compressed)

---

### Problem: Scale dynamic range feels wrong

**Symptoms**: Barely visible pulse, or too extreme

**Diagnosis**:
```javascript
console.log('Scale range:', 0.15 + 0 * 0.8, 'to', 0.15 + 1 * 0.8);
// Should be: 0.15 to 0.95
// If feels too subtle: increase multiplier
// If feels too extreme: decrease multiplier
```

**Solutions**:
```javascript
// More dramatic pulse
const scale = 0.05 + smoothedBass * 1.2;  // 0.05 to 1.25

// Subtler pulse
const scale = 0.3 + smoothedBass * 0.4;  // 0.3 to 0.7
```

---

### Problem: Rotation is too fast/slow

**Symptoms**: Spinning too rapidly or barely moving

**Diagnosis**:
```javascript
console.log('High value:', high, 'Rotation delta:', high * 0.8);
// At 60fps: 0.8°/frame = 48°/sec (full rotation in 7.5 seconds)
```

**Solutions**:
```javascript
// Faster rotation
rotation += high * 1.5;  // 90°/sec

// Slower rotation
rotation += high * 0.3;  // 18°/sec

// Cap maximum speed
const rotationDelta = Math.min(high * 0.8, 2.0);  // Max 2°/frame
rotation += rotationDelta;
```

---

### Problem: Distortion strobes (flickers rapidly)

**Symptoms**: Glitch effect turns on/off too quickly

**Diagnosis**:
```javascript
console.log('Mid (raw):', mid, 'Smoothed:', smoothedMid);
// If smoothedMid crosses threshold rapidly → increase smoothing
```

**Solutions**:
1. Increase smoothing: `0.85` → `0.92`
2. Increase threshold: `0.5` → `0.6`
3. Add hysteresis:
```javascript
let distortionActive = false;
if (mid > 0.6 && !distortionActive) {
    distortionActive = true;  // Turn on at 0.6
} else if (mid < 0.4 && distortionActive) {
    distortionActive = false;  // Turn off at 0.4 (lower threshold)
}
```

---

### Problem: Flash inversion happens too often/rarely

**Symptoms**: Seizure-inducing flashing, or never triggers

**Diagnosis**:
```javascript
console.log('Bass:', bass, 'Last inversion:', Date.now() - lastInversionTime);
// Should see 500+ms between triggers
```

**Solutions**:
```javascript
// More frequent (dangerous - ensure 500ms cooldown stays!)
if (bass > 0.6 && currentTime - lastInversionTime > 500) {

// Less frequent
if (bass > 0.8 && currentTime - lastInversionTime > 1000) {

// Longer flash duration
if (isInverted && currentTime - inversionStartTime > 500) {  // Was 300ms
```

---

### Problem: No color changes visible

**Symptoms**: Hue appears static

**Diagnosis**:
```javascript
console.log('High:', high, 'Hue shift:', high * 240);
// Should see 0-240 range
```

**Solutions**:
1. Reduce power curve on high: `^1.5` → `^1.0` (line 526)
2. Increase shift range: `* 240` → `* 360`
3. Check if base color is too dark (won't show hue shifts)
4. Add constant slow drift:
```javascript
const hueShift = high * 240 + (time * 0.5);  // Adds continuous rotation
```

---

### Problem: WebGL context lost

**Symptoms**: Black screen, console error "WebGL context lost"

**Diagnosis**:
- Too many textures
- GPU crash
- Tab backgrounded too long

**Solutions**:
```javascript
// Add context loss handler
canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.log('WebGL context lost');
    cancelAnimationFrame(animationId);
}, false);

canvas.addEventListener('webglcontextrestored', () => {
    console.log('WebGL context restored');
    setupWebGL();  // Reinitialize
}, false);
```

---

### Problem: Performance degradation over time

**Symptoms**: Starts smooth, becomes laggy after minutes

**Diagnosis**:
- Memory leak
- Texture/buffer not cleaned up
- Accumulating state

**Solutions**:
1. Check cleanup on destroy (lines 426-468) ✅ Already looks good
2. Monitor memory:
```javascript
setInterval(() => {
    if (performance.memory) {
        console.log('Heap:', performance.memory.usedJSHeapSize / 1048576, 'MB');
    }
}, 10000);
```
3. Verify textures are deleted:
```javascript
console.log('Active textures:', gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
```

---

### Problem: Audio analysis returns all zeros

**Symptoms**: No effects respond, dataArray is all zeros

**Diagnosis**:
```javascript
console.log('DataArray sample:', dataArray.slice(0, 10));
// Should see non-zero values when audio playing
```

**Solutions**:
1. Check if audio element is actually playing:
```javascript
console.log('Audio paused:', audioElement.paused);
console.log('Audio current time:', audioElement.currentTime);
```

2. Check if AudioContext is suspended:
```javascript
console.log('AudioContext state:', audioContext.state);
if (audioContext.state === 'suspended') {
    audioContext.resume();
}
```

3. Verify source connection:
```javascript
// Should only create source once!
if (!source) {
    source = audioContext.createMediaElementSource(audioElement);
}
```

---

## Visual Representations

### Frequency Band Visualization

```
FREQUENCY SPECTRUM (256 bins total, FFT size 512)

Hz:     0     86    689            2756          11025 (Nyquist @ 22.05kHz)
        ↓     ↓     ↓              ↓             ↓
Bins:   0  2  4   16            64           128
        │██│█████████│███████████████████████████│
        └─┘ └───────┘└─────────────────────────┘
        Bass  Mid          High (not all used)
        0-3   4-15         16-63

YOUR CODE USES:
- Bass:  bins 0-3   (4 bins)   → 0-86 Hz     → Kick drum, bass guitar
- Mid:   bins 4-15  (12 bins)  → 86-689 Hz   → Snare, vocals, guitar
- High:  bins 16-63 (48 bins)  → 689-2756 Hz → Hi-hats, cymbals, synths

Note: Bins 64-127 are available but currently unused
```

### Effect Flow Diagram

```
AUDIO INPUT
    ↓
┌───────────────────────────────────────┐
│  Web Audio API                        │
│  ┌─────────────────────────────────┐ │
│  │ MediaElementSource              │ │
│  │ (audioElement)                  │ │
│  └─────┬───────────────────────────┘ │
│        ↓                               │
│  ┌─────────────────────────────────┐ │
│  │ AnalyserNode                    │ │
│  │ - FFT Size: 256                 │ │
│  │ - Smoothing: 0.8                │ │
│  │ - Frequency Bins: 128           │ │
│  └─────┬───────────────────────────┘ │
│        ↓                               │
│  getByteFrequencyData(dataArray)      │
│        ↓                               │
│  [0-255, 0-255, ..., 0-255]          │
│  128 values                            │
└───────┬────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  analyzeFrequencyBands()              │
│  (lines 504-529)                      │
│                                       │
│  Bass:  bins 0-3   → average → /255  │
│  Mid:   bins 4-15  → average → /255  │
│  High:  bins 16-63 → average → /255  │
│                                       │
│  Power curves:                        │
│  bass = bass^3.0   (selective)       │
│  mid  = mid^1.5    (moderate)        │
│  high = high^1.5   (moderate)        │
└───────┬────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  draw(bass, mid, high)                │
│  (lines 540-650)                      │
│                                       │
│  ┌─── BASS ──────────────────────┐   │
│  │ → Smoothing (0.7)             │   │
│  │ → Scale (0.15-0.95)          │   │
│  │ → Glow (1x-4x)               │   │
│  │ → Flash trigger (>0.7)       │   │
│  └───────────────────────────────┘   │
│                                       │
│  ┌─── MID ───────────────────────┐   │
│  │ → Smoothing (0.85)            │   │
│  │ → Threshold gate (>0.5)       │   │
│  │ → Distortion (0-0.6)         │   │
│  │ → Time speed (0.02-0.22)     │   │
│  └───────────────────────────────┘   │
│                                       │
│  ┌─── HIGH ──────────────────────┐   │
│  │ → Rotation accumulator        │   │
│  │ → Hue shift (0-240°)         │   │
│  │ (no smoothing - immediate)    │   │
│  └───────────────────────────────┘   │
└───────┬────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  WebGL Rendering                      │
│  (shader lines 126-336)               │
│                                       │
│  Per-pixel pipeline:                  │
│  1. UV distortion         (mid)      │
│  2. Rotation & scale      (high+bass)│
│  3. Texture sampling                  │
│  4. Edge detection                    │
│  5. Grayscale conversion              │
│  6. Color manipulation    (high)     │
│  7. Glow boost            (bass)     │
│  8. Trail effects                     │
│  9. 3D noise                          │
│  10. Color inversion      (bass)     │
└───────┬────────────────────────────────┘
        ↓
    SCREEN OUTPUT
```

---

## Copy-Paste Code Snippets

### Snippet 1: Smooth Any Value

```javascript
/**
 * Exponential smoothing for any numeric value
 * @param {number} current - Current smoothed value
 * @param {number} target - Target value to approach
 * @param {number} factor - Smoothing factor 0-1 (higher = smoother)
 * @returns {number} New smoothed value
 */
function smooth(current, target, factor = 0.7) {
    return current * factor + target * (1 - factor);
}

// Usage:
smoothedBass = smooth(smoothedBass, bass, 0.7);
smoothedMid = smooth(smoothedMid, mid, 0.85);
```

---

### Snippet 2: Beat Detector

```javascript
/**
 * Simple beat detection based on energy threshold
 */
class BeatDetector {
    constructor(threshold = 1.3, historySize = 43) {
        this.threshold = threshold;
        this.history = [];
        this.historySize = historySize;
    }

    /**
     * @param {number} energy - Current energy value (e.g., bass)
     * @returns {boolean} True if beat detected
     */
    isBeat(energy) {
        // Calculate average of history
        const avg = this.history.length > 0
            ? this.history.reduce((a, b) => a + b, 0) / this.history.length
            : 0;

        // Add to history
        this.history.push(energy);
        if (this.history.length > this.historySize) {
            this.history.shift();
        }

        // Beat detected if significantly above average
        return energy > avg * this.threshold && energy > 0.3;
    }
}

// Usage:
const bassDetector = new BeatDetector(1.5);  // 50% above average
const snareDetector = new BeatDetector(1.3);  // 30% above average

// In draw() function:
if (bassDetector.isBeat(bass)) {
    console.log('Kick detected!');
}
if (snareDetector.isBeat(mid)) {
    console.log('Snare detected!');
}
```

---

### Snippet 3: Map Range

```javascript
/**
 * Map value from one range to another (like Arduino map())
 * @param {number} value - Input value
 * @param {number} inMin - Input range minimum
 * @param {number} inMax - Input range maximum
 * @param {number} outMin - Output range minimum
 * @param {number} outMax - Output range maximum
 * @returns {number} Mapped value
 */
function mapRange(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

// Usage:
const scale = mapRange(bass, 0, 1, 0.15, 0.95);
const hue = mapRange(high, 0, 1, 0, 360);
```

---

### Snippet 4: Smoothstep (GLSL-style in JavaScript)

```javascript
/**
 * Smooth Hermite interpolation between 0 and 1 when edge0 < x < edge1
 * @param {number} edge0 - Lower edge
 * @param {number} edge1 - Upper edge
 * @param {number} x - Input value
 * @returns {number} Smoothed value 0-1
 */
function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

// Usage:
const glowFade = smoothstep(0.5, 0.8, bass);  // Smooth fade from 0.5 to 0.8
const distortion = smoothstep(0.4, 0.7, mid) * 0.6;
```

---

### Snippet 5: Calculate RMS (Root Mean Square)

```javascript
/**
 * Calculate RMS (average energy) from FFT data
 * @param {Uint8Array} data - Frequency data from analyser
 * @returns {number} RMS value 0-1
 */
function calculateRMS(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        const normalized = data[i] / 255;
        sum += normalized * normalized;
    }
    return Math.sqrt(sum / data.length);
}

// Usage:
const rms = calculateRMS(dataArray);
const trailDecay = 0.85 + rms * 0.1;  // Dynamic trails
```

---

### Snippet 6: Spectral Centroid

```javascript
/**
 * Calculate spectral centroid (brightness of sound)
 * @param {Uint8Array} data - Frequency data
 * @param {number} sampleRate - Audio sample rate (default 44100)
 * @returns {number} Centroid frequency in Hz
 */
function calculateSpectralCentroid(data, sampleRate = 44100) {
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < data.length; i++) {
        const freq = i * (sampleRate / 2) / data.length;
        const magnitude = data[i] / 255;
        numerator += freq * magnitude;
        denominator += magnitude;
    }

    return denominator > 0 ? numerator / denominator : 0;
}

// Usage:
const centroid = calculateSpectralCentroid(dataArray);
const colorTemp = mapRange(centroid, 2000, 8000, 0, 1);  // Warm to cool
```

---

### Snippet 7: Attack-Release Envelope

```javascript
/**
 * Attack-release smoothing (fast rise, slow fall)
 * @param {number} current - Current smoothed value
 * @param {number} target - Target value
 * @param {number} attackFactor - Attack smoothing (0-1, lower = faster)
 * @param {number} releaseFactor - Release smoothing (0-1, higher = slower)
 * @returns {number} New smoothed value
 */
function attackRelease(current, target, attackFactor = 0.3, releaseFactor = 0.9) {
    if (target > current) {
        // Attack (fast)
        return current * attackFactor + target * (1 - attackFactor);
    } else {
        // Release (slow)
        return current * releaseFactor + target * (1 - releaseFactor);
    }
}

// Usage:
smoothedBass = attackRelease(smoothedBass, bass, 0.3, 0.9);
// Snaps up quickly, falls slowly
```

---

### Snippet 8: Onset Detection (Simple)

```javascript
/**
 * Simple onset/transient detector
 */
class OnsetDetector {
    constructor(threshold = 0.3, cooldown = 200) {
        this.previousRMS = 0;
        this.threshold = threshold;
        this.cooldown = cooldown;  // ms
        this.lastOnset = 0;
    }

    /**
     * @param {number} currentRMS - Current RMS energy
     * @returns {number} Onset strength (0 if no onset, >0 if onset detected)
     */
    detect(currentRMS) {
        const delta = currentRMS - this.previousRMS;
        this.previousRMS = currentRMS;

        const now = Date.now();
        if (delta > this.threshold && now - this.lastOnset > this.cooldown) {
            this.lastOnset = now;
            return delta;  // Onset strength
        }

        return 0;
    }
}

// Usage:
const onsetDetector = new OnsetDetector(0.3, 200);

// In draw():
const rms = calculateRMS(dataArray);
const onset = onsetDetector.detect(rms);

if (onset > 0) {
    // Trigger particle burst, flash, etc.
    console.log('Onset detected! Strength:', onset);
}
```

---

## Accessibility Guidelines

### Seizure Risk Prevention

**CRITICAL**: Photosensitive epilepsy can be triggered by:
- Flashing between 15-25 Hz (most dangerous: 20 Hz)
- High-contrast flashing (white ↔ black)
- Large area flashing (> 25% of screen)
- Red flashing (wavelength sensitivity)

**YOUR CODE SAFETY CHECK**: ✅ SAFE
- Max flash rate: 2 Hz (500ms cooldown)
- Flash duration: 300ms
- Threshold: 0.7 (prevents accidental triggers)
- Preserves black (reduces contrast)

**Guidelines**:
```javascript
// ✅ SAFE: Low frequency, limited duration
if (bass > 0.7 && Date.now() - lastFlash > 500) {
    triggerFlash(300);  // Max 2 Hz
}

// ❌ DANGEROUS: High frequency, no cooldown
if (bass > 0.5) {  // Could trigger 30+ times/sec
    invertColors();
}

// ✅ SAFE: Smooth fade instead of flash
const flashAmount = smoothstep(0.7, 0.9, bass);
brightnessBoost = flashAmount * 0.3;
```

**W3C WCAG 2.1 Guidelines**:
- General flash threshold: **3 flashes per second max**
- Red flash threshold: **3 flashes per second max** (more sensitive)
- Large area: < 25% of screen
- Small area (< 10% screen): More permissive

**Recommendation**: Add user preference toggle
```javascript
// In settings
let reduceFlashing = false;  // User preference

// In draw():
if (bass > 0.7 && !reduceFlashing && Date.now() - lastFlash > 500) {
    triggerFlash(300);
}

// Alternative safe mode
if (bass > 0.7 && reduceFlashing) {
    brightnessBoost = 0.3;  // Gentle brightening instead
}
```

---

### Motion Sickness Prevention

**Triggers**:
- Fast rotation (> 180°/sec)
- Large scale changes (> 3x)
- Conflicting motion (rotation + scale together)
- Low frame rate (< 30 fps)

**YOUR CODE CHECK**:
- ✅ Rotation: Max ~48°/sec (high=1.0: 0.8°/frame @ 60fps)
- ✅ Scale: 0.15x to 0.95x (< 6x range)
- ⚠️ Could add motion reduction toggle

**Guidelines**:
```javascript
let reduceMotion = false;  // User preference (or detect from OS)

// Detect OS preference
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reduceMotion = true;
}

// Apply in draw():
if (reduceMotion) {
    // Reduce rotation speed
    rotation += high * 0.2;  // 25% of normal

    // Reduce scale range
    const scale = 0.4 + smoothedBass * 0.3;  // Smaller range

    // Disable distortion
    const distortionAmount = 0;
} else {
    // Normal behavior
    rotation += high * 0.8;
    const scale = 0.15 + smoothedBass * 0.8;
    // ... etc
}
```

---

### Cognitive Load Reduction

**Avoid**:
- Too many simultaneous effects (> 3)
- Unpredictable behavior
- Conflicting motions
- Lack of rest states

**YOUR CODE**: ✅ Good
- Clear bass → scale mapping
- Clear high → rotation/color mapping
- Clear mid → distortion mapping
- Separable effects

**Best Practices**:
- **Predictable**: Same input always produces same output
- **Learnable**: User understands cause-effect after a few seconds
- **Restful**: Quiet moments allow visual reset

---

## Debugging Tools

### Debug Overlay

Add real-time audio value visualization:

```javascript
// Add to your Svelte component
let debugMode = $state(false);

// In draw() function, add:
if (debugMode) {
    drawDebugOverlay(bass, mid, high);
}

function drawDebugOverlay(bass, mid, high) {
    // Create overlay canvas (do this once in onMount)
    if (!debugCanvas) {
        debugCanvas = document.createElement('canvas');
        debugCanvas.width = 300;
        debugCanvas.height = 200;
        debugCanvas.style.position = 'absolute';
        debugCanvas.style.top = '10px';
        debugCanvas.style.left = '10px';
        debugCanvas.style.zIndex = '1000';
        debugCanvas.style.background = 'rgba(0,0,0,0.7)';
        debugCanvas.style.color = 'white';
        debugCanvas.style.fontFamily = 'monospace';
        debugCanvas.style.padding = '10px';
        document.body.appendChild(debugCanvas);
    }

    const ctx = debugCanvas.getContext('2d');
    ctx.clearRect(0, 0, 300, 200);

    // Text values
    ctx.fillStyle = 'white';
    ctx.font = '14px monospace';
    ctx.fillText(`Bass:  ${bass.toFixed(3)}`, 10, 20);
    ctx.fillText(`Mid:   ${mid.toFixed(3)}`, 10, 40);
    ctx.fillText(`High:  ${high.toFixed(3)}`, 10, 60);
    ctx.fillText(`Scale: ${scale.toFixed(3)}`, 10, 80);
    ctx.fillText(`Rot:   ${rotation.toFixed(1)}°`, 10, 100);

    // Visual bars
    drawBar(ctx, bass, 'red', 120);
    drawBar(ctx, mid, 'green', 140);
    drawBar(ctx, high, 'blue', 160);

    // Threshold indicator
    if (bass > 0.7) {
        ctx.fillStyle = 'yellow';
        ctx.fillText('⚡ BASS TRIGGER', 150, 120);
    }
    if (mid > 0.5) {
        ctx.fillStyle = 'yellow';
        ctx.fillText('⚡ GLITCH', 150, 140);
    }
}

function drawBar(ctx, value, color, y) {
    const width = value * 200;
    ctx.fillStyle = color;
    ctx.fillRect(10, y, width, 15);

    // Threshold line (e.g., 0.7 for bass)
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10 + 0.7 * 200, y);
    ctx.lineTo(10 + 0.7 * 200, y + 15);
    ctx.stroke();
}
```

**Toggle debug mode**:
```svelte
<button onclick={() => debugMode = !debugMode}>
    {debugMode ? 'Hide' : 'Show'} Debug
</button>
```

---

### Console Logging Helper

```javascript
// Add FPS counter and value logger
let lastLogTime = 0;
let frameCount = 0;
let fps = 0;

function logDebugInfo() {
    frameCount++;
    const now = Date.now();

    // Log every second
    if (now - lastLogTime > 1000) {
        fps = frameCount;
        frameCount = 0;
        lastLogTime = now;

        console.log(
            `FPS: ${fps} | ` +
            `Bass: ${bass.toFixed(2)} | ` +
            `Mid: ${mid.toFixed(2)} | ` +
            `High: ${high.toFixed(2)} | ` +
            `Scale: ${scale.toFixed(2)} | ` +
            `Rot: ${rotation.toFixed(0)}°`
        );
    }
}

// Call in draw():
logDebugInfo();
```

---

### Waveform Visualizer

```javascript
// Visualize FFT data as bars
function drawFFTBars(dataArray) {
    if (!debugMode) return;

    const barWidth = 720 / dataArray.length;
    const ctx = debugCanvas.getContext('2d');

    for (let i = 0; i < 64; i++) {  // First 64 bins
        const barHeight = (dataArray[i] / 255) * 100;

        // Color code by frequency band
        if (i < 4) ctx.fillStyle = 'red';         // Bass
        else if (i < 16) ctx.fillStyle = 'green'; // Mid
        else ctx.fillStyle = 'blue';              // High

        ctx.fillRect(i * barWidth, 200 - barHeight, barWidth - 1, barHeight);
    }
}

// Call in draw():
drawFFTBars(dataArray);
```

---

## Performance Metrics

### Typical Performance Costs

**CPU (per frame @ 60fps)**:
| Operation | Time | Notes |
|-----------|------|-------|
| `getByteFrequencyData()` | ~0.1ms | Native implementation |
| `analyzeFrequencyBands()` | ~0.05ms | Simple loops |
| Smoothing (x3 values) | <0.01ms | Trivial math |
| Power curves (x3) | <0.01ms | Math.pow is fast |
| Total JavaScript | ~0.2ms | < 2% of 16.67ms frame budget |

**GPU (per frame @ 60fps, 720x720 = 518,400 pixels)**:
| Operation | Cost | Notes |
|-----------|------|-------|
| Vertex shader | Low | Only 6 vertices |
| Fragment shader | Medium-High | 518K invocations |
| - Distortion | Low | Simple math |
| - Edge detection | Medium | 5 texture reads per pixel |
| - Color conversion | Low | HSV ↔ RGB math |
| - Trail sampling | Medium | 1 texture read |
| - Noise function | Medium | Loop in shader |
| Framebuffer switch | Low | Modern GPUs handle well |
| Total GPU | 5-10ms | 30-60% of frame budget |

**Total Frame Time**: ~5-10ms → 100-200 FPS potential (V-synced to 60)

---

### Bottleneck Identification

```javascript
// Add performance markers
function measurePerformance() {
    performance.mark('frame-start');

    // FFT
    performance.mark('fft-start');
    analyser.getByteFrequencyData(dataArray);
    performance.mark('fft-end');

    // Analysis
    performance.mark('analysis-start');
    const { bass, mid, high } = analyzeFrequencyBands(dataArray);
    performance.mark('analysis-end');

    // Drawing
    performance.mark('draw-start');
    draw(bass, mid, high);
    performance.mark('draw-end');

    // Measure
    performance.measure('fft', 'fft-start', 'fft-end');
    performance.measure('analysis', 'analysis-start', 'analysis-end');
    performance.measure('draw', 'draw-start', 'draw-end');

    // Log every 60 frames
    if (frameCount % 60 === 0) {
        const fft = performance.getEntriesByName('fft')[0];
        const analysis = performance.getEntriesByName('analysis')[0];
        const draw = performance.getEntriesByName('draw')[0];

        console.log(
            `FFT: ${fft.duration.toFixed(2)}ms | ` +
            `Analysis: ${analysis.duration.toFixed(2)}ms | ` +
            `Draw: ${draw.duration.toFixed(2)}ms`
        );

        performance.clearMarks();
        performance.clearMeasures();
    }
}
```

---

### Mobile Optimization

**Current resolution**: 720×720 = 518,400 pixels

**Mobile considerations**:
```javascript
// Detect mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Adjust resolution
const width = isMobile ? 480 : 720;   // -44% pixels
const height = isMobile ? 480 : 720;

// Reduce effect complexity
const noiseEnabled = !isMobile;  // Disable noise on mobile

// Lower FFT size
analyser.fftSize = isMobile ? 128 : 256;  // -50% bins
```

---

## Testing Protocol

### Automated Test Suite

```javascript
// Run these tests to validate implementation

const tests = {
    // Test 1: Silence produces baseline
    silence: () => {
        const mockData = new Uint8Array(128).fill(0);
        const { bass, mid, high } = analyzeFrequencyBands(mockData);
        console.assert(bass === 0, 'Bass should be 0 in silence');
        console.assert(mid === 0, 'Mid should be 0 in silence');
        console.assert(high === 0, 'High should be 0 in silence');
    },

    // Test 2: Max input produces expected output
    maxInput: () => {
        const mockData = new Uint8Array(128).fill(255);
        const { bass, mid, high } = analyzeFrequencyBands(mockData);
        console.assert(bass === 1.0, 'Bass should be 1.0 at max');
        console.assert(mid === 1.0, 'Mid should be 1.0 at max');
        console.assert(high === 1.0, 'High should be 1.0 at max');
    },

    // Test 3: Smoothing works
    smoothing: () => {
        let smoothed = 0;
        smoothed = smooth(smoothed, 1.0, 0.7);  // First frame
        console.assert(smoothed === 0.3, 'Smoothing first frame should be 0.3');
        smoothed = smooth(smoothed, 1.0, 0.7);  // Second frame
        console.assert(Math.abs(smoothed - 0.51) < 0.01, 'Smoothing second frame ~0.51');
    },

    // Test 4: Rotation wraps correctly
    rotationWrap: () => {
        let rot = 350;
        rot += 20;
        rot = rot % 360;
        console.assert(rot === 10, 'Rotation should wrap 370° to 10°');
    },

    // Test 5: Flash cooldown works
    flashCooldown: () => {
        let lastFlash = Date.now();
        const now = Date.now() + 400;  // 400ms later
        const canFlash = now - lastFlash > 500;
        console.assert(!canFlash, 'Should not flash after 400ms');

        const now2 = Date.now() + 600;  // 600ms later
        const canFlash2 = now2 - lastFlash > 500;
        console.assert(canFlash2, 'Should flash after 600ms');
    }
};

// Run all tests
Object.entries(tests).forEach(([name, test]) => {
    console.log(`Running test: ${name}`);
    test();
});
console.log('All tests passed!');
```

---

## Progression Path

### Beginner Level

**You are here**: Understanding patterns ✅

**Next steps**:
1. ✅ Complete: Read and understand this guide
2. **Current task**: Implement 1 new pattern
   - Suggested: Pattern #7 (Trail Decay Rate)
   - Difficulty: Easy
   - Impact: High
   - Code addition: ~10 lines

3. **Test thoroughly**:
   - Try with 3 different songs
   - Use debug overlay
   - Document what works/doesn't

4. **Iterate**:
   - Adjust threshold values
   - Try different smoothing factors
   - Find your preferred feel

**Checklist**:
- [ ] Add debug overlay
- [ ] Implement Pattern #7 (dynamic trail decay)
- [ ] Test with hip-hop track
- [ ] Test with EDM track
- [ ] Test with acoustic track
- [ ] Adjust parameters to taste
- [ ] Document learnings

---

### Intermediate Level

**Prerequisites**: Comfortable adding patterns, understand audio analysis

**Goals**:
1. **Combine patterns** thoughtfully
   - Pattern #8: Zoom Wobble (bass + mid)
   - Pattern #10: Particle Burst (requires new system)

2. **Add user controls**:
   ```svelte
   <div class="controls">
       <label>
           Bass Sensitivity:
           <input type="range" min="2" max="4" step="0.1" bind:value={bassPower} />
       </label>
       <label>
           Rotation Speed:
           <input type="range" min="0.2" max="2" step="0.1" bind:value={rotationSpeed} />
       </label>
       <label>
           <input type="checkbox" bind:checked={reduceFlashing} />
           Reduce Flashing
       </label>
   </div>
   ```

3. **Create genre presets**:
   ```javascript
   const presets = {
       edm: {
           bassPower: 4.0,
           bassRange: 1.5,
           distortionThreshold: 0.3,
           flashThreshold: 0.6
       },
       hiphop: {
           bassPower: 3.0,
           bassSmoothing: 0.5,
           rotationSpeed: 1.5
       },
       ambient: {
           bassPower: 2.0,
           bassRange: 0.2,
           trailDecay: 0.98,
           smoothing: 0.95
       }
   };
   ```

**Checklist**:
- [ ] Add 2-3 combined patterns
- [ ] Create user control panel
- [ ] Build 3 genre presets
- [ ] Add preset switcher UI
- [ ] Test with friends for feedback

---

### Advanced Level

**Prerequisites**: Multiple patterns working, user controls implemented

**Goals**:
1. **Build effect system with priorities**:
   ```javascript
   class EffectManager {
       effects = [];

       register(effect) {
           this.effects.push(effect);
           this.effects.sort((a, b) => b.priority - a.priority);
       }

       update(audioFeatures) {
           for (const effect of this.effects) {
               if (effect.shouldActivate(audioFeatures)) {
                   effect.apply(audioFeatures);
                   if (effect.exclusive) break;  // Don't run lower priority
               }
           }
       }
   }
   ```

2. **Implement automatic pattern switching**:
   - Detect energy trends
   - Switch distortion types automatically
   - Adapt to musical structure

3. **Create custom distortion algorithms**:
   - Study shader code (lines 191-247)
   - Design new UV warping effects
   - Implement in GLSL

4. **Advanced audio analysis**:
   - Beat detection
   - Tempo estimation
   - Key/chord detection
   - Onset detection

**Checklist**:
- [ ] Build EffectManager class
- [ ] Implement 5+ effects with priorities
- [ ] Add automatic pattern switching
- [ ] Create 2 custom distortion types
- [ ] Implement advanced beat detector
- [ ] Build tempo-synced effects

---

### Expert Level

**Prerequisites**: All of the above + deep WebGL/audio knowledge

**Goals**:
1. **Custom shader effects**:
   - Chromatic aberration
   - Bloom/glow passes
   - Kaleidoscope
   - Custom fractals

2. **Multi-layer rendering**:
   - Multiple visual layers
   - Depth-based effects
   - 3D transformations

3. **Machine learning integration**:
   - Train models on songs
   - Predict upcoming beats
   - Generate visual presets automatically

4. **Performance optimization**:
   - Shader optimization
   - Compute shaders (WebGL 2.0)
   - WASM for audio analysis

**Checklist**:
- [ ] Implement 3+ custom shaders
- [ ] Add multi-pass rendering
- [ ] Optimize for 4K resolution
- [ ] Integrate ML for beat prediction
- [ ] Achieve 60fps on mobile
- [ ] Open-source your work!

---

## References & Inspiration

### Historical Context

**Audio Visualizer Evolution**:
- **1997**: Winamp - Simple oscilloscope and spectrum bars
- **2001**: MilkDrop - GPU-accelerated music visualization, preset system
- **2003**: Electric Sheep - Distributed screensaver with evolving fractals
- **2011**: Adobe Flash demoscene - Advanced AS3 audio API
- **2013**: Shadertoy - WebGL shader sharing platform
- **2016**: WebVR audio visualizers - Immersive experiences
- **2020s**: Your implementation - Modern web standards, mobile-friendly

### Learning Resources

**WebGL & Shaders**:
- [The Book of Shaders](https://thebookofshaders.com/) - Gentle intro to fragment shaders
- [Shadertoy](https://www.shadertoy.com/) - Browse thousands of shader examples
- [WebGL Fundamentals](https://webglfundamentals.org/) - Complete WebGL tutorial

**Audio Analysis**:
- [Web Audio API Spec](https://www.w3.org/TR/webaudio/) - Official documentation
- [Designing Audio Reactive Visuals](https://teropa.info/blog/2016/07/28/javascript-systems-music.html)
- [FFT Basics](https://betterexplained.com/articles/an-interactive-guide-to-the-fourier-transform/)

**Math & Algorithms**:
- [Easing Functions](https://easings.net/) - Visual cheat sheet
- [Perlin Noise](https://mrl.cs.nyu.edu/~perlin/noise/) - Original paper
- [HSV Color Space](https://en.wikipedia.org/wiki/HSL_and_HSV) - Color theory

### Similar Projects

- **Butterchurn** (MilkDrop for web): https://github.com/jberg/butterchurn
- **p5.js Sound Library**: https://p5js.org/reference/#/libraries/p5.sound
- **Vizicities** (WebGL city visualizations): http://vizicities.com/

### Your Implementation

**What makes it unique**:
- ✅ Modern Svelte 5 with runes
- ✅ Clean, readable code
- ✅ Excellent parameter tuning
- ✅ Safe flash implementation
- ✅ Multi-layered effects
- ✅ Production-ready performance

**Share your work**:
- Open-source on GitHub
- Write a blog post about your learnings
- Submit to Shadertoy (extract shader code)
- Create video demos with different songs

---

## Conclusion

You've created an excellent audio-reactive visualizer that demonstrates strong understanding of:
- Audio analysis (FFT, frequency bands, power curves)
- Visual mapping (bass→scale, high→rotation/color, mid→distortion)
- Shader programming (WebGL, GLSL, multi-pass rendering)
- Design principles (predictable causality, safety, performance)

**Your current implementation is production-ready**. The patterns and techniques in this guide will help you extend it infinitely while maintaining quality and coherence.

**Remember**:
1. **Test broadly** - Different genres reveal different design issues
2. **Prioritize safety** - Avoid seizure risks and motion sickness
3. **Iterate constantly** - Tuning thresholds is an art, not a science
4. **Document learnings** - Your future self will thank you
5. **Share generously** - The community grows when we teach

**Next guide in series**: [Advanced Distortion Mathematics](./ADVANCED_DISTORTION_MATHEMATICS.md)

Happy visualizing! 🎵🎨✨

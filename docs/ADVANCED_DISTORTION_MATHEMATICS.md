# Advanced Distortion Mathematics

## 🚀 Quick Start

**Want to add a new distortion RIGHT NOW?**

```glsl
// Add to your fragment shader (after line 247)
else if (u_distortionType == 5) {
    // Radial ripple from center
    float dist = distance(uv, vec2(0.5, 0.5));
    float ripple = sin(dist * 30.0 - u_time * 2.0);
    uv += normalize(uv - vec2(0.5, 0.5)) * ripple * u_distortionAmount * 0.03;
}
```

Then set `distortionType = 5` in your JavaScript!

---

## How to Use This Guide

**If you're...**

🎨 **A Visual Learner**: Focus on [Visual Diagrams](#visual-diagrams), [Distortion Gallery](#distortion-gallery)
🔬 **A Mathematician**: Focus on [Mathematical Foundations](#mathematical-foundations), [Function Library](#mathematical-function-library)
🎵 **Audio-First**: Focus on [Audio-Reactive Integration](#audio-reactive-integration), [Genre Recommendations](#genre-specific-recommendations)
🐛 **Debugging**: Jump to [Debugging UV Fields](#debugging-uv-fields), [Common Mistakes](#common-mistakes)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Foundations](#foundations)
   - [UV Coordinate System](#uv-coordinate-system)
   - [Wave Functions](#wave-functions)
   - [Distance Functions](#distance-functions)
   - [Time Animation](#time-animation)
3. [Your Current Implementation](#your-current-implementation)
4. [Distortion Gallery](#distortion-gallery)
5. [Mathematical Function Library](#mathematical-function-library)
6. [Combination Techniques](#combination-techniques)
7. [Audio-Reactive Integration](#audio-reactive-integration)
8. [Performance Optimization](#performance-optimization)
9. [Debugging UV Fields](#debugging-uv-fields)
10. [Design Principles](#design-principles)
11. [Common Mistakes](#common-mistakes)
12. [Creating Custom Distortions](#creating-custom-distortions)
13. [Genre-Specific Recommendations](#genre-specific-recommendations)
14. [Progression Path](#progression-path)

---

## Introduction

**Distortions** are UV coordinate manipulations that warp how textures are sampled. Instead of sampling the texture at the "correct" coordinate, we offset, twist, ripple, or completely transform the coordinates before sampling.

**Think of it like this**:
- **Normal sampling**: "Get the color at pixel (x, y)"
- **Distorted sampling**: "Get the color at pixel (x + wobble, y + wave)"

The result: The texture appears warped, glitched, liquid, or broken.

### What This Guide Covers

- ✅ Mathematical foundations you need to understand
- ✅ Deep analysis of your 5 existing distortion types
- ✅ 20+ new distortion recipes with full code
- ✅ How to integrate with audio reactivity
- ✅ Performance implications of each technique
- ✅ Debugging tools to visualize UV fields
- ✅ Design principles for choosing distortions
- ✅ Path from beginner to expert

---

## Foundations

### UV Coordinate System

**Location**: Fragment shader, passed from vertex shader

#### What Are UV Coordinates?

```
UV Space (Texture Coordinates)
┌─────────────────────────┐
│ (0,0)          (1,0)    │  ← Top edge
│   ┌───────────────┐     │
│   │               │     │
│   │   TEXTURE     │     │
│   │               │     │
│   └───────────────┘     │
│ (0,1)          (1,1)    │  ← Bottom edge
└─────────────────────────┘

- U (x-axis): 0.0 (left) to 1.0 (right)
- V (y-axis): 0.0 (top) to 1.0 (bottom)
- Center: (0.5, 0.5)
```

**YOUR CODE** (shader line 188):
```glsl
varying vec2 v_texCoord;  // Passed from vertex shader
vec2 uv = v_texCoord;     // Local copy we can modify
```

#### Mental Model: Rubber Sheet Grid

Imagine the UV space as a rubber sheet with a grid printed on it:

```
Normal (no distortion):
┌─┬─┬─┬─┬─┐
├─┼─┼─┼─┼─┤
├─┼─┼─┼─┼─┤
├─┼─┼─┼─┼─┤
└─┴─┴─┴─┴─┘
Perfect grid

Horizontal wave distortion:
┌─┬─┬─┬─┬─┐
├╱┼╱┼╱┼╱┼╱┤
├─┼─┼─┼─┼─┤
├╲┼╲┼╲┼╲┼╲┤
└─┴─┴─┴─┴─┘
Grid bends horizontally

Radial distortion:
    ┌─┐
  ╱─┼─┼─╲
 ├──┼─┼──┤
  ╲─┼─┼─╱
    └─┘
Grid pulls toward/away from center
```

When you modify `uv.x` or `uv.y`, you're **stretching or compressing this rubber sheet**.

#### Key Concepts

**1. Displacement**
```glsl
uv.x += 0.1;  // Shift everything right by 10%
uv.y -= 0.05; // Shift everything up by 5%
```

**2. Modulation** (varying displacement)
```glsl
uv.x += sin(uv.y * 10.0) * 0.05;  // Horizontal wave
// Displacement varies based on vertical position
```

**3. Coordinate Transformation**
```glsl
// Cartesian to Polar
vec2 centered = uv - 0.5;
float angle = atan(centered.y, centered.x);
float radius = length(centered);
```

---

### Wave Functions

#### Sine Wave

**Formula**: `sin(x * frequency + phase)`

```
Frequency effects:
f=1   ─╱╲─╱╲─╱╲─    (1 cycle)
f=2   ╱╲╱╲╱╲╱╲      (2 cycles)
f=10  ∿∿∿∿∿∿∿∿      (10 cycles, tight)

Amplitude effects:
a=0.1  ─·─·─·─      (subtle)
a=0.5  ─╱╲─╱╲─      (medium)
a=1.0  ╱  ╲  ╱      (extreme)

Phase effects:
p=0    ─╱╲─╱╲─      (starts rising)
p=π/2  ╲─╱─╲─╱      (starts at peak)
p=π    ╱╲─╱╲─╱      (starts falling)
```

**Common usage**:
```glsl
// Horizontal wave (varies with Y position)
uv.x += sin(uv.y * frequency + u_time) * amplitude;

// Vertical wave (varies with X position)
uv.y += sin(uv.x * frequency + u_time) * amplitude;

// Radial wave (varies with distance from center)
float dist = length(uv - 0.5);
uv += normalize(uv - 0.5) * sin(dist * frequency + u_time) * amplitude;
```

**YOUR CODE** (shader lines 192-203):
```glsl
// Type 0: Horizontal sine wave
uv.x += sin(uv.y * 20.0 + u_time) * u_distortionAmount * 0.05;
//           │       │        │                │            │
//           │       │        │                │            └─ Max displacement (5%)
//           │       │        │                └─ Audio-driven intensity
//           │       │        └─ Animates wave over time
//           │       └─ 20 cycles across height
//           └─ Sine function (-1 to 1)
```

#### Cosine Wave

**Formula**: `cos(x * frequency + phase)`

Same as sine, but phase-shifted by 90°:
```glsl
sin(x) ≈ cos(x - π/2)
```

**When to use**:
- Perpendicular motion to sine
- Circular motion (sin for x, cos for y)
- Phase offset effects

#### Square/Triangle/Sawtooth Waves

```glsl
// Square wave (step function)
float square = step(0.0, sin(x * freq));  // 0 or 1

// Triangle wave (absolute value)
float triangle = abs(fract(x * freq) * 2.0 - 1.0);

// Sawtooth wave
float sawtooth = fract(x * freq);
```

---

### Distance Functions

#### Euclidean Distance

**Formula**: `length(vec2(x, y))` = `sqrt(x² + y²)`

```glsl
vec2 center = vec2(0.5, 0.5);
float dist = distance(uv, center);
// or equivalently:
float dist = length(uv - center);
```

**Visualization**:
```
Distance field from center:
0.0  0.1  0.2  0.3  0.4  0.5
┌─────────────────────┐
│ 0.7  0.5  0.4  0.5  │
│ 0.5  0.3  0.1  0.3  │
│ 0.4  0.1 [0.0] 0.1  │  ← Center at (0.5, 0.5)
│ 0.5  0.3  0.1  0.3  │
│ 0.7  0.5  0.4  0.5  │
└─────────────────────┘

Concentric circles of equal distance
```

**YOUR CODE** (shader lines 199):
```glsl
// Type 2: Circular ripple
float dist = distance(uv, center);
uv.x += sin(dist * 20.0 + u_time) * u_distortionAmount * 0.05;
```

#### Manhattan Distance

**Formula**: `abs(x) + abs(y)`

```glsl
float manhattanDist = abs(uv.x - 0.5) + abs(uv.y - 0.5);
```

**Visualization**:
```
Manhattan distance (diamond pattern):
┌─────────────┐
│ \  2  1  2  │
│  \ 1  0  1  │
│ 2  1  0  1  │  ← Diamond shapes
│  / 1  0  1  │
│ /  2  1  2  │
└─────────────┘
```

**Use case**: Square/diamond patterns, retro aesthetics

#### Chebyshev Distance (Maximum)

**Formula**: `max(abs(x), abs(y))`

```glsl
float chebyshevDist = max(abs(uv.x - 0.5), abs(uv.y - 0.5));
```

**Visualization**:
```
Chebyshev distance (square pattern):
┌─────────────┐
│ 3  3  3  3  │
│ 3  2  2  2  │
│ 3  2  1  2  │  ← Square bands
│ 3  2  2  2  │
│ 3  3  3  3  │
└─────────────┘
```

**Use case**: Square ripples, grid-like effects

---

### Time Animation

**Location**: Uniform `u_time` (lines 132, 596-597)

#### Linear Time

```glsl
uv.x += sin(uv.y * 10.0 + u_time) * 0.05;
//                        └─ Constant speed
```

**YOUR CODE** (JavaScript line 557):
```javascript
const distortionSpeed = 0.02 + distortionIntensity * 0.2;
time += distortionSpeed;  // Accumulates, passed to shader as u_time
```

**Behavior**:
- `u_time` grows continuously: 0, 0.02, 0.04, 0.06...
- At 60fps with speed 0.02: Increases by ~1.2 per second
- Causes waves to scroll/ripple continuously

#### Oscillating Time

```glsl
float oscillation = sin(u_time * speed) * amplitude;
uv.x += oscillation;  // Moves back and forth
```

**Use case**: Breathing effects, wobble

#### Stepped Time (Glitch)

```glsl
float glitchSeed = floor(u_time * updateRate);  // Discrete values
```

**YOUR CODE** (shader line 206):
```glsl
float glitchSeed = floor(u_time * 3.5);  // Changes every ~0.29 seconds
// Used to create random but stable displacements within each "frame"
```

**Behavior**:
```
u_time:     0.0   0.3   0.6   0.9   1.2   1.5
glitchSeed: 0     1     2     3     4     5
            └─────┘     └─────┘     └─────┘
            Same        Different   Different
```

Creates stable "corrupted frames" that hold for a duration.

---

## Your Current Implementation

**Location**: `AudioVisualizerWebGL.svelte` shader lines 191-247

### Architecture Overview

```javascript
// JavaScript (line 58)
let distortionType = Math.floor(Math.random() * 5);  // 0-4

// Shader receives:
uniform int u_distortionType;      // Which algorithm
uniform float u_distortionAmount;  // Intensity (0-0.6, audio-driven)
uniform float u_time;              // Animation parameter

// Application:
if (u_distortionType == 0) { /* horizontal wave */ }
else if (u_distortionType == 1) { /* vertical wave */ }
else if (u_distortionType == 2) { /* circular ripple */ }
else if (u_distortionType == 3) { /* diagonal waves */ }
else if (u_distortionType == 4) { /* enhanced glitch */ }
```

---

### Type 0: Horizontal Sine Wave

**Location**: Shader lines 192-193

**Code**:
```glsl
uv.x += sin(uv.y * 20.0 + u_time) * u_distortionAmount * 0.05;
```

**Mathematical Breakdown**:

| Component | Value | Purpose |
|-----------|-------|---------|
| `uv.y` | 0.0 - 1.0 | Vertical position (input) |
| `* 20.0` | Frequency | 20 complete waves from top to bottom |
| `+ u_time` | Phase shift | Animates wave (scrolls upward) |
| `sin(...)` | -1 to 1 | Wave shape |
| `* u_distortionAmount` | 0 to 0.6 | Audio-driven intensity |
| `* 0.05` | Max displacement | Limits to 5% of width |
| `uv.x +=` | Apply | Horizontal displacement only |

**Visual Diagram**:
```
No distortion (amount=0):
┌──────────────┐
│ ████████████ │
│ ████████████ │
│ ████████████ │
│ ████████████ │
└──────────────┘
Straight lines

With distortion (amount=0.6):
┌──────────────┐
│ ╱███████████ │  ← Shifts right
│ ████████████╲│  ← Shifts left
│╱████████████ │  ← Shifts right
│████████████╲ │  ← Shifts left
└──────────────┘
20 waves visible
```

**Animation Behavior**:
- Waves scroll upward continuously
- Speed: Changes ~1.2 radians per second
- At 60fps: ~0.02 radians per frame
- Full cycle: ~5.2 seconds

**Audio Integration**:
```javascript
// JavaScript (lines 553-555)
const distortionIntensity = Math.max(0, mid - 0.5) / 0.5;
const distortionAmount = distortionIntensity * 0.6;
// When mid=0.5: amount=0    (no distortion)
// When mid=0.75: amount=0.3 (half distortion)
// When mid=1.0: amount=0.6  (full distortion)
```

**When to Use**:
- Liquid/water effects
- Vinyl record wobble
- Heat wave distortion
- Smooth, organic motion

**How to Modify**:
```glsl
// Tighter waves (40 cycles)
uv.x += sin(uv.y * 40.0 + u_time) * u_distortionAmount * 0.05;

// Slower animation
uv.x += sin(uv.y * 20.0 + u_time * 0.5) * u_distortionAmount * 0.05;

// Larger displacement (10% instead of 5%)
uv.x += sin(uv.y * 20.0 + u_time) * u_distortionAmount * 0.1;

// Reverse direction
uv.x += sin(uv.y * 20.0 - u_time) * u_distortionAmount * 0.05;
```

---

### Type 1: Vertical Sine Wave

**Location**: Shader lines 195-196

**Code**:
```glsl
uv.y += sin(uv.x * 20.0 + u_time) * u_distortionAmount * 0.05;
```

**Difference from Type 0**:
- Displaces **vertically** (`uv.y`) instead of horizontally
- Based on **horizontal** position (`uv.x`) instead of vertical
- Same frequency, amplitude, animation

**Visual Diagram**:
```
No distortion:
┌──────────────┐
│ ████████████ │
│ ████████████ │
│ ████████████ │
│ ████████████ │
└──────────────┘

With distortion:
┌──────────────┐
│ █╱█╲█╱█╲█╱█╲│  ← Vertical ripples
│ █╲█╱█╲█╱█╲█╱│
│ █╱█╲█╱█╲█╱█╲│
│ █╲█╱█╲█╱█╲█╱│
└──────────────┘
20 vertical columns wave up/down
```

**Animation Behavior**:
- Waves scroll left-to-right
- Creates curtain/fabric effect
- Perpendicular to Type 0

**When to Use**:
- Flag waving
- Curtain effects
- Vertical parallax
- Rising heat/steam

**Combination Idea**:
```glsl
// Use both Type 0 AND Type 1 simultaneously
uv.x += sin(uv.y * 20.0 + u_time) * u_distortionAmount * 0.03;
uv.y += sin(uv.x * 20.0 + u_time) * u_distortionAmount * 0.03;
// Creates cross-hatched wave pattern
```

---

### Type 2: Circular Ripple

**Location**: Shader lines 198-200

**Code**:
```glsl
float dist = distance(uv, center);  // center = vec2(0.5, 0.5)
uv.x += sin(dist * 20.0 + u_time) * u_distortionAmount * 0.05;
```

**Mathematical Breakdown**:

| Component | Value | Purpose |
|-----------|-------|---------|
| `distance(uv, center)` | 0.0 - 0.707 | Radial distance from center |
| `* 20.0` | Frequency | 20 concentric ripples |
| `+ u_time` | Phase | Ripples expand outward |
| `sin(...)` | -1 to 1 | Wave shape |
| `uv.x +=` | **Only X** | Asymmetric (creates unique look) |

**Visual Diagram**:
```
Distance field:        Resulting distortion:
    0.2                     ╱─╲
  0.3   0.3               ╱   ╲
0.4  0.0  0.4    →      ╱  X  ╲  ← Ripples
  0.3   0.3               ╲   ╱
    0.4                     ╲─╱

Concentric circles      Only X displaced (asymmetric)
```

**Why Only X?**
```glsl
// Current (asymmetric):
uv.x += sin(dist * 20.0 + u_time) * amount * 0.05;

// Symmetric alternative:
vec2 direction = normalize(uv - center);
uv += direction * sin(dist * 20.0 + u_time) * amount * 0.05;
// Would create perfect circular ripples
```

**Animation Behavior**:
- Ripples emanate from center outward
- Like dropping stone in water
- Asymmetry creates interesting distortion

**When to Use**:
- Sonar/radar effects
- Impact waves
- Bass drops (center explosion)
- Pulsing energy

**How to Modify**:
```glsl
// Symmetric radial ripple
vec2 dir = normalize(uv - center);
uv += dir * sin(dist * 20.0 + u_time) * u_distortionAmount * 0.05;

// Multiple centers (dual ripples)
float dist1 = distance(uv, vec2(0.3, 0.5));
float dist2 = distance(uv, vec2(0.7, 0.5));
uv.x += sin(dist1 * 20.0 + u_time) * u_distortionAmount * 0.03;
uv.x += sin(dist2 * 20.0 + u_time) * u_distortionAmount * 0.03;

// Inward ripple (implosion)
uv.x += sin(dist * 20.0 - u_time) * u_distortionAmount * 0.05;
```

---

### Type 3: Diagonal Waves

**Location**: Shader lines 202-203

**Code**:
```glsl
uv.x += sin(uv.y * 15.0 + u_time) * u_distortionAmount * 0.05 * cos(u_time * 0.5);
```

**Mathematical Breakdown**:

| Component | Value | Purpose |
|-----------|-------|---------|
| `sin(uv.y * 15.0 + u_time)` | -1 to 1 | Base horizontal wave (15 cycles) |
| `* cos(u_time * 0.5)` | -1 to 1 | **Amplitude modulation** |
| Combined effect | | Wave that "breathes" |

**Key Innovation: Amplitude Modulation**

The `cos(u_time * 0.5)` makes the entire wave fade in and out:

```
Time:     0s      π s     2π s    3π s
cos(t/2): 1.0  →  0.0  →  -1.0 → 0.0  → 1.0
Effect:   Full    None    Full    None   Full
          wave    flat    wave    flat   wave
                          (reversed)

Period: ~12.5 seconds for full cycle
```

**Visual Timeline**:
```
t=0s (cos=1.0):        t=π s (cos=0.0):      t=2π s (cos=-1.0):
┌──────────┐           ┌──────────┐          ┌──────────┐
│ ╱███████ │           │ ████████ │          │ ███████╲ │
│ ██████╲  │           │ ████████ │          │  ╱██████ │
│ ╱███████ │    →      │ ████████ │    →     │ ███████╲ │
│ ██████╲  │           │ ████████ │          │  ╱██████ │
└──────────┘           └──────────┘          └──────────┘
Max wave               Flat (no wave)        Reversed wave
```

**When to Use**:
- Breathing/pulsing effects
- Organic, living motion
- Slow builds in music
- Subtle background movement

**How to Modify**:
```glsl
// Faster breathing (shorter period)
uv.x += sin(uv.y * 15.0 + u_time) * u_distortionAmount * 0.05 * cos(u_time * 2.0);

// Oscillate between two wave frequencies
float freq = 10.0 + 20.0 * (cos(u_time * 0.5) * 0.5 + 0.5);  // 10-30
uv.x += sin(uv.y * freq + u_time) * u_distortionAmount * 0.05;

// Oscillate between horizontal and vertical
float hWave = sin(uv.y * 15.0 + u_time) * cos(u_time * 0.5);
float vWave = sin(uv.x * 15.0 + u_time) * sin(u_time * 0.5);
uv.x += (hWave + vWave) * u_distortionAmount * 0.05;
```

---

### Type 4: Enhanced Glitch

**Location**: Shader lines 205-246 (42 lines!)

This is the **most complex** distortion. Let's break it down layer by layer.

#### Layer 1: Block Generation (Lines 210-213)

**Code**:
```glsl
float glitchSeed = floor(u_time * 3.5);  // Discrete time steps
float block1 = step(0.6, sin(uv.y * 15.0 + glitchSeed * 13.7));
float block2 = step(0.7, sin(uv.y * 28.0 + glitchSeed * 7.3));
float block3 = step(0.75, sin(uv.y * 45.0 + glitchSeed * 23.1));
float block4 = step(0.8, sin(uv.y * 70.0 + glitchSeed * 31.4));
```

**`step(edge, x)` function**:
```glsl
step(0.6, 0.5) = 0.0  // x < edge → 0
step(0.6, 0.7) = 1.0  // x ≥ edge → 1

Creates binary on/off masks
```

**Block generation breakdown**:

| Block | Frequency | Threshold | Result |
|-------|-----------|-----------|--------|
| block1 | 15.0 | 0.6 | ~40% coverage (looser bands) |
| block2 | 28.0 | 0.7 | ~30% coverage (tighter bands) |
| block3 | 45.0 | 0.75 | ~25% coverage (very tight) |
| block4 | 70.0 | 0.8 | ~20% coverage (sparse) |

**Visual representation**:
```
uv.y position:    0.0  0.2  0.4  0.6  0.8  1.0
                  ─────────────────────────────
block1 (15 Hz):   ████    ████    ████    ████  ← Wide bands
block2 (28 Hz):   ██  ██  ██  ██  ██  ██        ← Medium bands
block3 (45 Hz):   █ █ █ █ █ █ █ █ █ █ █         ← Tight bands
block4 (70 Hz):   █  █  █  █  █  █  █  █        ← Very tight

Combined:         █▓▒░  ▓░  ▒░  ░               ← Different densities
```

#### Layer 2: Random Displacements (Lines 216-225)

**Code**:
```glsl
float disp1 = (random(vec2(glitchSeed, 1.0)) - 0.5);  // -0.5 to 0.5
float disp2 = (random(vec2(glitchSeed, 2.0)) - 0.5);
float disp3 = (random(vec2(glitchSeed, 3.0)) - 0.5);
float disp4 = (random(vec2(glitchSeed, 4.0)) - 0.5);

uv.x += block1 * disp1 * u_distortionAmount * 0.12;
uv.x += block2 * disp2 * u_distortionAmount * 0.15;
uv.x += block3 * disp3 * u_distortionAmount * 0.1;
uv.y += block4 * disp4 * u_distortionAmount * 0.08;  // Vertical!
```

**How it works**:
```
For each horizontal band (block):
1. Generate random displacement (-0.5 to 0.5)
2. Multiply by block mask (0 or 1)
3. Scale by audio intensity (u_distortionAmount)
4. Apply limited displacement (0.08 to 0.15)

Result: Different horizontal stripes shift randomly
```

**Intensity scaling**:
```
u_distortionAmount:  0.0   0.3   0.6   (max)
Block1 displacement: 0%    3.6%  7.2%
Block2 displacement: 0%    4.5%  9.0%
Block3 displacement: 0%    3.0%  6.0%
Block4 displacement: 0%    2.4%  4.8%
```

#### Layer 3: Micro-Glitches (Lines 228-230)

**Code**:
```glsl
float microGlitch = fract(u_time * 3.5);  // 0.0 to 1.0 sub-frame variation

if (microGlitch > 0.9) {  // 10% of time
    uv.x += (random(vec2(glitchSeed, 5.0)) - 0.5) * u_distortionAmount * 0.2;
}
```

**Timing**:
```
u_time: 0.0        0.28       0.57       0.86       1.14
glitchSeed: 0          0          1          2          3
microGlitch: 0.0   0.99   0.0    0.01   0.0    0.99   0.0
             │      ▲      │            │      ▲      │
             └──────┴──────┘            └──────┴──────┘
                Trigger                    Trigger

Brief jitter just before seed changes
```

**Effect**: Adds "sub-frame" corruption between main glitch updates

#### Layer 4: Chromatic Aberration (Lines 233-240)

**Code**:
```glsl
if (u_distortionAmount > 0.5) {  // Only at high distortion
    float chromaShift = u_distortionAmount * 0.02;
    uv.x += sin(uv.y * 100.0 + glitchSeed * 5.0) * chromaShift;

    // Vertical glitch lines (3% of scan lines)
    if (random(vec2(floor(uv.y * 50.0), glitchSeed)) > 0.97) {
        uv.x += (random(vec2(glitchSeed, 6.0)) - 0.5) * u_distortionAmount * 0.25;
    }
}
```

**High-frequency ripple**:
```
sin(uv.y * 100.0 ...)
          └─ 100 waves across height

Creates subtle RGB channel separation effect
(Not true chromatic aberration, but simulates it)
```

**Scan line corruption**:
```
50 horizontal scan lines total
~3% affected = 1-2 lines corrupted randomly

Visual:
┌──────────────┐
│ ████████████ │
│ █████╱██████ │  ← Corrupted scan line
│ ████████████ │
│ ████████████ │
│ ███████╲████ │  ← Another corrupted scan line
└──────────────┘
```

#### Layer 5: Block Corruption (Lines 243-246)

**Code**:
```glsl
if (u_distortionAmount > 0.8) {  // Only at VERY high distortion
    float blockCorrupt = step(0.95, random(vec2(floor(uv.y * 20.0), glitchSeed)));
    uv.x += blockCorrupt * (random(vec2(glitchSeed, 7.0)) - 0.5) * 0.3;
}
```

**Effect**:
- Divides into 20 horizontal blocks
- 5% of blocks get severe corruption (30% displacement)
- Only when distortion is very intense

**Complete Glitch Pipeline Summary**:

```
1. Generate 4 block masks (different frequencies)
2. Apply random horizontal shifts to each block
3. Add micro-glitches between seed changes
4. Add high-frequency chromatic ripple (high distortion)
5. Corrupt random scan lines (high distortion)
6. Severely corrupt random blocks (very high distortion)

Result: Multi-layered, chaotic digital corruption
```

**When to Use**:
- Aggressive electronic music
- Dubstep, drum & bass
- Moments of peak intensity
- Digital/cyberpunk aesthetics

**How to Modify**:
```glsl
// More frequent glitch updates (faster chaos)
float glitchSeed = floor(u_time * 10.0);  // Was 3.5

// More blocks (denser glitches)
float block5 = step(0.85, sin(uv.y * 100.0 + glitchSeed * 17.3));

// Color-coded blocks (requires RGB channel separation)
// Sample texture 3 times with different offsets

// Reduced intensity (less obscuring)
uv.x += block1 * disp1 * u_distortionAmount * 0.06;  // Was 0.12
```

---

## Distortion Gallery

Here are 20+ new distortion types you can add to your visualizer.

### 5. Radial Ripple (Symmetric)

**Code**:
```glsl
else if (u_distortionType == 5) {
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(uv, center);
    vec2 direction = normalize(uv - center);

    float ripple = sin(dist * 30.0 - u_time * 2.0);
    uv += direction * ripple * u_distortionAmount * 0.03;
}
```

**What it does**: Perfect circular ripples emanating from center
**Audio mapping**: Bass → distortion amount (impact waves)
**Performance**: Low (simple math)

---

### 6. Twirl/Vortex

**Code**:
```glsl
else if (u_distortionType == 6) {
    vec2 center = vec2(0.5, 0.5);
    vec2 offset = uv - center;
    float dist = length(offset);
    float angle = atan(offset.y, offset.x);

    // Rotate based on distance and time
    float twist = dist * 10.0 * u_distortionAmount - u_time;
    angle += twist;

    // Convert back to Cartesian
    uv = center + dist * vec2(cos(angle), sin(angle));
}
```

**What it does**: Twists the image around center (vortex effect)
**Visual**:
```
Before:           After (twisted):
┌───────┐         ┌───────┐
│ ##### │         │ ╱╲ ╱╲ │
│ ##### │   →     │ ╲╱ ╲╱ │
│ ##### │         │ ╱╲ ╱╲ │
└───────┘         └───────┘
```

**Audio mapping**: Mid → twirl intensity (synth swirls)
**Performance**: Medium (trig functions)

---

### 7. Zoom Pulse

**Code**:
```glsl
else if (u_distortionType == 7) {
    vec2 center = vec2(0.5, 0.5);
    float pulse = sin(u_time * 3.0) * u_distortionAmount * 0.3 + 1.0;
    uv = center + (uv - center) * pulse;
}
```

**What it does**: Image zooms in and out rhythmically
**Math**:
```
pulse range: 0.7 to 1.3 (with amount=1.0)
< 1.0: Zoom in
> 1.0: Zoom out
```

**Audio mapping**: Bass → pulse amount (kick drum zoom)
**Performance**: Low

---

### 8. Pixelation/Mosaic

**Code**:
```glsl
else if (u_distortionType == 8) {
    float pixelSize = 0.01 + u_distortionAmount * 0.05;  // 1% to 6%
    uv = floor(uv / pixelSize) * pixelSize + pixelSize * 0.5;
}
```

**What it does**: Quantizes UV to discrete blocks (pixel art effect)
**Visual**:
```
Original:      Pixelated (size=0.05):
████████       ████  ████  ████
████████   →   ████  ████  ████
████████       ████  ████  ████
```

**Audio mapping**: Mid → pixel size (glitchy breakdown)
**Performance**: Low

---

### 9. Kaleidoscope (Mirror)

**Code**:
```glsl
else if (u_distortionType == 9) {
    vec2 center = vec2(0.5, 0.5);
    vec2 offset = uv - center;
    float angle = atan(offset.y, offset.x);
    float radius = length(offset);

    // Mirror into N segments
    float segments = 6.0;
    angle = mod(angle, 3.14159 * 2.0 / segments);

    uv = center + radius * vec2(cos(angle), sin(angle));
}
```

**What it does**: Creates symmetrical patterns (like a kaleidoscope)
**Audio mapping**: High → segment count (rapid changes create chaos)
**Performance**: Medium

---

### 10. Shear Transform

**Code**:
```glsl
else if (u_distortionType == 10) {
    float shearX = sin(u_time) * u_distortionAmount * 0.5;
    uv.x += uv.y * shearX;  // Skew based on Y position
}
```

**What it does**: Slants the image diagonally
**Visual**:
```
Normal:        Sheared:
┌────┐         ╱────╲
│ ## │         ╱ ## ╱
│ ## │    →    │ ## │
│ ## │         ╲ ## ╲
└────┘         ╲────╱
```

**Audio mapping**: Mid → shear amount
**Performance**: Low

---

### 11. Bulge (Fisheye)

**Code**:
```glsl
else if (u_distortionType == 11) {
    vec2 center = vec2(0.5, 0.5);
    vec2 offset = uv - center;
    float dist = length(offset);

    // Bulge outward (positive) or pinch inward (negative)
    float bulge = 1.0 + u_distortionAmount * dist * 2.0;
    uv = center + offset * bulge;
}
```

**What it does**: Fisheye lens effect (center bulges out)
**Audio mapping**: Bass → bulge amount
**Performance**: Low

---

### 12. Wave Interference

**Code**:
```glsl
else if (u_distortionType == 12) {
    // Two wave sources
    float wave1 = sin(uv.x * 20.0 + u_time);
    float wave2 = sin(uv.y * 20.0 - u_time);

    // Interference pattern
    float interference = (wave1 + wave2) * 0.5;
    uv += vec2(interference) * u_distortionAmount * 0.05;
}
```

**What it does**: Creates moiré/interference patterns
**Audio mapping**: High → wave frequency
**Performance**: Low

---

### 13. Polar Warp

**Code**:
```glsl
else if (u_distortionType == 13) {
    vec2 center = vec2(0.5, 0.5);
    vec2 offset = uv - center;

    // Convert to polar
    float angle = atan(offset.y, offset.x);
    float radius = length(offset);

    // Warp in polar space
    angle += sin(radius * 10.0 + u_time) * u_distortionAmount;

    // Convert back
    uv = center + radius * vec2(cos(angle), sin(angle));
}
```

**What it does**: Warps angular coordinate (spiral-like)
**Audio mapping**: Mid → warp amount
**Performance**: Medium (trig functions)

---

### 14. Random Displacement Noise

**Code**:
```glsl
else if (u_distortionType == 14) {
    // Noise-based displacement
    float noiseX = random(vec2(uv.x * 10.0, u_time * 0.1));
    float noiseY = random(vec2(uv.y * 10.0, u_time * 0.1));

    uv.x += (noiseX - 0.5) * u_distortionAmount * 0.1;
    uv.y += (noiseY - 0.5) * u_distortionAmount * 0.1;
}
```

**What it does**: Random jittery displacement (organic chaos)
**Audio mapping**: High → noise amount (crackle/static)
**Performance**: Low

---

### 15. Scanline Shift

**Code**:
```glsl
else if (u_distortionType == 15) {
    // Different shift for each horizontal line
    float lineIndex = floor(uv.y * 100.0);  // 100 scan lines
    float shift = sin(lineIndex * 0.5 + u_time) * u_distortionAmount * 0.1;
    uv.x += shift;
}
```

**What it does**: Each scan line shifts independently (VHS glitch)
**Audio mapping**: Mid → shift amount
**Performance**: Low

---

### 16. Droste Effect (Recursive)

**Code**:
```glsl
else if (u_distortionType == 16) {
    vec2 center = vec2(0.5, 0.5);
    vec2 offset = uv - center;
    float angle = atan(offset.y, offset.x);
    float radius = length(offset);

    // Logarithmic spiral
    radius = exp(mod(log(radius) - u_time * 0.5, 1.0));

    uv = center + radius * vec2(cos(angle), sin(angle));
}
```

**What it does**: Infinite recursive zoom (Droste effect)
**Audio mapping**: Time speed (don't map to distortion amount)
**Performance**: High (exp/log functions)

---

### 17. Hexagonal Grid

**Code**:
```glsl
else if (u_distortionType == 17) {
    // Hexagonal tiling (complex math)
    vec2 hex = uv * 20.0;
    vec2 s = vec2(1.0, 1.73205);  // sqrt(3)
    vec2 h = vec2(0.5, 0.866025);

    float q = dot(hex, s);
    float r = hex.y;

    // Snap to hex grid
    uv = floor(vec2(q, r)) / 20.0;
}
```

**What it does**: Hexagonal mosaic pattern
**Audio mapping**: Grid size (make hexagons larger/smaller)
**Performance**: Medium

---

### 18. Chromatic Aberration (True)

**Code**:
```glsl
// NOTE: This requires sampling texture 3 times (in main shader code)
// Here's the UV displacement:

else if (u_distortionType == 18) {
    vec2 center = vec2(0.5, 0.5);
    vec2 direction = normalize(uv - center);

    // Store 3 different UVs for R, G, B channels
    // (Would need to modify main shader to sample 3x)
    vec2 uvR = uv + direction * u_distortionAmount * 0.01;
    vec2 uvG = uv;
    vec2 uvB = uv - direction * u_distortionAmount * 0.01;

    // Then in texture sampling:
    // vec4 colorR = texture2D(u_texture, uvR);
    // vec4 colorG = texture2D(u_texture, uvG);
    // vec4 colorB = texture2D(u_texture, uvB);
    // finalColor = vec4(colorR.r, colorG.g, colorB.b, 1.0);
}
```

**What it does**: RGB channels separate (lens distortion)
**Audio mapping**: Bass → separation amount
**Performance**: High (3x texture samples)

---

### 19. Feedback Delay

**Code**:
```glsl
else if (u_distortionType == 19) {
    // Sample previous frame at slightly different position
    vec2 offset = vec2(sin(u_time), cos(u_time)) * 0.01;
    uv += offset * u_distortionAmount;

    // Combined with trail effect, creates echo/feedback
}
```

**What it does**: Creates trailing echo effect
**Audio mapping**: Delay amount (longer trails)
**Performance**: Low (but needs trail buffer)

---

### 20. Grid Warp

**Code**:
```glsl
else if (u_distortionType == 20) {
    // Warp a grid of cells independently
    vec2 grid = floor(uv * 10.0);  // 10x10 grid
    vec2 cell = fract(uv * 10.0);

    // Random offset per cell
    vec2 cellOffset = vec2(
        random(grid + vec2(u_time * 0.1, 0.0)),
        random(grid + vec2(0.0, u_time * 0.1))
    );

    uv = (grid + cell + cellOffset * u_distortionAmount * 0.3) / 10.0;
}
```

**What it does**: Each grid cell wobbles independently
**Audio mapping**: Mid → wobble amount
**Performance**: Low

---

### 21. Barrel/Pincushion Distortion

**Code**:
```glsl
else if (u_distortionType == 21) {
    vec2 center = vec2(0.5, 0.5);
    vec2 offset = uv - center;
    float dist = length(offset);

    // k > 0: Barrel (bulge)
    // k < 0: Pincushion (pinch)
    float k = u_distortionAmount * 2.0 - 1.0;  // -1 to 1
    float distortion = 1.0 + k * dist * dist;

    uv = center + offset * distortion;
}
```

**What it does**: Camera lens distortion
**Audio mapping**: Bass → barrel/pincushion amount
**Performance**: Low

---

### 22. DNA Helix

**Code**:
```glsl
else if (u_distortionType == 22) {
    float helixA = sin(uv.y * 10.0 + u_time) * 0.1;
    float helixB = sin(uv.y * 10.0 - u_time) * 0.1;

    // Two intertwined sine waves
    if (uv.x < 0.5) {
        uv.x += helixA * u_distortionAmount;
    } else {
        uv.x += helixB * u_distortionAmount;
    }
}
```

**What it does**: Double helix pattern
**Audio mapping**: Time speed (rotation speed)
**Performance**: Low

---

### 23. Voronoi Cells

**Code**:
```glsl
else if (u_distortionType == 23) {
    // Simplified Voronoi (cellular pattern)
    vec2 grid = floor(uv * 10.0);
    vec2 cell = fract(uv * 10.0);

    float minDist = 1.0;
    vec2 closestPoint;

    // Check 3x3 neighboring cells
    for (float y = -1.0; y <= 1.0; y++) {
        for (float x = -1.0; x <= 1.0; x++) {
            vec2 neighbor = grid + vec2(x, y);
            vec2 point = vec2(
                random(neighbor + vec2(1.0, 0.0)),
                random(neighbor + vec2(0.0, 1.0))
            );
            float dist = distance(cell - vec2(x, y), point);
            if (dist < minDist) {
                minDist = dist;
                closestPoint = neighbor + point;
            }
        }
    }

    uv = closestPoint / 10.0;
}
```

**What it does**: Organic cellular pattern
**Audio mapping**: Cell size
**Performance**: High (nested loops)

---

### 24. Film Grain Jitter

**Code**:
```glsl
else if (u_distortionType == 24) {
    // Per-pixel random offset (film grain)
    float grainX = random(uv + vec2(u_time, 0.0)) - 0.5;
    float grainY = random(uv + vec2(0.0, u_time)) - 0.5;

    uv += vec2(grainX, grainY) * u_distortionAmount * 0.005;
}
```

**What it does**: Fine-grain jitter (analog film)
**Audio mapping**: High frequencies → grain amount
**Performance**: Low

---

### 25. Perspective Warp

**Code**:
```glsl
else if (u_distortionType == 25) {
    // Simulate 3D perspective
    float perspective = 1.0 + (uv.y - 0.5) * u_distortionAmount;
    uv.x = 0.5 + (uv.x - 0.5) / perspective;
}
```

**What it does**: 3D depth illusion (trapezoid)
**Visual**:
```
Normal:         Perspective:
┌────────┐      ┌──────┐
│        │      │      │
│        │  →   │      │
│        │      │      │
└────────┘      └──────┘
                Narrower at top
```

**Audio mapping**: Mid → perspective amount
**Performance**: Low

---

## Mathematical Function Library

Reusable functions for building custom distortions.

### Rotation Matrix

```glsl
vec2 rotate(vec2 v, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    mat2 m = mat2(c, -s, s, c);
    return m * v;
}

// Usage:
vec2 rotated = rotate(uv - center, u_time) + center;
```

---

### Polar Coordinates

```glsl
struct Polar {
    float angle;  // -π to π
    float radius; // 0 to ~0.707
};

Polar toPolar(vec2 uv, vec2 center) {
    vec2 offset = uv - center;
    Polar p;
    p.angle = atan(offset.y, offset.x);
    p.radius = length(offset);
    return p;
}

vec2 toCartesian(Polar p, vec2 center) {
    return center + p.radius * vec2(cos(p.angle), sin(p.angle));
}

// Usage:
Polar p = toPolar(uv, vec2(0.5, 0.5));
p.angle += sin(p.radius * 10.0 + u_time);  // Spiral warp
uv = toCartesian(p, vec2(0.5, 0.5));
```

---

### Smooth Step (Interpolation)

```glsl
// Built-in GLSL, but here's the math:
float smoothstep(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

// Usage:
float fade = smoothstep(0.3, 0.7, distance(uv, center));
// Smooth transition from 0 to 1 between distances 0.3 and 0.7
```

---

### Easing Functions

```glsl
float easeInOutCubic(float t) {
    return t < 0.5
        ? 4.0 * t * t * t
        : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
}

float easeInOutElastic(float t) {
    const float c5 = (2.0 * 3.14159) / 4.5;
    return t == 0.0 ? 0.0
         : t == 1.0 ? 1.0
         : t < 0.5
         ? -(pow(2.0, 20.0 * t - 10.0) * sin((20.0 * t - 11.125) * c5)) / 2.0
         : (pow(2.0, -20.0 * t + 10.0) * sin((20.0 * t - 11.125) * c5)) / 2.0 + 1.0;
}

// Usage:
float t = fract(u_time * 0.5);  // 0 to 1 loop
float eased = easeInOutCubic(t);
uv = center + (uv - center) * (0.8 + eased * 0.4);  // Pulse with easing
```

---

### Perlin Noise (2D)

```glsl
// Simple 2D Perlin-like noise
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);  // Smoothstep

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Usage:
float n = noise(uv * 10.0 + u_time);
uv += vec2(n - 0.5) * u_distortionAmount * 0.1;
```

---

### Fractal Brownian Motion (fBm)

```glsl
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    // Add 5 octaves
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

// Usage:
float turbulence = fbm(uv * 5.0 + u_time * 0.1);
uv += vec2(turbulence - 0.5) * u_distortionAmount * 0.2;
```

---

### Mirror/Repeat

```glsl
vec2 mirror(vec2 uv) {
    return abs(fract(uv * 0.5) * 2.0 - 1.0);
}

vec2 repeat(vec2 uv, float count) {
    return fract(uv * count);
}

// Usage:
uv = mirror(uv);  // Quad symmetry
uv = repeat(uv, 4.0);  // 4x4 tiling
```

---

## Combination Techniques

### Layering Multiple Distortions

```glsl
// Apply multiple distortions in sequence
vec2 uv = v_texCoord;

// Layer 1: Slow wave
uv.x += sin(uv.y * 10.0 + u_time * 0.5) * 0.02;

// Layer 2: Fast ripple
float dist = distance(uv, vec2(0.5, 0.5));
uv += normalize(uv - vec2(0.5, 0.5)) * sin(dist * 30.0 + u_time * 2.0) * 0.01;

// Layer 3: Rotation
uv = vec2(0.5, 0.5) + rotate(uv - vec2(0.5, 0.5), sin(u_time) * 0.1);

// Sample texture with combined distortion
vec4 texColor = texture2D(u_texture, uv);
```

**Order matters!** Different sequences create different results.

---

### Audio-Driven Combination

```glsl
// Mix between two distortion types based on audio
float mixAmount = smoothstep(0.5, 0.7, u_bassIntensity);

// Distortion A: Horizontal wave
vec2 uvA = v_texCoord;
uvA.x += sin(uvA.y * 20.0 + u_time) * u_distortionAmount * 0.05;

// Distortion B: Radial ripple
vec2 uvB = v_texCoord;
float dist = distance(uvB, vec2(0.5, 0.5));
uvB += normalize(uvB - vec2(0.5, 0.5)) * sin(dist * 30.0 + u_time) * u_distortionAmount * 0.03;

// Blend
vec2 uv = mix(uvA, uvB, mixAmount);
```

---

### Masked Distortion

```glsl
// Apply distortion only to certain regions
float mask = smoothstep(0.3, 0.5, distance(uv, vec2(0.5, 0.5)));

vec2 distortedUV = uv;
distortedUV.x += sin(uv.y * 20.0 + u_time) * 0.1;

uv = mix(distortedUV, uv, mask);
// Center is distorted, edges are normal
```

---

## Audio-Reactive Integration

### Mapping Strategies

**1. Direct Amount Mapping** (already in your code)
```javascript
const distortionAmount = distortionIntensity * 0.6;
gl.uniform1f(distortionAmountLocation, distortionAmount);
```

**2. Frequency Control**
```glsl
float frequency = 10.0 + u_bassIntensity * 30.0;  // 10-40 Hz
uv.x += sin(uv.y * frequency + u_time) * 0.05;
```

**3. Speed Control**
```javascript
const distortionSpeed = 0.02 + mid * 0.3;  // 0.02 to 0.32
time += distortionSpeed;
```

**4. Type Switching**
```javascript
// Switch distortion based on frequency bands
if (bass > 0.8) {
    distortionType = 4;  // Glitch on heavy bass
} else if (high > 0.7) {
    distortionType = 6;  // Twirl on high frequencies
} else {
    distortionType = 0;  // Default wave
}
```

---

### Genre-Specific Recommendations

#### EDM/Electronic
```javascript
// Aggressive, rhythmic
distortionType = bass > 0.8 ? 4 : 0;  // Glitch on drops
distortionAmount = Math.pow(mid, 2.0) * 0.8;  // Peaks only
```
**Recommended types**: Glitch (4), Radial ripple (5), Twirl (6)

#### Hip-Hop/Trap
```javascript
// Sparse, hard-hitting
distortionType = 5;  // Radial ripple for 808s
distortionAmount = bass * 1.2;  // No smoothing, immediate
```
**Recommended types**: Radial ripple (5), Scanline (15), Pixelation (8)

#### Rock/Metal
```javascript
// Full-spectrum, organic
distortionType = high > 0.6 ? 1 : 0;  // Vertical on cymbals
distortionAmount = mid * 0.5;  // Moderate, sustained
```
**Recommended types**: Horizontal/Vertical waves (0, 1), Interference (12)

#### Ambient/Atmospheric
```javascript
// Slow, evolving
distortionType = 3;  // Diagonal breathing
distortionAmount = rms * 0.3;  // Subtle, smooth
distortionSpeed = 0.01;  // Very slow
```
**Recommended types**: Diagonal (3), Noise (14), Polar warp (13)

---

## Performance Optimization

### GPU Cost Comparison

| Distortion Type | Cost | Reason |
|-----------------|------|--------|
| Horizontal/Vertical wave | ⚡ Low | Simple sin() |
| Circular ripple | ⚡ Low | One distance() call |
| Diagonal wave | ⚡ Low | sin() + cos() |
| Glitch | ⚡⚡ Medium | Multiple random() calls |
| Twirl | ⚡⚡ Medium | atan(), sin(), cos() |
| Pixelation | ⚡ Low | floor() only |
| Kaleidoscope | ⚡⚡ Medium | Trig functions |
| Chromatic aberration | ⚡⚡⚡ High | 3x texture samples |
| Voronoi | ⚡⚡⚡ High | Nested loops |
| Droste | ⚡⚡⚡ High | exp(), log() |

### Optimization Tips

**1. Minimize Trig Functions**
```glsl
// SLOW:
for (int i = 0; i < 10; i++) {
    uv.x += sin(float(i) + u_time) * 0.01;
}

// FAST:
float baseWave = sin(u_time);
for (int i = 0; i < 10; i++) {
    uv.x += baseWave * 0.01;
}
```

**2. Use Built-in Functions**
```glsl
// SLOW:
float dist = sqrt((uv.x - 0.5) * (uv.x - 0.5) + (uv.y - 0.5) * (uv.y - 0.5));

// FAST:
float dist = distance(uv, vec2(0.5, 0.5));
```

**3. Avoid Conditionals in Loops**
```glsl
// SLOW:
for (int i = 0; i < 10; i++) {
    if (uv.x > 0.5) {  // Branch divergence
        uv.x += 0.01;
    }
}

// FAST:
float mask = step(0.5, uv.x);
for (int i = 0; i < 10; i++) {
    uv.x += mask * 0.01;
}
```

**4. Pre-calculate Constants**
```glsl
// SLOW:
uv.x += sin(uv.y * 3.14159 * 2.0 / 10.0 + u_time);

// FAST:
const float FREQ = 0.628318;  // Pre-calculated
uv.x += sin(uv.y * FREQ + u_time);
```

---

### Mobile Optimizations

```glsl
#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;  // Use medium precision on mobile
#endif

// Reduce complexity on mobile
#ifdef MOBILE
    // Simpler distortions only
    if (u_distortionType <= 3) {
        // Types 0-3 are cheap
    }
#else
    // Full distortion suite on desktop
    if (u_distortionType <= 25) {
        // All types available
    }
#endif
```

---

## Debugging UV Fields

### Visualize UV Coordinates

```glsl
// Replace your texture sampling with this temporarily:

// Show UV as colors (debug mode)
gl_FragColor = vec4(uv.x, uv.y, 0.0, 1.0);
// Red = U (horizontal), Green = V (vertical)
```

**What you'll see**:
```
Normal UV:              Distorted UV:
┌─────────────┐         ┌─────────────┐
│ ██████████  │         │ █╱█╲█╱█╲█╱█╲│
│ ██████████  │  vs     │ █╲█╱█╲█╱█╲█╱│
│ ██████████  │         │ █╱█╲█╱█╲█╱█╲│
└─────────────┘         └─────────────┘
Smooth gradient         Wavy gradient
(red left→right,        (waves visible)
 green top→bottom)
```

---

### Visualize Displacement Vectors

```glsl
vec2 originalUV = v_texCoord;
vec2 distortedUV = applyDistortion(originalUV);

// Show displacement as color
vec2 displacement = distortedUV - originalUV;
gl_FragColor = vec4(displacement * 10.0 + 0.5, 0.0, 1.0);
// Displacement shown as red/green shift from gray
```

---

### Grid Overlay

```glsl
vec2 uv = applyDistortion(v_texCoord);

// Draw grid lines
float gridSize = 0.1;
vec2 grid = fract(uv / gridSize);
float line = step(0.95, max(grid.x, grid.y));

// Mix with texture
vec4 texColor = texture2D(u_texture, uv);
gl_FragColor = mix(texColor, vec4(1.0, 1.0, 0.0, 1.0), line * 0.5);
// Yellow grid overlaid on distorted texture
```

---

## Design Principles

### 1. Match Distortion to Audio Character

| Audio Type | Recommended Distortion | Why |
|------------|------------------------|-----|
| Kick drum (bass) | Radial ripple | Impact → shockwave |
| Snare | Glitch | Transient → corruption |
| Hi-hat (high) | Fast wave | Rapid → shimmer |
| Synth swell | Twirl | Sustained → rotation |
| Drop | Zoom + Glitch | Intensity → chaos |
| Breakdown | Slow wave | Quiet → subtle |

---

### 2. Distortion Intensity Curves

```javascript
// LINEAR (boring):
distortionAmount = mid * 0.6;

// EXPONENTIAL (better - emphasizes peaks):
distortionAmount = Math.pow(mid, 2.0) * 0.6;

// THRESHOLD (best - only intense moments):
distortionAmount = Math.max(0, mid - 0.5) * 1.2;
```

---

### 3. Avoid Visual Obscuring

**Bad**: Distortion completely hides the image
```glsl
uv.x += sin(uv.y * 20.0) * 0.5;  // 50% displacement = unrecognizable
```

**Good**: Distortion enhances but doesn't destroy
```glsl
uv.x += sin(uv.y * 20.0) * 0.05;  // 5% displacement = recognizable
```

**Rule of thumb**: Keep max displacement under 10% for visual coherence

---

### 4. Temporal Coherence

**Bad**: Random every frame
```glsl
uv += random(uv + u_time) * 0.1;  // Noise, incomprehensible
```

**Good**: Stable changes
```glsl
float seed = floor(u_time * 3.0);
uv += random(uv + seed) * 0.1;  // Stable for ~0.3s, then changes
```

---

## Common Mistakes

### ❌ Mistake 1: Forgetting to Normalize Directions

```glsl
// WRONG:
vec2 direction = uv - center;
uv += direction * distortion;  // Displacement varies with distance!

// CORRECT:
vec2 direction = normalize(uv - center);
uv += direction * distortion;  // Uniform displacement
```

---

### ❌ Mistake 2: UV Out of Bounds

```glsl
// PROBLEM:
uv.x += 0.5;  // Now uv.x can be 0.5 to 1.5 (out of 0-1 range)

// SOLUTIONS:

// A) Wrap (repeating texture)
uv = fract(uv);

// B) Clamp (edge extends)
uv = clamp(uv, 0.0, 1.0);

// C) Mirror
uv = abs(fract(uv * 0.5) * 2.0 - 1.0);
```

**Visual impact**:
```
Wrap:        Clamp:       Mirror:
████████     ████████     ████████
████║███     ████████     ████████
████║███ →   ████████ or  ████████
████████     ████████     ████████

Texture      Edge color   Reflected
repeats      extends      texture
```

---

### ❌ Mistake 3: Integer Division

```glsl
// WRONG (in GLSL):
float value = 1 / 2;  // = 0 (integer division!)

// CORRECT:
float value = 1.0 / 2.0;  // = 0.5
```

---

### ❌ Mistake 4: Incorrect Angle Direction

```glsl
// If rotation seems backwards:
uv = rotate(uv - center, -angle) + center;  // Negate angle

// If UV origin confuses you:
// Remember: (0,0) is TOP-LEFT in UV space
// Y increases DOWNWARD
```

---

### ❌ Mistake 5: Performance Killer Loops

```glsl
// AVOID:
for (int i = 0; i < 1000; i++) {  // 1000 iterations per pixel!
    uv += vec2(0.0001);
}

// BETTER:
uv += vec2(0.1);  // Direct calculation
```

---

## Creating Custom Distortions

### Step-by-Step Process

**1. Define the Visual Goal**
- Sketch what you want to see
- Describe in words: "spiral out from center" or "grid of wobbling cells"

**2. Choose Coordinate System**
- **Cartesian** (uv.x, uv.y): For rectilinear effects (waves, grids)
- **Polar** (angle, radius): For radial effects (spirals, ripples)

**3. Pick Base Functions**
- **Sine/Cosine**: Smooth waves
- **Floor/Fract**: Discrete steps, tiling
- **Distance**: Radial falloff
- **Random**: Chaos, noise
- **Atan**: Angles, spirals

**4. Combine with Time**
- `+ u_time`: Scroll/drift
- `- u_time`: Reverse scroll
- `sin(u_time)`: Oscillation
- `floor(u_time * N)`: Stepped changes

**5. Add Audio Reactivity**
- Multiply by `u_distortionAmount` (intensity)
- Modulate frequency/speed with audio
- Switch types on audio triggers

**6. Test and Iterate**
- Start with small displacement amounts
- Use debug visualization
- Test with different audio

---

### Example: Custom "Breathing Grid" Distortion

**Goal**: Grid of cells that expand/contract with audio

**Step 1: Cartesian grid**
```glsl
vec2 grid = floor(uv * 10.0);  // 10x10 grid
vec2 cell = fract(uv * 10.0);  // Position within cell (0-1)
```

**Step 2: Center within cell**
```glsl
vec2 cellCenter = vec2(0.5, 0.5);
vec2 offset = cell - cellCenter;  // -0.5 to 0.5
```

**Step 3: Pulsing scale**
```glsl
float pulse = 0.8 + u_distortionAmount * 0.4;  // 0.8 to 1.2
offset *= pulse;
```

**Step 4: Reconstruct UV**
```glsl
cell = cellCenter + offset;
uv = (grid + cell) / 10.0;
```

**Complete code**:
```glsl
else if (u_distortionType == 26) {
    vec2 grid = floor(uv * 10.0);
    vec2 cell = fract(uv * 10.0);
    vec2 cellCenter = vec2(0.5, 0.5);
    vec2 offset = cell - cellCenter;

    float pulse = 0.8 + sin(u_time * 3.0) * u_distortionAmount * 0.4;
    offset *= pulse;

    cell = cellCenter + offset;
    uv = (grid + cell) / 10.0;
}
```

**Result**: Grid cells breathe in/out rhythmically!

---

## Progression Path

### Beginner: Understand Existing

- [ ] Read and understand all 5 current distortion types
- [ ] Visualize UV coordinates with debug colors
- [ ] Modify one parameter (frequency, amplitude) and observe
- [ ] Add one simple distortion (e.g., zoom pulse)

**Time**: 1-2 hours

---

### Intermediate: Create New Types

- [ ] Implement 3 distortions from the gallery
- [ ] Combine two distortions in sequence
- [ ] Add audio-driven frequency modulation
- [ ] Create custom masked distortion

**Time**: 3-5 hours

---

### Advanced: Master Techniques

- [ ] Implement polar coordinate distortion from scratch
- [ ] Build multi-layer distortion system
- [ ] Optimize for mobile (check FPS)
- [ ] Create genre-specific presets

**Time**: 5-10 hours

---

### Expert: Innovate

- [ ] Design 5 completely original distortions
- [ ] Implement recursive/fractal effects
- [ ] Build automatic distortion sequencer
- [ ] Publish tutorial/article about your techniques

**Time**: 10+ hours

---

## Conclusion

You now have:
- ✅ Deep understanding of UV coordinate manipulation
- ✅ Analysis of your 5 existing distortion types
- ✅ 25+ new distortion recipes ready to implement
- ✅ Mathematical function library for custom effects
- ✅ Audio-reactive integration strategies
- ✅ Performance optimization techniques
- ✅ Debugging tools and visualization methods
- ✅ Design principles for choosing distortions
- ✅ Clear progression path from beginner to expert

**Next Steps**:

1. **Implement one new distortion** from the gallery
2. **Test with your favorite song** and observe behavior
3. **Modify parameters** to match your aesthetic
4. **Combine with audio reactivity** for dynamic effects
5. **Share your creations** and iterate

**Related Guides**:
- [Audio-Reactive Design Patterns](./AUDIO_REACTIVE_DESIGN_PATTERNS.md) - How to map audio to parameters
- [Procedural Noise Functions](./PROCEDURAL_NOISE_FUNCTIONS.md) - Deep dive into noise algorithms
- [Shader Optimization](./SHADER_OPTIMIZATION.md) - Make it faster

---

## Quick Reference

### Adding a New Distortion Type

```glsl
// In fragment shader (after line 247):
else if (u_distortionType == N) {
    // Your distortion code here
    // Modify uv.x and/or uv.y
    // Use u_distortionAmount for intensity
    // Use u_time for animation
}
```

```javascript
// In JavaScript (line 58):
let distortionType = $state(N);  // Set your new type

// Or randomly include new type:
let distortionType = $state(Math.floor(Math.random() * (N + 1)));
```

### Testing a Distortion

```javascript
// Temporarily force a specific type for testing:
distortionType = 5;  // Test type 5

// Use debug visualization:
gl_FragColor = vec4(uv.x, uv.y, 0.0, 1.0);  // See UV as colors
```

### Common Formulas

```glsl
// Horizontal wave
uv.x += sin(uv.y * frequency + u_time) * amplitude;

// Radial ripple
float dist = distance(uv, center);
uv += normalize(uv - center) * sin(dist * frequency + u_time) * amplitude;

// Rotation
vec2 offset = rotate(uv - center, angle);
uv = center + offset;

// Polar warp
Polar p = toPolar(uv, center);
p.angle += sin(p.radius * frequency + u_time) * amount;
uv = toCartesian(p, center);
```

Happy distorting! 🌊✨

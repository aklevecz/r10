# Procedural Noise Functions

**A comprehensive guide to creating organic variation and natural randomness in shaders**

> **Purpose**: Master procedural noise generation to create organic motion, natural textures, and controlled randomness in real-time graphics.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Glossary](#glossary)
3. [Your Current Implementation](#your-current-implementation)
4. [Noise Fundamentals](#noise-fundamentals)
5. [Noise Types Deep Dive](#noise-types-deep-dive)
6. [Audio-Reactive Noise](#audio-reactive-noise)
7. [Noise Applications](#noise-applications)
8. [Fractal Noise (FBM)](#fractal-noise-fbm)
9. [Domain Warping](#domain-warping)
10. [Performance Optimization](#performance-optimization)
11. [Debugging Noise](#debugging-noise)
12. [Common Mistakes](#common-mistakes)
13. [Copy-Paste Noise Library](#copy-paste-noise-library)
14. [Progression Path](#progression-path)

---

## Quick Start

**Get better noise variation in 5 minutes:**

### 1. Understand Your Current System
You use **3D Perlin-style noise** in your shader:
```glsl
// Lines 177-188: Custom 3D noise function
float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep
    // ... hash and interpolation ...
}
```

### 2. Try This First
**Add audio-reactive noise scale:**

```glsl
// In your shader, replace current noise call with:
// Current (line 296):
float n = noise(vec3(uv * 10.0, u_time * 0.5));

// Enhanced: Audio-reactive scale
float noiseScale = 10.0 + u_bass * 20.0; // 10-30 based on bass
float noiseSpeed = 0.5 + u_high * 1.5;   // 0.5-2.0 based on highs
float n = noise(vec3(uv * noiseScale, u_time * noiseSpeed));
```

### 3. Test With Music
- **Bass hit** → Larger noise features (scale 30)
- **High frequencies** → Faster noise animation (speed 2.0)
- **Silence** → Default scale and speed

**Result**: Noise that breathes and dances with the music.

---

## Glossary

### Core Concepts

- **Noise**: Controlled randomness. Appears random but is deterministic (same input → same output).
- **Pseudorandom**: Appears random but follows mathematical rules. Reproducible.
- **Coherent Noise**: Noise with smooth transitions (no sudden jumps). Essential for natural appearance.
- **Gradient Noise**: Noise based on interpolating random gradients at grid points (e.g., Perlin, Simplex).
- **Value Noise**: Noise based on interpolating random values at grid points. Simpler than gradient noise.

### Noise Properties

- **Frequency**: Spatial rate of change. High frequency = small, detailed features. Low frequency = large, smooth features.
- **Amplitude**: Range of values. Noise × amplitude = scaled output.
- **Octave**: Single layer of noise at specific frequency. Multiple octaves create complexity.
- **Lacunarity**: Frequency multiplier between octaves (typically 2.0 = double frequency each octave).
- **Persistence**: Amplitude multiplier between octaves (typically 0.5 = half amplitude each octave).
- **FBM (Fractal Brownian Motion)**: Summing multiple octaves of noise at different frequencies/amplitudes.

### Noise Types

- **Perlin Noise**: Classic gradient noise. Smooth, natural-looking. Invented by Ken Perlin (1983).
- **Simplex Noise**: Improved Perlin. Fewer artifacts, better performance in higher dimensions.
- **Value Noise**: Interpolated random values. Simpler but less natural than gradient noise.
- **Worley Noise (Cellular)**: Based on distance to random points. Creates cell/tile patterns.
- **White Noise**: Pure random values. No coherence. Looks like TV static.
- **Turbulence**: Absolute value of noise. Creates billowy, cloud-like patterns.

### Mathematical Terms

- **Hash Function**: Maps input to pseudorandom output. Deterministic but appears random.
- **Interpolation**: Blending between values. Linear, cubic, quintic, etc.
- **Smoothstep**: S-curve interpolation. Smooth acceleration and deceleration.
- **Dot Product**: Measures alignment between vectors. Used in gradient noise.
- **Fract**: Fractional part of number (removes integer). Creates repeating patterns.
- **Floor**: Round down to integer. Creates grid cells.

### Applications

- **Distortion**: Using noise to offset UV coordinates. Creates organic warping.
- **Texturing**: Using noise as color/pattern. Clouds, marble, wood, etc.
- **Animation**: Noise with time dimension. Creates flowing motion.
- **Variation**: Breaking up uniform patterns. Adds organic feel.
- **Domain Warping**: Using noise to distort noise. Highly organic results.

---

## Your Current Implementation

### Complete Code Analysis

**Lines 177-188: 3D Noise Function**

```glsl
float noise(vec3 p) {
    // Line 178: Split input into integer and fractional parts
    vec3 i = floor(p);
    // i = grid cell coordinates (e.g., (5, 2, 1))

    vec3 f = fract(p);
    // f = position within cell (0-1 in each dimension)
    // Example: p = (5.3, 2.7, 1.2) → i = (5, 2, 1), f = (0.3, 0.7, 0.2)

    // Line 179: Apply smoothstep to fractional part
    f = f * f * (3.0 - 2.0 * f);
    // This is smoothstep formula: 3t² - 2t³
    // Creates S-curve: slow at 0, fast in middle, slow at 1
    // Input f=0.0 → 0.0
    // Input f=0.5 → 0.5
    // Input f=1.0 → 1.0
    // But slopes at 0 and 1 are zero (smooth!)

    // Line 180: Create unique value for this 3D cell
    float n = i.x + i.y * 57.0 + 113.0 * i.z;
    // Each cell gets unique ID
    // Example: cell (5, 2, 1) → 5 + 2×57 + 113×1 = 232
    // Multipliers (57, 113) are arbitrary primes for good distribution

    // Line 181-187: Sample 8 corners of cube and interpolate
    // A cube has 8 corners. We need random value at each corner,
    // then interpolate based on position (f) within cube.

    // Line 181-184: Get values at 4 bottom corners (z=0 plane)
    vec4 a = fract(sin(vec4(n, n+1.0, n+57.0, n+58.0)) * 43758.5453);
    // n:     bottom-back-left   (x, y, z)
    // n+1:   bottom-back-right  (x+1, y, z)
    // n+57:  bottom-front-left  (x, y+1, z)
    // n+58:  bottom-front-right (x+1, y+1, z)

    // sin() converts integer to -1 to 1
    // × 43758.5453 scales to large number
    // fract() takes fractional part → pseudorandom 0-1
    // Different n → different random value, but same n always same value

    // Line 185: Get values at 4 top corners (z=1 plane)
    vec4 b = fract(sin(vec4(n+113.0, n+114.0, n+170.0, n+171.0)) * 43758.5453);
    // +113 moves to next z layer
    // n+113:  top-back-left
    // n+114:  top-back-right
    // n+170:  top-front-left
    // n+171:  top-front-right

    // Line 186-187: Trilinear interpolation
    // Interpolate in x direction (4 values → 2 values)
    vec2 c = mix(a.xz, a.yw, f.x);
    vec2 d = mix(b.xz, b.yw, f.x);
    // c.x = interpolate bottom-back (left/right)
    // c.y = interpolate bottom-front (left/right)
    // d.x = interpolate top-back (left/right)
    // d.y = interpolate top-front (left/right)

    // Interpolate in y direction (2 values → 1 value)
    vec2 e = mix(c, d, f.y);
    // e.x = interpolate bottom (back/front)
    // e.y = interpolate top (back/front)

    // Interpolate in z direction (final result)
    return mix(e.x, e.y, f.z);
    // Final interpolation between bottom and top
    // Returns value in 0-1 range
}
```

### Visual Representation

**3D Grid and Interpolation**:

```
3D Noise grid (showing one cube):

      Top face (z=1)
      n+170 -------- n+171
        /|            /|
       / |           / |
      /  |          /  |
n+113 -------- n+114  |
     |   |        |   |
     | n+57 ------|-- n+58   Bottom face (z=0)
     |  /         |  /
     | /          | /
     |/           |/
     n --------- n+1

Input point p = (5.3, 2.7, 1.2)
├─ Grid cell i = (5, 2, 1)
├─ Cell ID n = 232
├─ Position within cell f = (0.3, 0.7, 0.2)
└─ After smoothstep f = (0.216, 0.784, 0.104)

8 corner random values:
  n     = 0.847  (bottom-back-left)
  n+1   = 0.234  (bottom-back-right)
  n+57  = 0.612  (bottom-front-left)
  n+58  = 0.891  (bottom-front-right)
  n+113 = 0.456  (top-back-left)
  n+114 = 0.723  (top-back-right)
  n+170 = 0.189  (top-front-left)
  n+171 = 0.567  (top-front-right)

Trilinear interpolation:
  Step 1 (x): Interpolate left/right pairs
    bottom-back:  0.847 ←→ 0.234 = 0.715
    bottom-front: 0.612 ←→ 0.891 = 0.672
    top-back:     0.456 ←→ 0.723 = 0.514
    top-front:    0.189 ←→ 0.567 = 0.289

  Step 2 (y): Interpolate back/front pairs
    bottom: 0.715 ←→ 0.672 = 0.685
    top:    0.514 ←→ 0.289 = 0.337

  Step 3 (z): Interpolate bottom/top
    final: 0.685 ←→ 0.337 = 0.649

Result: noise(5.3, 2.7, 1.2) = 0.649
```

**Smoothstep Curve**:

```
f(t) = 3t² - 2t³

1.0 |         ╱──
    |       ╱
0.5 |     ╱
    |   ╱
0.0 |──╱
    └────────────
    0.0   0.5  1.0

Linear:      ───────  (constant slope)
Smoothstep:  ──╱───   (S-curve, smooth ends)

Why smoothstep?
- At t=0: derivative = 0 (smooth connection)
- At t=1: derivative = 0 (smooth connection)
- Eliminates visible grid artifacts
```

### Usage in Your Shader

**Line 296: Noise Application**

```glsl
float n = noise(vec3(uv * 10.0, u_time * 0.5));
```

**Breakdown**:
```
Input coordinates:
  uv = (0.5, 0.5)  // Center of screen
  u_time = 10.0    // 10 seconds elapsed

Calculation:
  uv * 10.0 = (5.0, 5.0)      // Scale space (10 cycles across screen)
  u_time * 0.5 = 5.0          // Scale time (half speed)

  Input to noise: (5.0, 5.0, 5.0)
  Output: ~0.5 (some value 0-1)

Effect:
  - 10.0 spatial scale → 10×10 grid of noise features
  - 0.5 time scale → noise evolves slowly
  - As time passes, noise patterns flow/evolve
```

**Parameters Explained**:

| Parameter | Value | Effect | Change To |
|-----------|-------|--------|-----------|
| **Spatial scale** | 10.0 | 10 noise features across screen | 5.0 = larger features<br>20.0 = smaller features |
| **Time scale** | 0.5 | Slow animation (2 seconds per cycle) | 0.1 = very slow<br>2.0 = fast |
| **Dimensions** | 3D | Smooth temporal evolution | 2D = static (no time)<br>4D = more variation |

### Characteristics of Your Noise

**Strengths**:
1. **3D (spatial + time)**: Smooth temporal evolution, no looping
2. **Smoothstep interpolation**: No visible grid artifacts
3. **Fast**: ~15 instructions, GPU-friendly
4. **Deterministic**: Same input always gives same output
5. **Range**: 0-1 (normalized, easy to use)

**Limitations**:
1. **Not true Perlin**: Simplified version (value noise, not gradient noise)
2. **Directional bias**: Slight preference for axis-aligned patterns
3. **Limited frequency**: Single octave (not fractal)
4. **Hash quality**: Simple sin-based hash (not cryptographic)
5. **Periodicity**: Will repeat after very large coordinates

**Performance**:
- ~15 GPU instructions
- 2 texture lookups equivalent
- Suitable for real-time at any resolution

---

## Noise Fundamentals

### What is Noise?

**Not Random**:
```glsl
// ❌ This is random (different every call)
float random = fract(sin(u_time) * 43758.5453);
// u_time = 1.0 → 0.847
// u_time = 1.0 → 0.847 (same!)
// u_time = 1.1 → 0.234 (totally different!)
// Discontinuous jump!

// ✅ This is noise (coherent, smooth)
float n = noise(vec3(uv, u_time));
// Nearby inputs → nearby outputs
// Smooth transitions
```

**Key Properties of Good Noise**:

1. **Deterministic**: Same input → same output
   ```glsl
   noise(5.0, 2.0, 1.0) = 0.847  (always)
   ```

2. **Coherent**: Nearby inputs → nearby outputs
   ```glsl
   noise(5.0, 2.0, 1.0) = 0.847
   noise(5.1, 2.0, 1.0) = 0.853  (similar!)
   ```

3. **Non-periodic**: Doesn't obviously repeat
   ```glsl
   noise(5.0, 2.0, 1.0) ≠ noise(6.0, 2.0, 1.0)
   noise(5.0, 2.0, 1.0) ≠ noise(5.0, 3.0, 1.0)
   ```

4. **Uniform distribution**: All values equally likely (over large sample)
   ```
   Histogram of 1000 samples:
   1.0 |  ████
   0.8 |  ████
   0.6 |  ████
   0.4 |  ████
   0.2 |  ████
   0.0 |  ████
       └──────
   Uniform!
   ```

5. **Stationary**: Statistics don't change with position
   ```glsl
   // Average value ~0.5 everywhere
   avg(noise(0-100)) ≈ 0.5
   avg(noise(1000-1100)) ≈ 0.5
   ```

### Hash Functions

**Purpose**: Convert coordinates to pseudorandom value.

**Your Current Hash**:
```glsl
float hash = fract(sin(n) * 43758.5453);
```

**How it works**:
```
Input: n = 232 (integer cell ID)

Step 1: sin(232) = -0.8987
  ├─ sin() maps integers to -1 to 1
  └─ Appears random for different inputs

Step 2: × 43758.5453 = -39324.7834
  ├─ Large multiplier amplifies small differences
  └─ Number chosen for good distribution

Step 3: fract(-39324.7834) = 0.2166
  ├─ fract() removes integer part
  └─ Returns 0-1 range

Result: 232 → 0.2166 (appears random)
        233 → 0.8472 (completely different)
        234 → 0.0931 (completely different)
```

**Alternative Hash Functions**:

```glsl
// Better quality (slower)
float hash(float n) {
    return fract(sin(n) * 1e4);
}

float hash(vec2 p) {
    return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x))));
}

// Best quality (slowest)
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Fast but lower quality
float hash(float n) {
    return fract(n * 17.0 * fract(n * 0.3183099));
}
```

### Interpolation Methods

**Linear** (simplest):
```glsl
float lerp(float a, float b, float t) {
    return a + (b - a) * t;
}

// Example:
lerp(0.0, 1.0, 0.0) = 0.0
lerp(0.0, 1.0, 0.5) = 0.5
lerp(0.0, 1.0, 1.0) = 1.0
```

**Smoothstep** (your current):
```glsl
float smoothstep(float t) {
    return t * t * (3.0 - 2.0 * t);
}

// Derivative = 0 at t=0 and t=1
// Smoother than linear
```

**Smootherstep** (even smoother):
```glsl
float smootherstep(float t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Derivative = 0 at t=0 and t=1
// Second derivative = 0 at t=0 and t=1
// Extremely smooth
```

**Cubic Hermite**:
```glsl
float cubic(float t) {
    return t * t * (3.0 - 2.0 * t);  // Same as smoothstep
}
```

**Quintic**:
```glsl
float quintic(float t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);  // Same as smootherstep
}
```

**Comparison**:

```
Value interpolation from 0.2 to 0.8:

1.0 |           Linear    Smoothstep   Smootherstep
0.8 |           ────╱     ────╱        ─────╱
0.6 |         ╱           ╱             ╱
0.4 |       ╱         ╱              ╱
0.2 |     ╱       ╱              ╱
0.0 |───╱    ───╱           ───╱
    └──────────────────────────────────
    0.0        0.5                 1.0

Linear:       Constant slope, visible grid
Smoothstep:   Smooth ends, no visible grid  ✓ Your choice
Smootherstep: Ultra-smooth, best quality
```

### Dimensionality

**1D Noise** (input: x):
```glsl
float noise1D(float x) {
    float i = floor(x);
    float f = fract(x);
    float a = hash(i);
    float b = hash(i + 1.0);
    return mix(a, b, smoothstep(f));
}

// Use case: Varying line thickness, 1D variation
```

**2D Noise** (input: x, y):
```glsl
float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    // 4 corners
    float a = hash(i);
    float b = hash(i + vec2(1, 0));
    float c = hash(i + vec2(0, 1));
    float d = hash(i + vec2(1, 1));

    // Bilinear interpolation
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Use case: Static textures, terrain heightmaps
```

**3D Noise** (input: x, y, z) - **Your current**:
```glsl
// Your implementation (lines 177-188)
// 8 corners, trilinear interpolation

// Use case: Animated textures (z = time), volumetric effects
```

**4D Noise** (input: x, y, z, w):
```glsl
// 16 corners, quadlinear interpolation
// Very expensive but ultra-smooth temporal evolution

// Use case: Seamlessly looping animations (w = angle around circle)
```

**Dimension Trade-offs**:

| Dimensions | Corners | Instructions | Use Case |
|------------|---------|--------------|----------|
| **1D** | 2 | ~5 | Simple variation |
| **2D** | 4 | ~10 | Static textures |
| **3D** | 8 | ~15 | Animated textures (yours) |
| **4D** | 16 | ~30 | Seamless loops |

---

## Noise Types Deep Dive

### Type 1: Value Noise (Your Current)

**Concept**: Interpolate random values at grid points.

**Complete Implementation**:
```glsl
float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n = i.x + i.y * 57.0 + 113.0 * i.z;

    vec4 a = fract(sin(vec4(n, n+1.0, n+57.0, n+58.0)) * 43758.5453);
    vec4 b = fract(sin(vec4(n+113.0, n+114.0, n+170.0, n+171.0)) * 43758.5453);

    return mix(mix(mix(a.x, a.y, f.x), mix(a.z, a.w, f.x), f.y),
               mix(mix(b.x, b.y, f.x), mix(b.z, b.w, f.x), f.y), f.z);
}
```

**Characteristics**:
- ✅ Simple and fast
- ✅ Easy to understand
- ⚠️ Slight directional bias
- ⚠️ Less natural than gradient noise

**Visual Appearance**:
```
Value noise (your type):
  ░░▒▒██████▒▒░░
  ░▒▒███████▒▒░░
  ▒▒██████████▒░
  ▒███████████▒░
  ███████████▒░░

Notice: Slight preference for horizontal/vertical features
```

### Type 2: Perlin Noise (True Gradient-Based)

**Concept**: Interpolate dot products of random gradients.

**Implementation**:
```glsl
// 2D Perlin noise
vec2 randomGradient(vec2 p) {
    float n = dot(p, vec2(127.1, 311.7));
    n = fract(sin(n) * 43758.5453);
    float angle = n * 6.28318530718;  // 0-2π
    return vec2(cos(angle), sin(angle));
}

float perlin2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // 4 corners
    vec2 g00 = randomGradient(i + vec2(0, 0));
    vec2 g10 = randomGradient(i + vec2(1, 0));
    vec2 g01 = randomGradient(i + vec2(0, 1));
    vec2 g11 = randomGradient(i + vec2(1, 1));

    // Dot products
    float d00 = dot(g00, f - vec2(0, 0));
    float d10 = dot(g10, f - vec2(1, 0));
    float d01 = dot(g01, f - vec2(0, 1));
    float d11 = dot(g11, f - vec2(1, 1));

    // Smoothstep
    vec2 u = f * f * (3.0 - 2.0 * f);

    // Interpolate
    return mix(mix(d00, d10, u.x), mix(d01, d11, u.x), u.y);
}
```

**3D Perlin** (more complex):
```glsl
vec3 randomGradient3D(vec3 p) {
    float n = dot(p, vec3(127.1, 311.7, 74.7));
    n = fract(sin(n) * 43758.5453);
    float theta = n * 6.28318530718;
    float phi = acos(2.0 * fract(n * 12345.6789) - 1.0);
    return vec3(
        sin(phi) * cos(theta),
        sin(phi) * sin(theta),
        cos(phi)
    );
}

float perlin3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);

    // 8 corners
    vec3 g000 = randomGradient3D(i + vec3(0, 0, 0));
    vec3 g100 = randomGradient3D(i + vec3(1, 0, 0));
    vec3 g010 = randomGradient3D(i + vec3(0, 1, 0));
    vec3 g110 = randomGradient3D(i + vec3(1, 1, 0));
    vec3 g001 = randomGradient3D(i + vec3(0, 0, 1));
    vec3 g101 = randomGradient3D(i + vec3(1, 0, 1));
    vec3 g011 = randomGradient3D(i + vec3(0, 1, 1));
    vec3 g111 = randomGradient3D(i + vec3(1, 1, 1));

    // Dot products
    float d000 = dot(g000, f - vec3(0, 0, 0));
    float d100 = dot(g100, f - vec3(1, 0, 0));
    float d010 = dot(g010, f - vec3(0, 1, 0));
    float d110 = dot(g110, f - vec3(1, 1, 0));
    float d001 = dot(g001, f - vec3(0, 0, 1));
    float d101 = dot(g101, f - vec3(1, 0, 1));
    float d011 = dot(g011, f - vec3(0, 1, 1));
    float d111 = dot(g111, f - vec3(1, 1, 1));

    // Smoothstep
    vec3 u = f * f * (3.0 - 2.0 * f);

    // Trilinear interpolation
    return mix(
        mix(mix(d000, d100, u.x), mix(d010, d110, u.x), u.y),
        mix(mix(d001, d101, u.x), mix(d011, d111, u.x), u.y),
        u.z
    );
}
```

**Characteristics**:
- ✅ More natural than value noise
- ✅ No directional bias
- ✅ Industry standard (widely used)
- ⚠️ More expensive (~2× cost of value noise)

**Visual Comparison**:
```
Value noise:         True Perlin:
░░▒▒██████▒▒░░      ░▒████▓▓▒░░░
░▒▒███████▒▒░░      ▒███▓▓▓▓▒░░░
▒▒██████████▒░      ███▓▓▓▒▒░░░░
███████████▒░░      ██▓▓▒▒░░░░░░

Notice: Perlin has more organic, isotropic appearance
```

### Type 3: Simplex Noise

**Concept**: Improved Perlin using simplex grid (triangles in 2D, tetrahedra in 3D).

**2D Simplex Noise** (simplified):
```glsl
float simplex2D(vec2 p) {
    const float K1 = 0.366025404; // (sqrt(3)-1)/2
    const float K2 = 0.211324865; // (3-sqrt(3))/6

    // Skew input space to triangular grid
    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;

    // Determine which triangle we're in
    vec2 o = (a.x > a.y) ? vec2(1, 0) : vec2(0, 1);

    // Three corners of triangle
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;

    // Hash
    vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);

    // Gradients
    vec3 n = h * h * h * h * vec3(
        dot(a, randomGradient(i)),
        dot(b, randomGradient(i + o)),
        dot(c, randomGradient(i + 1.0))
    );

    return dot(n, vec3(70.0));
}
```

**Characteristics**:
- ✅ Fewer artifacts than Perlin
- ✅ Better performance in 3D/4D
- ✅ More uniform feature distribution
- ⚠️ More complex to implement
- ⚠️ Patented (expired 2022, now free!)

**Performance**:
```
2D noise:
  Value:   ~10 instructions
  Perlin:  ~20 instructions
  Simplex: ~25 instructions

3D noise:
  Value:   ~15 instructions
  Perlin:  ~40 instructions
  Simplex: ~30 instructions ← Better than Perlin in 3D+!

4D noise:
  Value:   ~30 instructions
  Perlin:  ~80 instructions
  Simplex: ~35 instructions ← Much better!
```

### Type 4: Worley Noise (Cellular)

**Concept**: Distance to nearest random point. Creates cell patterns.

**Implementation**:
```glsl
float worley(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float minDist = 1.0;

    // Check 3×3 neighborhood
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));

            // Random point in this cell
            vec2 point = randomVec2(i + neighbor);

            // Distance to point
            float dist = length(neighbor + point - f);

            minDist = min(minDist, dist);
        }
    }

    return minDist;
}

vec2 randomVec2(vec2 p) {
    float n = dot(p, vec2(127.1, 311.7));
    return fract(sin(vec2(n, n + 1.0)) * 43758.5453);
}
```

**Variations**:
```glsl
// F1: Distance to nearest point (standard)
float worleyF1(vec2 p) {
    // Return minDist directly
}

// F2: Distance to second-nearest point
float worleyF2(vec2 p) {
    // Track minDist1 and minDist2
    // Return minDist2
}

// F2 - F1: Cell boundaries
float worleyCells(vec2 p) {
    float f1 = worleyF1(p);
    float f2 = worleyF2(p);
    return f2 - f1;  // Bright at cell edges
}

// Crackle: Multiply by random value
float worleyCrackle(vec2 p) {
    // Find nearest point
    // Multiply distance by hash of that point
}
```

**Characteristics**:
- ✅ Unique cellular appearance
- ✅ Great for stone, water, cells
- ✅ Highly controllable
- ⚠️ Expensive (9-27 samples per pixel)
- ⚠️ Sharp features (not smooth like Perlin)

**Visual Appearance**:
```
Worley F1:           Worley F2-F1 (cells):
░░░░░░░░░░░░        ████░░░░████
░░░▒▒▒░░░░░░        ██░░░░░░░░██
░░▒████▒░░░░        █░░░░░░░░░░█
░░▒████▒░░░░        ░░░░░░░░░░░░
░░░▒▒▒░░░░░░        ██░░░░░░░░██
░░░░░░░░░░░░        ████░░░░████

Notice: Organic cell/bubble patterns
```

### Type 5: White Noise (True Random)

**Concept**: Completely uncorrelated random values.

**Implementation**:
```glsl
float whiteNoise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
```

**Characteristics**:
- ✅ Fastest possible (~3 instructions)
- ✅ Maximum variation
- ⚠️ No coherence (looks like TV static)
- ⚠️ Harsh, unnatural

**Use Cases**:
- Film grain effect
- Dithering
- Breaking up banding
- High-frequency detail layer

**Visual Appearance**:
```
White noise:
▓░█▒▓░▒█░▓▒░
█▒░▓█░▒▓░█▒▓
░▓█▒░▓█░▒▓░█
▒░▓█▒░▓█░▒▓░

Notice: No patterns, pure chaos
```

### Type 6: Turbulence (Absolute Noise)

**Concept**: Absolute value of noise. Creates billowy patterns.

**Implementation**:
```glsl
float turbulence(vec3 p) {
    return abs(noise(p) * 2.0 - 1.0);
    // noise() returns 0-1
    // × 2.0 - 1.0 → -1 to 1
    // abs() → 0 to 1 (always positive)
}
```

**Multi-octave Turbulence**:
```glsl
float turbulence(vec3 p, int octaves) {
    float sum = 0.0;
    float freq = 1.0;
    float amp = 1.0;

    for (int i = 0; i < octaves; i++) {
        sum += abs(noise(p * freq)) * amp;
        freq *= 2.0;
        amp *= 0.5;
    }

    return sum;
}
```

**Characteristics**:
- ✅ Billowy, cloud-like appearance
- ✅ Sharp ridges (where noise crosses zero)
- ✅ Great for clouds, smoke, marble
- ⚠️ Can look harsh without smoothing

**Visual Comparison**:
```
Regular noise:       Turbulence:
░░▒▒████▒▒░░        ██████████████
░▒▒█████▒▒░░        ████▓▓▓▓██████
▒▒████████▒░        ██▓▓▒▒▒▒▓▓████
████████▒▒░░        ▓▓▒▒░░░░▒▒▓▓██

Notice: Turbulence has sharp ridges, all positive
```

---

## Audio-Reactive Noise

### Strategy 1: Scale Modulation

**Concept**: Audio controls spatial frequency.

**Implementation**:
```glsl
// In JavaScript
gl.uniform1f(noiseScaleLocation, 10.0 + bass * 20.0);

// In shader
float n = noise(vec3(uv * u_noiseScale, u_time));
```

**Effect**:
```
Bass low (0.0):  scale = 10.0  → Large features
░░░░░░░░░░░░░░░░
░░░░████████░░░░
░░██████████████
░██████████████░

Bass high (1.0): scale = 30.0  → Small features
▓▒░▓█▒░▓█▒░▓█▒░
█▒▓░█▒▓░█▒▓░█▒▓
▒░▓█▒░▓█▒░▓█▒░▓
```

### Strategy 2: Speed Modulation

**Concept**: Audio controls animation speed.

**Implementation**:
```glsl
// In JavaScript
const noiseSpeed = 0.5 + high * 1.5; // 0.5-2.0
gl.uniform1f(noiseSpeedLocation, noiseSpeed);

// In shader
float n = noise(vec3(uv * 10.0, u_time * u_noiseSpeed));
```

**Effect**:
- High frequencies low → Slow, glacial movement
- High frequencies high → Fast, frenetic movement

### Strategy 3: Amplitude Modulation

**Concept**: Audio controls noise intensity.

**Implementation**:
```glsl
float n = noise(vec3(uv * 10.0, u_time));

// Modulate amplitude
float amplitude = 0.5 + u_mid * 0.5; // 0.5-1.0
n *= amplitude;

// Or threshold
if (u_bass > 0.7) {
    n = pow(n, 0.5); // Brighten on bass hits
} else {
    n = pow(n, 2.0); // Darken on quiet sections
}
```

### Strategy 4: Octave Modulation

**Concept**: Audio controls fractal detail (see FBM section).

**Implementation**:
```glsl
// Vary octave count based on audio
int octaves = int(3.0 + u_high * 3.0); // 3-6 octaves
float n = fbm(uv, octaves);
```

**Effect**:
- Low highs → Smooth (few octaves)
- High highs → Detailed (many octaves)

### Strategy 5: Domain Offset

**Concept**: Audio shifts noise sampling position.

**Implementation**:
```glsl
// Offset based on bass
vec3 offset = vec3(u_bass * 5.0, 0.0, 0.0);
float n = noise(vec3(uv * 10.0, u_time) + offset);
```

**Effect**: Noise "jumps" to different pattern on bass hits

### Strategy 6: Multi-Band Noise

**Concept**: Different frequency bands control different noise layers.

**Implementation**:
```glsl
// Bass: Large-scale noise
float bassNoise = noise(vec3(uv * 5.0, u_time * 0.2)) * u_bass;

// Mid: Medium-scale noise
float midNoise = noise(vec3(uv * 15.0, u_time * 0.5)) * u_mid;

// High: Fine-scale noise
float highNoise = noise(vec3(uv * 30.0, u_time * 1.0)) * u_high;

// Combine
float n = bassNoise * 0.5 + midNoise * 0.3 + highNoise * 0.2;
```

**Effect**: Rich, layered noise that responds to full spectrum

---

## Noise Applications

### Application 1: UV Distortion

**Current usage in your shader** (line 296):
```glsl
float n = noise(vec3(uv * 10.0, u_time * 0.5));
// Used for subtle variation, not distortion yet
```

**Enhanced UV distortion**:
```glsl
// Generate 2 noise values for x and y displacement
float noiseX = noise(vec3(uv * 10.0, u_time * 0.5)) * 2.0 - 1.0; // -1 to 1
float noiseY = noise(vec3(uv * 10.0 + 100.0, u_time * 0.5)) * 2.0 - 1.0;

// Apply to UV
vec2 distortedUV = uv + vec2(noiseX, noiseY) * 0.05; // 5% displacement

// Sample texture with distorted coordinates
vec4 color = texture2D(u_texture, distortedUV);
```

**Effect**: Organic warping of image

### Application 2: Procedural Textures

**Clouds**:
```glsl
float clouds(vec2 uv) {
    float n = 0.0;
    n += noise(vec3(uv * 4.0, u_time * 0.1)) * 0.5;
    n += noise(vec3(uv * 8.0, u_time * 0.15)) * 0.25;
    n += noise(vec3(uv * 16.0, u_time * 0.2)) * 0.125;

    // Make billowy
    n = smoothstep(0.3, 0.7, n);

    return n;
}

// Use
vec3 skyColor = vec3(0.5, 0.7, 1.0); // Blue
vec3 cloudColor = vec3(1.0, 1.0, 1.0); // White
vec3 color = mix(skyColor, cloudColor, clouds(uv));
```

**Wood grain**:
```glsl
float woodGrain(vec2 uv) {
    // Add noise to radial distance
    float dist = length(uv - vec2(0.5)) * 20.0;
    float n = noise(vec3(uv * 5.0, 0.0)) * 2.0;

    // Create rings
    float rings = fract(dist + n);

    // Sharp rings
    rings = smoothstep(0.4, 0.6, rings);

    return rings;
}
```

**Marble**:
```glsl
float marble(vec2 uv) {
    // Turbulence-based warping
    float warp = turbulence(vec3(uv * 5.0, 0.0), 4);

    // Sine waves + warp
    float pattern = sin((uv.x + warp * 2.0) * 10.0) * 0.5 + 0.5;

    return pattern;
}
```

### Application 3: Animated Displacement

**Flowing distortion**:
```glsl
// Create flow field from noise
vec2 flowField(vec2 uv, float time) {
    float angle = noise(vec3(uv * 5.0, time * 0.1)) * 6.28318530718;
    return vec2(cos(angle), sin(angle));
}

// Apply to UV
vec2 flow = flowField(uv, u_time);
vec2 distortedUV = uv + flow * 0.03 * u_bass;
```

**Breathing effect**:
```glsl
// Noise-based scale variation
float breathe = noise(vec3(uv * 0.5, u_time * 0.2)) * 0.1 - 0.05;
vec2 center = vec2(0.5);
vec2 fromCenter = uv - center;
vec2 breathedUV = center + fromCenter * (1.0 + breathe);
```

### Application 4: Particle/Sprite Variation

**Random offsets**:
```glsl
// In vertex shader (for particles)
float offsetX = noise(vec3(particleID * 0.1, u_time * 0.5, 0.0)) - 0.5;
float offsetY = noise(vec3(particleID * 0.1, u_time * 0.5, 100.0)) - 0.5;

gl_Position.xy += vec2(offsetX, offsetY) * 0.1;
```

**Size variation**:
```glsl
float sizeVar = noise(vec3(particleID * 0.1, 0.0, 0.0));
gl_PointSize = baseSize * (0.5 + sizeVar);
```

### Application 5: Edge Variation

**Irregular edges**:
```glsl
// Instead of sharp circle
float circle = step(0.5, length(uv - vec2(0.5)));

// Organic circle
float dist = length(uv - vec2(0.5));
float edgeNoise = noise(vec3(uv * 20.0, u_time)) * 0.05;
float organicCircle = step(0.5 + edgeNoise, dist);
```

### Application 6: Color Variation

**Subtle color noise**:
```glsl
vec3 baseColor = vec3(1.0, 0.5, 0.2); // Orange

// Add subtle variation
float colorNoise = noise(vec3(uv * 50.0, u_time * 0.1)) * 0.1 - 0.05;
vec3 variedColor = baseColor + vec3(colorNoise);
```

**Hue shifting**:
```glsl
vec3 hsv = rgb2hsv(baseColor);

// Noise-based hue variation
float hueNoise = noise(vec3(uv * 10.0, u_time)) * 0.1 - 0.05;
hsv.x += hueNoise;
hsv.x = fract(hsv.x);

vec3 variedColor = hsv2rgb(hsv);
```

---

## Fractal Noise (FBM)

### What is FBM?

**FBM = Fractal Brownian Motion**

Concept: Sum multiple "octaves" of noise at different frequencies/amplitudes.

**Formula**:
```
FBM(p) = Σ(i=0 to octaves-1) [ noise(p × frequency^i) × amplitude^i ]

Where:
  frequency = lacunarity (typically 2.0)
  amplitude = persistence (typically 0.5)
```

**Visual Intuition**:
```
Octave 0:                Result (sum of all):
░░░░████████░░░░         ░▒▓▓████████▓▓▒░
░░████████████░░         ▒▓███████████▓▒░
████████████████         ▓██████████████▓
                  +      ███████████████▓

Octave 1:                Notice:
▒▒░▒▒██▒▒░▒▒            - Large features (octave 0)
▒░▒██████▒░▒            - Medium features (octave 1)
░▒████████▒░            - Small features (octave 2)
                  +     = Natural, detailed appearance
Octave 2:
░▓░▓░█░▓░█░▓░
▓░█░▓░█░▓░█▓
░█░▓░█░▓░█░▓
```

### Basic FBM Implementation

```glsl
float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < octaves; i++) {
        value += noise(p * frequency) * amplitude;
        frequency *= 2.0;  // Lacunarity (double frequency)
        amplitude *= 0.5;  // Persistence (half amplitude)
    }

    return value;
}

// Usage
float n = fbm(vec3(uv, u_time), 4); // 4 octaves
```

### Customizable FBM

```glsl
float fbm(vec3 p, int octaves, float lacunarity, float persistence) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    float maxValue = 0.0; // For normalization

    for (int i = 0; i < octaves; i++) {
        value += noise(p * frequency) * amplitude;
        maxValue += amplitude;

        frequency *= lacunarity;
        amplitude *= persistence;
    }

    // Normalize to 0-1
    return value / maxValue;
}

// Usage
float n = fbm(vec3(uv, u_time), 5, 2.0, 0.5);
//                                │   │    └─ Persistence (amplitude decay)
//                                │   └─ Lacunarity (frequency growth)
//                                └─ Octaves
```

### Parameter Effects

**Octaves** (detail level):
```glsl
1 octave:  ░░░░████████░░░░  (smooth, boring)
2 octaves: ░░▒▒████████▒▒░░  (some detail)
3 octaves: ░▒▓▓████████▓▓▒░  (good detail)
4 octaves: ▒▓▓████████▓▓▒▒░  (high detail)
8 octaves: ▒▓███████████▓▒░  (extreme detail, slow)
```

**Lacunarity** (frequency growth):
```glsl
Lacunarity 1.5:  ▒▒▓▓████▓▓▒▒  (gradual frequency change)
Lacunarity 2.0:  ▒▓▓████▓▓▒░  (natural, default)
Lacunarity 3.0:  ▒█▓███▓█▒░░  (sharp contrast between octaves)
```

**Persistence** (amplitude decay):
```glsl
Persistence 0.3:  ░░░░████░░░░  (dominated by low frequencies)
Persistence 0.5:  ░░▒▒████▒▒░░  (balanced, default)
Persistence 0.7:  ░▒▓▓████▓▓▒░  (more high-frequency detail)
```

### Specialized FBM Variants

**Ridged FBM** (sharp features):
```glsl
float ridgedFBM(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < octaves; i++) {
        float n = noise(p * frequency);
        n = 1.0 - abs(n * 2.0 - 1.0); // Ridge: abs → invert
        value += n * amplitude;

        frequency *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}
```

**Turbulent FBM** (billowy):
```glsl
float turbulentFBM(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < octaves; i++) {
        float n = noise(p * frequency);
        value += abs(n * 2.0 - 1.0) * amplitude; // Turbulence

        frequency *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}
```

**Domain-Rotated FBM** (less directional):
```glsl
float rotatedFBM(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < octaves; i++) {
        value += noise(p * frequency) * amplitude;

        // Rotate domain between octaves
        p = mat3(
            0.0, 1.6, 1.2,
            -1.6, 0.72, -0.96,
            -1.2, -0.96, 1.28
        ) * p;

        frequency *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}
```

### Audio-Reactive FBM

```glsl
// Vary octave count
int octaves = int(3.0 + u_high * 4.0); // 3-7 based on high frequencies
float n = fbm(vec3(uv, u_time), octaves);

// Vary lacunarity
float lacunarity = 2.0 + u_mid * 1.0; // 2.0-3.0
float n = fbm(vec3(uv, u_time), 4, lacunarity, 0.5);

// Vary persistence
float persistence = 0.3 + u_bass * 0.4; // 0.3-0.7
float n = fbm(vec3(uv, u_time), 4, 2.0, persistence);
```

---

## Domain Warping

### What is Domain Warping?

**Concept**: Use noise to distort the input coordinates of noise.

**Basic Example**:
```glsl
// Regular noise
float n = noise(vec3(uv, u_time));

// Domain-warped noise
vec2 warp = vec2(
    noise(vec3(uv * 2.0, u_time)),
    noise(vec3(uv * 2.0 + 100.0, u_time))
);
float n = noise(vec3(uv + warp * 0.5, u_time));
//                      ^^^^^^^^^^^^
//                      Coordinates warped by noise!
```

**Visual Comparison**:
```
Regular noise:       Domain-warped:
░░▒▒████▒▒░░        ░░░▒▒▓███▓▒░░
░▒▒█████▒▒░░        ░▒▓▓████████▒
▒▒██████████        ▒▓██████████▓
████████████        ▓███████████▓

Notice: Warped version has more organic, swirly features
```

### Single-Level Domain Warp

```glsl
vec2 domainWarp(vec2 p, float amount) {
    return vec2(
        p.x + noise(vec3(p * 3.0, u_time)) * amount,
        p.y + noise(vec3(p * 3.0 + 100.0, u_time)) * amount
    );
}

// Usage
vec2 warpedUV = domainWarp(uv, 0.3);
float n = noise(vec3(warpedUV * 10.0, u_time));
```

### Multi-Level Domain Warp (Cascade)

```glsl
float cascadeWarp(vec2 p) {
    // First warp
    vec2 q = vec2(
        noise(vec3(p, 0.0)),
        noise(vec3(p + 10.0, 0.0))
    );

    // Second warp using first
    vec2 r = vec2(
        noise(vec3(p + q * 4.0, 0.0)),
        noise(vec3(p + q * 4.0 + 10.0, 0.0))
    );

    // Final noise using second warp
    return noise(vec3(p + r * 4.0, u_time));
}
```

**Effect**: Extremely organic, natural-looking patterns

**Visual Result**:
```
No warp:            1 level:             2 levels (cascade):
░░▒▒████▒▒░░       ░░▒▒▓███▓▒░░        ░▒░▓▒██▓███▒▓░
░▒▒█████▒▒░░       ░▒▓████████▒        ░▒▓▒███████▓▒▓
▒▒██████████       ▒▓██████████        ▒▓▒████████▓▓▒
████████████       ▓███████████        ▓▒▓███████▓▓▒░

Each level adds more organic character
```

### FBM Domain Warp

```glsl
float fbmDomainWarp(vec2 p) {
    // Use FBM for warp
    vec2 q = vec2(
        fbm(vec3(p, 0.0), 4),
        fbm(vec3(p + 10.0, 0.0), 4)
    );

    // Final FBM with warped coords
    return fbm(vec3(p + q * 2.0, u_time), 4);
}
```

### Audio-Reactive Domain Warp

```glsl
// Warp amount controlled by bass
float warpAmount = 0.3 + u_bass * 0.5; // 0.3-0.8

vec2 warp = vec2(
    noise(vec3(uv * 3.0, u_time)),
    noise(vec3(uv * 3.0 + 100.0, u_time))
) * 2.0 - 1.0; // -1 to 1

vec2 warpedUV = uv + warp * warpAmount;
float n = noise(vec3(warpedUV * 10.0, u_time));
```

### Directional Warp

```glsl
// Warp only in specific direction
float warpX = noise(vec3(uv * 5.0, u_time)) * 0.3;
vec2 warpedUV = uv + vec2(warpX, 0.0); // Only horizontal warp
float n = noise(vec3(warpedUV * 10.0, u_time));

// Radial warp (from center)
vec2 center = vec2(0.5);
vec2 toCenter = normalize(uv - center);
float warpDist = noise(vec3(uv * 5.0, u_time)) * 0.3;
vec2 warpedUV = uv + toCenter * warpDist;
```

---

## Performance Optimization

### Optimization 1: Reduce Octaves

**Cost per octave**:
```
1 octave:  ~15 instructions
2 octaves: ~30 instructions
4 octaves: ~60 instructions
8 octaves: ~120 instructions
```

**Strategy**: Use fewer octaves, increase base frequency
```glsl
// ❌ Expensive: 8 octaves at small scale
float n = fbm(vec3(uv * 5.0, u_time), 8);

// ✅ Cheaper: 4 octaves at larger scale
float n = fbm(vec3(uv * 10.0, u_time), 4);
// Similar detail, half the cost
```

### Optimization 2: Simplified Hash

**Your current hash**:
```glsl
fract(sin(n) * 43758.5453)  // ~4 instructions
```

**Faster alternatives**:
```glsl
// Fast (lower quality)
fract(n * 0.1031)  // ~1 instruction

// Medium (good quality/speed balance)
fract(sin(n) * 1e4)  // ~3 instructions

// Your current (good quality)
fract(sin(n) * 43758.5453)  // ~4 instructions
```

**Impact**:
```
1000 noise calls per frame:
  Fast hash:    +3ms
  Medium hash:  +4ms
  Current hash: +5ms

Savings: 2ms per frame (12% at 60fps)
```

### Optimization 3: 2D Instead of 3D

**Cost comparison**:
```
2D noise: ~10 instructions (4 corners)
3D noise: ~15 instructions (8 corners)
4D noise: ~30 instructions (16 corners)
```

**When to use 2D**:
```glsl
// ✅ Static textures (no animation)
float n = noise2D(uv * 10.0);

// ✅ Slow animation (change coordinates manually)
float time = u_time * 0.1;
float n = noise2D(uv * 10.0 + vec2(time, 0.0));

// ❌ Smooth temporal animation
// 2D will "slide" instead of "evolve"
```

### Optimization 4: Texture-Based Noise

**Concept**: Pre-generate noise as texture, sample instead of calculate.

**Setup** (JavaScript):
```javascript
// Generate 256×256 noise texture once
const noiseData = new Uint8Array(256 * 256);
for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
        const n = perlinNoise(x / 10, y / 10); // Use JS noise library
        noiseData[y * 256 + x] = Math.floor(n * 255);
    }
}

// Upload to GPU
const noiseTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 256, 256, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, noiseData);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
```

**Usage** (shader):
```glsl
uniform sampler2D u_noiseTexture;

float noise(vec2 p) {
    return texture2D(u_noiseTexture, p / 256.0).r;
}

// Much faster than procedural!
// But uses 64KB GPU memory
```

**Performance**:
```
Procedural 3D noise: ~15 instructions
Texture lookup:      ~1 instruction

15× faster!
```

**Trade-offs**:
- ✅ Much faster
- ✅ Can be very high quality (pre-computed)
- ⚠️ Uses GPU memory (64-256KB)
- ⚠️ Limited to 2D (can use 3D texture but expensive)
- ⚠️ Will tile/repeat

### Optimization 5: LOD (Level of Detail)

**Concept**: Use simpler noise far from focus point.

```glsl
// Distance from center
float dist = length(uv - vec2(0.5));

// Vary octaves based on distance
int octaves = dist < 0.3 ? 6 : 3;  // 6 near center, 3 at edges
float n = fbm(vec3(uv, u_time), octaves);
```

### Optimization 6: Conditional Evaluation

**Concept**: Skip noise in areas that won't show it.

```glsl
// Only calculate noise for visible areas
vec4 color;

if (alpha > 0.01) {
    float n = fbm(vec3(uv, u_time), 4);
    color = vec4(n);
} else {
    color = vec4(0.0);  // Skip expensive noise
}
```

---

## Debugging Noise

### Debug Technique 1: Visualize Raw Output

```glsl
// Instead of using noise in complex way
// Just output it directly

float n = noise(vec3(uv * 10.0, u_time));
gl_FragColor = vec4(vec3(n), 1.0);
// Should see smooth gray pattern
```

**What to look for**:
- ✅ Smooth gradients (no sharp edges)
- ✅ No obvious grid pattern
- ✅ Values from black (0) to white (1)
- ❌ Visible grid lines → Bad interpolation
- ❌ Banding → Need smoothstep
- ❌ All same color → Hash function broken

### Debug Technique 2: Freeze Time

```glsl
// Add uniform to pause time
uniform float u_debugTime;

// Use instead of u_time
float n = noise(vec3(uv * 10.0, u_debugTime));

// In JavaScript
const debugTime = 5.0; // Fixed value
gl.uniform1f(debugTimeLocation, debugTime);
```

**Purpose**: Inspect static pattern without animation

### Debug Technique 3: Grid Overlay

```glsl
float n = noise(vec3(uv * 10.0, u_time));

// Draw grid lines at integer coordinates
vec3 p = vec3(uv * 10.0, u_time);
vec3 grid = step(0.98, fract(p));
float gridLines = max(max(grid.x, grid.y), grid.z);

// Combine
gl_FragColor = vec4(vec3(n) + gridLines * 0.5, 1.0);
// Noise + white grid lines
```

**Purpose**: Verify grid alignment and interpolation

### Debug Technique 4: Octave Separation

```glsl
// Show individual octaves
int debugOctave = 2; // Control via uniform

float n = noise(vec3(uv * pow(2.0, float(debugOctave)), u_time));
gl_FragColor = vec4(vec3(n), 1.0);

// Cycle through octaves to see each layer
```

### Debug Technique 5: Parameter Scrubbing

```javascript
// Add keyboard controls
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') noiseScale += 1.0;
    if (e.key === 'ArrowDown') noiseScale -= 1.0;
    if (e.key === 'ArrowRight') noiseSpeed += 0.1;
    if (e.key === 'ArrowLeft') noiseSpeed -= 0.1;

    console.log(`Scale: ${noiseScale}, Speed: ${noiseSpeed}`);
});

gl.uniform1f(noiseScaleLocation, noiseScale);
gl.uniform1f(noiseSpeedLocation, noiseSpeed);
```

**Purpose**: Find optimal parameters interactively

---

## Common Mistakes

### Mistake 1: Forgetting to Normalize Range

**Problem**:
```glsl
// ❌ Noise returns 0-1, but you expect -1 to 1
float n = noise(vec3(uv, u_time));
uv += vec2(n); // Always offsets positive! (0 to 1)
```

**Solution**:
```glsl
// ✅ Remap to -1 to 1
float n = noise(vec3(uv, u_time)) * 2.0 - 1.0;
uv += vec2(n) * 0.1; // Now offsets ±0.1
```

### Mistake 2: Not Using Smoothstep

**Problem**:
```glsl
// ❌ Linear interpolation shows grid
vec3 f = fract(p);
// Interpolate without smoothstep
```

**Solution**:
```glsl
// ✅ Apply smoothstep
vec3 f = fract(p);
f = f * f * (3.0 - 2.0 * f);
// Now interpolation is smooth
```

### Mistake 3: Too Large Coordinates

**Problem**:
```glsl
// ❌ Huge coordinates lose precision
float n = noise(vec3(uv * 10000.0, u_time * 1000.0));
// Floating-point precision issues!
```

**Solution**:
```glsl
// ✅ Use fract to keep coordinates small
vec3 p = vec3(uv * 10000.0, u_time * 1000.0);
p = fract(p);  // Wrap to 0-1
float n = noise(p);
```

### Mistake 4: Inconsistent Hash

**Problem**:
```glsl
// ❌ Different hash for each dimension
float a = fract(sin(i.x) * 1234.5);
float b = fract(sin(i.y) * 5678.9);  // Different multipliers!
// Creates artifacts
```

**Solution**:
```glsl
// ✅ Consistent hash function
float hash(float n) {
    return fract(sin(n) * 43758.5453);
}
float a = hash(i.x);
float b = hash(i.y);
```

### Mistake 5: Not Scaling Time

**Problem**:
```glsl
// ❌ u_time grows infinitely
// After hours: u_time = 36000.0 (precision loss!)
float n = noise(vec3(uv, u_time));
```

**Solution**:
```glsl
// ✅ Scale time to reasonable range
float t = u_time * 0.1; // Slow down
float n = noise(vec3(uv, mod(t, 100.0))); // Wrap every 100 units

// Or modulo in JavaScript
const time = (Date.now() / 1000) % 3600; // Wrap every hour
```

### Mistake 6: Too Many Octaves

**Problem**:
```glsl
// ❌ 10 octaves for background texture
float n = fbm(vec3(uv, u_time), 10);
// 150 instructions! 60→30 fps
```

**Solution**:
```glsl
// ✅ Use 3-5 octaves
float n = fbm(vec3(uv, u_time), 4);
// 60 instructions, still detailed
```

---

## Copy-Paste Noise Library

### Library 1: 2D Value Noise (Fast)

```glsl
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1, 0));
    float c = hash(i + vec2(0, 1));
    float d = hash(i + vec2(1, 1));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
```

### Library 2: 3D Value Noise (Your Current, Optimized)

```glsl
float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n = i.x + i.y * 57.0 + 113.0 * i.z;

    vec4 a = fract(sin(vec4(n, n+1.0, n+57.0, n+58.0)) * 43758.5453);
    vec4 b = fract(sin(vec4(n+113.0, n+114.0, n+170.0, n+171.0)) * 43758.5453);

    vec2 c = mix(a.xz, a.yw, f.x);
    vec2 d = mix(b.xz, b.yw, f.x);
    vec2 e = mix(c, d, f.y);

    return mix(e.x, e.y, f.z);
}
```

### Library 3: FBM (4 Octaves)

```glsl
float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 4; i++) {
        value += noise3D(p) * amplitude;
        p *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}
```

### Library 4: Turbulence

```glsl
float turbulence(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < octaves; i++) {
        value += abs(noise3D(p) * 2.0 - 1.0) * amplitude;
        p *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}
```

### Library 5: Domain Warp

```glsl
float domainWarp(vec2 p) {
    vec2 q = vec2(
        noise3D(vec3(p, 0.0)),
        noise3D(vec3(p + 10.0, 0.0))
    );

    return noise3D(vec3(p + q * 4.0, 0.0));
}
```

### Library 6: Worley/Cellular 2D

```glsl
vec2 randomVec2(vec2 p) {
    float n = dot(p, vec2(127.1, 311.7));
    return fract(sin(vec2(n, n + 1.0)) * 43758.5453);
}

float worley(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float minDist = 1.0;

    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = randomVec2(i + neighbor);
            float dist = length(neighbor + point - f);
            minDist = min(minDist, dist);
        }
    }

    return minDist;
}
```

### Library 7: Simplex 2D

```glsl
float simplex2D(vec2 p) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;

    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    vec2 o = (a.x > a.y) ? vec2(1, 0) : vec2(0, 1);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;

    vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);

    vec3 n = h * h * h * h * vec3(
        dot(a, hash(i) * 2.0 - 1.0),
        dot(b, hash(i + o) * 2.0 - 1.0),
        dot(c, hash(i + 1.0) * 2.0 - 1.0)
    );

    return dot(n, vec3(70.0));
}
```

---

## Progression Path

### Beginner (1-2 hours)

**Goal**: Understand current noise and add audio-reactivity.

**Checklist**:
- [ ] Read "Your Current Implementation" section
- [ ] Understand 3D noise (x, y, time)
- [ ] Visualize raw noise output (debug technique 1)
- [ ] Add audio-reactive scale (Quick Start)
- [ ] Add audio-reactive speed
- [ ] Test with different music

**Expected Result**: Noise that dances with music, basic understanding.

### Intermediate (3-5 hours)

**Goal**: Try different noise types and implement FBM.

**Checklist**:
- [ ] Read "Noise Types Deep Dive" section
- [ ] Implement 2D Perlin noise
- [ ] Compare value vs gradient noise
- [ ] Implement basic FBM (4 octaves)
- [ ] Experiment with octaves/lacunarity/persistence
- [ ] Try turbulence variant
- [ ] Use noise for UV distortion

**Expected Result**: Multiple noise types, fractal detail, applied to visuals.

### Advanced (6-10 hours)

**Goal**: Domain warping and custom noise applications.

**Checklist**:
- [ ] Read "Domain Warping" section
- [ ] Implement single-level domain warp
- [ ] Implement cascade warp (2+ levels)
- [ ] Try FBM domain warp
- [ ] Create procedural texture (clouds/marble)
- [ ] Implement Worley noise
- [ ] Audio-reactive domain warp
- [ ] Optimize performance (reduce octaves, LOD)

**Expected Result**: Highly organic visuals, custom textures, optimized performance.

### Expert (10+ hours)

**Goal**: Custom noise variants and production techniques.

**Checklist**:
- [ ] Read "Performance Optimization" section
- [ ] Implement texture-based noise
- [ ] Create custom FBM variants (ridged, turbulent)
- [ ] Implement 4D noise for seamless loops
- [ ] Build comprehensive noise library
- [ ] Profile and optimize all noise calls
- [ ] Create debug visualization tools
- [ ] Document optimal parameters for different use cases

**Expected Result**: Production-ready noise system, maximum quality and performance.

---

## References

### Classic Papers
- **Perlin, Ken** - "An Image Synthesizer" (SIGGRAPH 1985)
- **Perlin, Ken** - "Improving Noise" (SIGGRAPH 2002) - Simplex noise
- **Worley, Steven** - "A Cellular Texture Basis Function" (SIGGRAPH 1996)

### Books
- **Ebert et al.** - "Texturing & Modeling: A Procedural Approach"
- **Lagae et al.** - "Procedural Noise using Sparse Convolution"
- **GPU Gems** - Chapters on noise and procedural generation

### Online Resources
- **The Book of Shaders** - Noise chapter (excellent visualizations)
- **Inigo Quilez** - Articles on noise (iquilezles.org)
- **Shadertoy** - Search "noise" for thousands of examples
- **WebGL Noise** - GitHub libraries (ashima, stegu)

### Implementation Examples
- **Ashima WebGL Noise** - Production-quality GLSL noise
- **GLM Noise** - C++ reference implementations
- **FastNoise** - Optimized noise library

---

## Next Steps

Now that you understand procedural noise:

1. **Try the Quick Start** - Add audio-reactive noise immediately
2. **Experiment with Types** - Compare value, Perlin, Worley
3. **Add Fractals** - Implement FBM for detail
4. **Domain Warp** - Create ultra-organic patterns
5. **Optimize** - Profile and reduce octaves if needed

**Related Guides**:
- **Advanced Distortion Mathematics** - For noise-based UV distortion
- **Audio-Reactive Design Patterns** - For mapping audio to noise parameters
- **Shader Optimization Techniques** - For optimizing noise functions
- **Effect Composition & Layering** - For combining noise with other effects

---

**Remember**: Noise is controlled chaos. The key to mastery is understanding that noise itself is simple - the magic comes from how you use it, combine it, and warp it!

# WebGL Shader Documentation - Audio Visualizer

## Overview

This document provides comprehensive documentation of the WebGL shader implementation used in `AudioVisualizerWebGL.svelte`. The shader creates an audio-reactive visualization with multiple layered effects including distortion, color manipulation, trails, edge detection, and noise.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Vertex Shader](#vertex-shader)
3. [Fragment Shader](#fragment-shader)
4. [Uniform Parameters](#uniform-parameters)
5. [Distortion Effects](#distortion-effects)
6. [Color System](#color-system)
7. [Trail Effect System](#trail-effect-system)
8. [Edge Detection & Glow](#edge-detection--glow)
9. [3D Noise Effect](#3d-noise-effect)
10. [Audio-Reactive Mapping](#audio-reactive-mapping)
11. [Render Pipeline](#render-pipeline)

---

## Architecture Overview

### High-Level Flow

```
Audio Input
    ↓
FFT Analysis → [Bass, Mid, High] Frequency Bands
    ↓
Uniform Updates → WebGL Shader
    ↓
Rendering Pipeline:
    1. Vertex Shader (positioning)
    2. Fragment Shader (per-pixel effects)
        a. Distortion
        b. Rotation & Scale
        c. Texture Sampling
        d. Edge Detection
        e. Color Manipulation
        f. Trail Effects
        g. 3D Noise
        h. Color Inversion
    ↓
Ping-Pong Framebuffers (trail persistence)
    ↓
Screen Output
```

### Key Technologies

- **WebGL 1.0**: Graphics API
- **GLSL ES 1.0**: Shader language (OpenGL ES Shading Language)
- **Ping-Pong Rendering**: Dual framebuffers for trail effects
- **Audio Context API**: Real-time frequency analysis

---

## Vertex Shader

**Location**: Lines 115-123

### Purpose
Transform vertex positions from clip space and pass texture coordinates to the fragment shader.

### Code
```glsl
attribute vec2 a_position;  // Vertex position in clip space [-1, 1]
attribute vec2 a_texCoord;  // Texture coordinate [0, 1]
varying vec2 v_texCoord;    // Pass to fragment shader

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
```

### Geometry
The shader renders a full-screen quad using two triangles:

```javascript
// Positions: NDC (Normalized Device Coordinates)
[-1, -1,  1, -1, -1,  1,    // Triangle 1
 -1,  1,  1, -1,  1,  1]    // Triangle 2

// Texture Coordinates
[0, 1,  1, 1,  0, 0,    // Triangle 1
 0, 0,  1, 1,  1, 0]    // Triangle 2
```

**Visual Contribution**: Creates the canvas for all fragment shader effects.

---

## Fragment Shader

**Location**: Lines 126-336

The fragment shader is where ALL visual effects are computed per-pixel.

---

## Uniform Parameters

**Location**: Lines 128-141

### Input Uniforms

| Uniform | Type | Purpose | Audio-Reactive? |
|---------|------|---------|----------------|
| `u_texture` | sampler2D | Raptor SVG texture | No |
| `u_trailTexture` | sampler2D | Previous frame trails | No (feedback) |
| `u_scale` | float | Zoom level (0.15-0.95) | Yes (bass) |
| `u_rotation` | float | Rotation angle (radians) | Yes (high freq) |
| `u_distortionAmount` | float | Distortion intensity (0-0.6) | Yes (mid freq) |
| `u_time` | float | Animation time accumulator | Yes (speed) |
| `u_distortionType` | int | Which distortion effect (0-4) | No (random) |
| `u_bgColor` | vec3 | Background color RGB | No |
| `u_trailColor` | vec3 | Base trail color RGB | No |
| `u_hueShift` | float | Hue rotation (0-240 degrees) | Yes (high freq) |
| `u_bassIntensity` | float | Bass level (0-1) | Yes (smoothed mid) |
| `u_glowIntensity` | float | Glow brightness (0-1) | Yes (bass) |
| `u_trailDecay` | float | Trail fade rate (0.92) | No |
| `u_invertColors` | bool | Color inversion toggle | Yes (bass trigger) |

### Varying Input

| Varying | Type | Source | Purpose |
|---------|------|--------|---------|
| `v_texCoord` | vec2 | Vertex shader | Current pixel's texture coordinate |

---

## Distortion Effects

**Location**: Lines 191-247

### Overview
Five distinct distortion algorithms that warp the UV coordinates before texture sampling.

---

### Type 0: Horizontal Sine Wave

**Code**: Lines 192-193
```glsl
uv.x += sin(uv.y * 20.0 + u_time) * u_distortionAmount * 0.05;
```

**Visual Effect**:
- Horizontal ripples across the image
- 20 waves vertically (frequency)
- Animated by `u_time`
- Maximum displacement: ±5% of width

**Best for**: Smooth, liquid-like warping

---

### Type 1: Vertical Sine Wave

**Code**: Lines 195-196
```glsl
uv.y += sin(uv.x * 20.0 + u_time) * u_distortionAmount * 0.05;
```

**Visual Effect**:
- Vertical ripples across the image
- 20 waves horizontally
- Creates a "heat wave" effect

**Best for**: Upward/downward flowing motion

---

### Type 2: Circular Ripple

**Code**: Lines 198-200
```glsl
float dist = distance(uv, center);
uv.x += sin(dist * 20.0 + u_time) * u_distortionAmount * 0.05;
```

**Visual Effect**:
- Concentric circles emanating from center
- Distance-based wave frequency
- Only distorts X-axis (creates asymmetric ripples)

**Best for**: Radial pulsing, "sonar" effect

---

### Type 3: Diagonal Waves

**Code**: Lines 202-203
```glsl
uv.x += sin(uv.y * 15.0 + u_time) * u_distortionAmount * 0.05 * cos(u_time * 0.5);
```

**Visual Effect**:
- Horizontal waves with modulated amplitude
- Amplitude oscillates slowly (cos(u_time * 0.5))
- Creates a "breathing" wave pattern

**Best for**: Subtle, organic movement

---

### Type 4: Enhanced Glitch

**Code**: Lines 205-246

**Complex Multi-Layer Effect**:

#### Layer 1: Block Displacements
```glsl
float block1 = step(0.6, sin(uv.y * 15.0 + glitchSeed * 13.7));
float block2 = step(0.7, sin(uv.y * 28.0 + glitchSeed * 7.3));
float block3 = step(0.75, sin(uv.y * 45.0 + glitchSeed * 23.1));
float block4 = step(0.8, sin(uv.y * 70.0 + glitchSeed * 31.4));
```
- Creates horizontal bands at different frequencies
- `step()` creates sharp on/off blocks
- Higher thresholds (0.6→0.8) = fewer, larger blocks

#### Layer 2: Random Displacements
```glsl
float disp1 = (random(vec2(glitchSeed, 1.0)) - 0.5);
uv.x += block1 * disp1 * u_distortionAmount * 0.12;
```
- Each block gets a random horizontal shift
- Shifts change every ~0.29 seconds (glitchSeed = floor(u_time * 3.5))
- Intensities: 12%, 15%, 10%, 8%

#### Layer 3: Micro-Glitches
```glsl
if (microGlitch > 0.9) {
    uv.x += (random(...) - 0.5) * u_distortionAmount * 0.2;
}
```
- 10% chance per frame for additional random shift
- Creates jitter between main glitch updates

#### Layer 4: Chromatic Aberration
```glsl
if (u_distortionAmount > 0.5) {
    float chromaShift = u_distortionAmount * 0.02;
    uv.x += sin(uv.y * 100.0 + glitchSeed * 5.0) * chromaShift;
}
```
- High-frequency horizontal shifts (100 waves)
- Only at high distortion levels
- Simulates RGB channel separation

#### Layer 5: Vertical Glitch Lines
```glsl
if (random(vec2(floor(uv.y * 50.0), glitchSeed)) > 0.97) {
    uv.x += (random(...) - 0.5) * u_distortionAmount * 0.25;
}
```
- 3% of horizontal scan lines get shifted
- Creates "corrupted scan line" effect

#### Layer 6: Block Corruption
```glsl
if (u_distortionAmount > 0.8) {
    float blockCorrupt = step(0.95, random(...));
    uv.x += blockCorrupt * (random(...) - 0.5) * 0.3;
}
```
- Only at very high distortion (>80%)
- 5% of blocks get severe corruption

**Visual Effect**: Digital glitch/datamosh aesthetic with multiple frequency layers

**Best for**: Intense, chaotic moments in the music

---

## Color System

### RGB ↔ HSV Conversion

**Location**: Lines 151-164

#### RGB to HSV
```glsl
vec3 rgb2hsv(vec3 c) {
    // Algorithm based on hexcone projection
    // Returns: (hue [0,1], saturation [0,1], value [0,1])
}
```

**Purpose**: Convert to HSV for hue shifting while preserving brightness structure

#### HSV to RGB
```glsl
vec3 hsv2rgb(vec3 c) {
    // Inverse transformation
}
```

**Purpose**: Convert back to RGB for rendering

---

### Color Processing Pipeline

**Location**: Lines 268-289

#### Step 1: Grayscale Conversion
```glsl
float gray = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
vec3 grayscaleTexture = vec3(gray);
```
- Uses luminance weights (ITU-R BT.601 standard)
- Red: 29.9%, Green: 58.7%, Blue: 11.4%
- Creates base black & white image

#### Step 2: Background Mixing
```glsl
vec3 normalColor = mix(u_bgColor, grayscaleTexture, texColor.a);
```
- Alpha-blends grayscale texture over background
- Preserves transparency

#### Step 3: Complementary Color Generation
```glsl
vec3 textureColorHSV = rgb2hsv(u_trailColor);
float textureHueShift = (u_hueShift / 360.0) * 0.4;
textureColorHSV.x = fract(textureColorHSV.x + 0.5 + textureHueShift);
```
- Takes base trail color
- Rotates 180° (`+ 0.5`) for complementary color
- Applies additional 40% of high-frequency hue shift
- Used for the raptor texture itself

#### Step 4: Glow Boost
```glsl
float glowBoost = 1.0 + (u_glowIntensity * 3.0);
textureColorHSV.z = min(1.0, textureColorHSV.z * glowBoost);
```
- Increases brightness up to 4x on bass hits
- Clamped to 1.0 (full brightness)

#### Step 5: Color Application
```glsl
float colorMixAmount = gray * texColor.a * (0.8 + u_glowIntensity * 0.5);
normalColor = mix(normalColor, textureColor * gray, colorMixAmount);
```
- Applies complementary color to bright areas
- Intensity increases with bass (up to 130%)
- Preserves image structure via `gray` multiplication

---

### Trail Color Processing

**Location**: Lines 292-298

```glsl
vec3 trailColorHSV = rgb2hsv(u_trailColor);
float colorHueShift = (u_hueShift / 360.0) * 1.0;  // Full high-freq shift
trailColorHSV.x = fract(trailColorHSV.x + colorHueShift);
trailColorHSV.y = min(1.0, trailColorHSV.y * 1.4);  // +40% saturation
trailColorHSV.z = min(1.0, trailColorHSV.z * 1.3);  // +30% brightness
```

**Visual Effect**:
- Trails shift hue based on high frequencies
- Boosted saturation and brightness for vibrancy
- Creates rainbow-like color shifts during high-frequency moments

---

## Trail Effect System

**Location**: Lines 304-316

### Architecture: Ping-Pong Buffers

Two framebuffers alternate between read and write:
- **Frame N**: Read from Buffer 0 → Write to Buffer 1
- **Frame N+1**: Read from Buffer 1 → Write to Buffer 0

**Prevents feedback loop**: Can't read and write to the same texture simultaneously.

---

### Trail Algorithm

#### Step 1: Sample Previous Frame
```glsl
vec4 previousTrail = texture2D(u_trailTexture, v_texCoord);
```
- Reads what trails existed at this pixel last frame

#### Step 2: Decay Old Trails
```glsl
vec3 decayedTrail = previousTrail.rgb * u_trailDecay;  // 0.92
```
- Multiplies by 0.92 each frame
- After 10 frames: 0.92^10 ≈ 0.43 (57% faded)
- After 20 frames: 0.92^20 ≈ 0.19 (81% faded)
- Creates smooth exponential fade

#### Step 3: Generate New Trail
```glsl
float brightness = gray * texColor.a;
vec3 newTrail = shiftedTrailColor * brightness * 0.3;
```
- Brightness from current pixel
- Colored with hue-shifted trail color
- 30% intensity

#### Step 4: Combine Trails
```glsl
vec3 trails = decayedTrail + newTrail;
```
- Additive blending
- Old trails fade as new ones appear

#### Step 5: Apply to Image
```glsl
vec3 finalColor = normalColor + trails;
```
- Additive blending creates glow effect
- Trails brighten the image

---

### Visual Effect Breakdown

**Short trails** (fast decay): Sharp, defined motion
**Long trails** (slow decay): Ghostly, ethereal motion

Current decay (0.92):
- **Half-life**: ~8.3 frames (138ms @ 60fps)
- **Persistence**: Visible for ~30-40 frames (0.5-0.7s)

**Color behavior**:
- Trails take on the hue-shifted trail color
- Creates colorful motion blur
- High frequencies → rapid color changes → rainbow trails

---

## Edge Detection & Glow

**Location**: Lines 255-302

### Sobel Edge Detection

#### Algorithm
```glsl
vec4 n = texture2D(u_texture, rotated + vec2(0.0, -edgeStep));  // North
vec4 s = texture2D(u_texture, rotated + vec2(0.0,  edgeStep));  // South
vec4 e = texture2D(u_texture, rotated + vec2( edgeStep, 0.0));  // East
vec4 w = texture2D(u_texture, rotated + vec2(-edgeStep, 0.0));  // West

float edgeX = length(e.rgb - w.rgb);  // Horizontal gradient
float edgeY = length(n.rgb - s.rgb);  // Vertical gradient
float edge = sqrt(edgeX * edgeX + edgeY * edgeY);  // Magnitude
edge = smoothstep(0.1, 0.5, edge);  // Smooth threshold
```

**How it works**:
1. Sample 4 neighboring pixels (NSEW)
2. Compute color difference in X and Y directions
3. Combine via Pythagorean theorem
4. Smooth threshold converts to 0-1 range

**edgeStep = 0.005**:
- At 720px resolution: 0.005 * 720 = 3.6 pixels
- Balances sharpness vs. noise

---

### Colored Edge Glow

```glsl
vec3 coloredEdge = shiftedTrailColor * edge * 1.5;
normalColor += coloredEdge;
```

**Visual Effect**:
- Edges glow with the (hue-shifted) trail color
- 1.5x intensity boost
- Outlines the raptor shape
- Color shifts with high frequencies
- Creates a neon outline effect

**Why additive?**
- Brightens edges without darkening the interior
- Stacks with other glow effects
- Creates HDR-like overbright highlights

---

## 3D Noise Effect

**Location**: Lines 318-323

### Noise Function

```glsl
float noise3d(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);  // Smoothstep interpolation

    float n = i.x + i.y * 57.0 + 113.0 * i.z;
    // Trilinear interpolation of 8 corners
    return mix(...);
}
```

**Algorithm**:
- 3D Perlin-style noise
- Smoothstep for smooth gradients
- Random() hashes 3D grid coordinates
- Returns value in [0, 1]

---

### Application

```glsl
vec3 noiseCoord = vec3(v_texCoord * 3.0, u_time * 0.1);
float noiseValue = noise3d(noiseCoord);
finalColor *= 0.8 + noiseValue * 0.4;  // Range: [0.8, 1.2]
```

**Parameters**:
- **Spatial frequency**: 3.0 (3 noise cycles across image)
- **Temporal speed**: 0.1 (slow drift)
- **Intensity**: ±20% brightness modulation

**Visual Effect**:
- Organic, cloud-like variation
- Subtle "film grain" texture
- Prevents flat, digital look
- Animates slowly (creates breathing/living quality)
- Darker patches (0.8x) and brighter patches (1.2x)

**Can be disabled**: Comment out lines 318-323 for cleaner look

---

## Audio-Reactive Mapping

**Location**: Lines 504-529 (JavaScript), shader uses uniforms

### Frequency Band Analysis

```javascript
analyzeFrequencyBands(data: Uint8Array): { bass, mid, high }
```

#### Band Definitions
- **Bass**: Bins 0-3 (0-86 Hz @ 44.1kHz sample rate)
- **Mid**: Bins 4-15 (86-689 Hz)
- **High**: Bins 16-63 (689-2756 Hz)

#### Processing
```javascript
bass = (bassSum / 4 / 255);      // Average & normalize
bass = Math.pow(bass, 3.0);      // Cubic curve (emphasizes peaks)

mid = (midSum / 12 / 255);
mid = Math.pow(mid, 1.5);        // Moderate curve

high = (highSum / 48 / 255);
high = Math.pow(high, 1.5);
```

**Power curves**:
- **Bass^3**: Very aggressive - only reacts to strong bass hits
- **Mid^1.5**: Moderate - more responsive
- **High^1.5**: Moderate - captures cymbal/hi-hat energy

---

### Visual Parameter Mapping

| Audio Band | Visual Parameter | Formula | Range | Effect |
|------------|------------------|---------|-------|--------|
| Bass | Scale (zoom) | `0.15 + smoothedBass * 0.8` | 0.15-0.95 | Pulses outward on kick drums |
| Bass | Glow Intensity | `u_glowIntensity = bass` | 0-1 | Brightens edges and texture |
| Bass | Color Inversion | `bass > 0.7` → trigger | boolean | Flash inverts colors |
| Mid | Distortion Amount | `max(0, mid - 0.5) / 0.5 * 0.6` | 0-0.6 | Glitches on strong mids |
| Mid | Time Speed | `0.02 + distortionIntensity * 0.2` | 0.02-0.22 | Faster animation when distorting |
| High | Rotation | `rotation += high * 0.8` | accumulates | Spins on hi-hats/cymbals |
| High | Hue Shift | `high * 240` | 0-240° | Rainbow color shifts |

---

### Smoothing

#### Bass Smoothing (for scale)
```javascript
smoothedBass = smoothedBass * 0.7 + bass * 0.3;
```
- 70% previous, 30% current
- Prevents jittery zooming
- ~3-5 frame smoothing window

#### Mid Smoothing (for inversion)
```javascript
smoothedMid = smoothedMid * 0.85 + mid * 0.15;
```
- 85% previous, 15% current
- Reduces strobing during inversion triggers
- ~6-7 frame smoothing window

**High frequencies**: No smoothing - intentionally responsive for rotation/color

---

### Color Inversion System

**Location**: Lines 565-576 (JavaScript), 326-332 (shader)

#### Trigger Logic
```javascript
if (bass > 0.7 && currentTime - lastInversionTime > 500) {
    isInverted = true;
    inversionStartTime = currentTime;
    lastInversionTime = currentTime;
}
```

**Conditions**:
- Bass intensity > 70%
- 500ms cooldown since last inversion
- Auto-reverts after 300ms

#### Shader Implementation
```glsl
if (u_invertColors) {
    float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
    if (luminance > 0.1) {  // Preserve black
        finalColor = vec3(1.0) - finalColor;
    }
}
```

**Visual Effect**:
- Flashes on bass hits
- Black stays black (background preserved)
- Creates dramatic punctuation
- Cooldown prevents seizure-inducing strobing

---

## Render Pipeline

### Full Execution Order

#### 1. JavaScript Side (per frame)
```javascript
1. analyser.getByteFrequencyData(dataArray)  // Get FFT data
2. analyzeFrequencyBands(dataArray)          // Extract bass/mid/high
3. Update smoothing filters
4. Check inversion triggers
5. Calculate uniform values
6. draw(bass, mid, high)
```

#### 2. Shader Uniforms Update
```javascript
gl.uniform1f(scaleLocation, scale);
gl.uniform1f(rotationLocation, rotation);
// ... all uniforms
```

#### 3. Vertex Shader (per vertex - 6 vertices)
- Transform to clip space
- Pass texture coordinates

#### 4. Fragment Shader (per pixel - 720×720 = 518,400 pixels!)

**Per-Pixel Pipeline**:
```glsl
1. UV Distortion        → Warped coordinates
2. Rotation & Scale     → Transformed coordinates
3. Texture Sampling     → Base color
4. Edge Detection       → Edge map
5. Grayscale Conversion → Luminance
6. HSV Manipulation     → Hue-shifted colors
7. Edge Coloring        → Colored outlines
8. Trail Sampling       → Previous frame
9. Trail Decay          → Faded trails
10. New Trail Generation → Fresh trails
11. Trail Combination   → Layered trails
12. 3D Noise            → Organic variation
13. Color Inversion     → Optional flip
14. Output              → Final pixel color
```

#### 5. Framebuffer Management
```javascript
// Render to off-screen buffer (for next frame's trails)
gl.bindFramebuffer(gl.FRAMEBUFFER, writeFramebuffer);
gl.drawArrays(gl.TRIANGLES, 0, 6);

// Render to screen
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
gl.drawArrays(gl.TRIANGLES, 0, 6);

// Swap buffers
currentTrailBuffer = 1 - currentTrailBuffer;
```

#### 6. Animation Loop
```javascript
animationId = requestAnimationFrame(animate);
```
- Targets 60fps
- Actual performance: GPU-dependent

---

## Performance Characteristics

### GPU Workload

**Per Frame**:
- 518,400 pixels × ~200 shader instructions = ~104M operations
- 2 render passes (framebuffer + screen)
- Texture lookups: 7 per pixel (texture, 4 edge samples, trail, random)

**Bottlenecks**:
- Fragment shader complexity
- Texture bandwidth
- Framebuffer switching

**Optimizations**:
- Single-pass edge detection (no separate pass)
- Inline noise function (no texture lookup)
- Fixed-size textures (720×720)

---

## Effect Contribution Summary

| Effect | Visual Impact | Performance Cost | Audio-Reactive? |
|--------|---------------|------------------|----------------|
| Distortion | High - defines motion style | Low | Yes (mid) |
| Scale/Rotation | High - creates pulse/spin | Low | Yes (bass/high) |
| Edge Detection | Medium - defines shape | Medium (5 texture reads) | Via hue shift |
| Trail System | High - motion blur aesthetic | High (framebuffer switch) | Via colors |
| Hue Shift | High - color dynamics | Low | Yes (high) |
| Glow Boost | Medium - emphasizes beats | Low | Yes (bass) |
| 3D Noise | Low - subtle texture | Medium (noise function) | No |
| Color Inversion | High - dramatic accents | Low | Yes (bass trigger) |

---

## Future Iteration Ideas

### Easy Modifications

1. **Adjust trail length**: Change `u_trailDecay` (line 620)
   - 0.95 = longer trails
   - 0.85 = shorter trails

2. **Change distortion intensity**: Modify line 555
   - `* 0.6` → `* 1.0` for more intense

3. **Add new distortion type**: Add `else if (u_distortionType == 5)` block

4. **Disable noise**: Comment out lines 318-323

5. **Change edge thickness**: Modify `edgeStep` (line 256)
   - 0.003 = thinner edges
   - 0.01 = thicker edges

---

### Advanced Modifications

1. **Chromatic Aberration**: Sample R/G/B at slightly offset UVs
2. **Bloom**: Add Gaussian blur pass on bright areas
3. **Kaleidoscope**: Mirror UVs around center point
4. **Feedback Delay**: Mix multiple previous frames
5. **Custom Color Palettes**: Replace HSV with gradient texture lookup
6. **Particle System**: Add point sprites for explosions
7. **Post-Processing**: Add scanlines, vignette, film grain
8. **Multi-Texture**: Blend between different SVG designs
9. **Reactive Texture**: Distort the raptor mesh itself
10. **FFT Visualization**: Add frequency spectrum overlay

---

## Debugging Tips

### Visualize Individual Effects

Comment out lines to isolate effects:

```glsl
// Disable trails
// vec3 finalColor = normalColor + trails;
vec3 finalColor = normalColor;

// Disable noise
// finalColor *= 0.8 + noiseValue * 0.4;

// Disable edge glow
// normalColor += coloredEdge;

// Disable distortion
// if (u_distortionType == ...) { ... }
```

### Color Channels Debugging

Replace final output to visualize data:

```glsl
// Show edge detection only
gl_FragColor = vec4(vec3(edge), 1.0);

// Show trails only
gl_FragColor = vec4(trails, 1.0);

// Show noise only
gl_FragColor = vec4(vec3(noiseValue), 1.0);

// Show UV coordinates
gl_FragColor = vec4(v_texCoord, 0.0, 1.0);
```

---

## Technical Notes

### Coordinate Systems

- **NDC (Normalized Device Coordinates)**: [-1, 1] for vertex positions
- **Texture Coordinates**: [0, 1] for UV mapping
- **Clip Space**: [-1, 1] after vertex shader
- **Screen Space**: [0, width] × [0, height] in pixels

### Texture Formats

- **Raptor texture**: RGBA8 (4 bytes per pixel)
- **Trail textures**: RGBA8, 720×720 = 2.07MB each
- **Total VRAM**: ~6MB for textures + buffers

### Shader Precision

```glsl
precision mediump float;
```
- 16-bit floating point
- Range: ±65,504
- Precision: ~3 decimal digits
- Sufficient for color/UV calculations

---

## Conclusion

This shader achieves a complex, organic audio-reactive visualization through:

1. **Layered effects** that compound (distortion → rotation → edges → trails → noise)
2. **Audio mapping** that uses frequency bands for different visual dimensions
3. **Temporal coherence** via ping-pong trail buffers
4. **Color theory** with HSV manipulation for vibrant, harmonious shifts
5. **Performance optimization** by packing effects into a single fragment shader

The result is a visually rich system where every frame is unique, yet the overall aesthetic remains cohesive through careful parameter tuning and mathematical constraints.

Each component contributes to the whole:
- **Distortion**: Motion and energy
- **Colors**: Emotional tone and variety
- **Trails**: Temporal continuity and flow
- **Edges**: Definition and structure
- **Noise**: Organic life and texture

Understanding these building blocks enables infinite creative variations while maintaining the core visual identity.

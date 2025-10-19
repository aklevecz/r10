# Color Theory for Audio Visualization

**A comprehensive guide to creating compelling color schemes for audio-reactive visuals**

> **Purpose**: Understand how to use color to enhance audio visualization, create mood, encode information, and maintain visual coherence across dynamic changes.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Glossary](#glossary)
3. [Your Current Implementation](#your-current-implementation)
4. [Color Space Fundamentals](#color-space-fundamentals)
5. [Audio-Reactive Color Strategies](#audio-reactive-color-strategies)
6. [Color Palette Design](#color-palette-design)
7. [Genre-Specific Color Palettes](#genre-specific-color-palettes)
8. [Dynamic Color Transitions](#dynamic-color-transitions)
9. [Multi-Channel Color Mapping](#multi-channel-color-mapping)
10. [Color Accessibility](#color-accessibility)
11. [Advanced Color Techniques](#advanced-color-techniques)
12. [Debugging Color Systems](#debugging-color-systems)
13. [Common Mistakes](#common-mistakes)
14. [Copy-Paste Snippets](#copy-paste-snippets)
15. [Progression Path](#progression-path)

---

## Quick Start

**Get results in 5 minutes:**

### 1. Understand Your Current System
Your shader uses **HSV color space** with hue rotation:
```glsl
// Line 290-293 of AudioVisualizerWebGL.svelte
vec3 hsv = vec3(u_hue / 360.0, u_saturation / 100.0, u_lightness / 100.0);
vec3 rgb = hsv2rgb(hsv);
vec4 currentColor = texture2D(u_texture, uv);
finalColor = vec4(currentColor.rgb * rgb, currentColor.a);
```

### 2. Try This First
**Add bass-reactive saturation boost:**
```javascript
// In your draw() function around line 650
const satBoost = Math.pow(smoothedBass, 2) * 30; // 0-30% boost
gl.uniform1f(saturationLocation, params.trailSat + satBoost);
```

### 3. Test With Music
- **Bass-heavy track** → Watch saturation pulse
- **High-frequency track** → Should stay more subtle
- Adjust multiplier (30) to taste

**Result**: Colors become more vivid during bass hits, creating immediate audio-visual connection.

---

## Glossary

### Color Spaces

- **RGB (Red, Green, Blue)**: Additive color model used by displays. Each channel 0-255 or 0.0-1.0.
- **HSV (Hue, Saturation, Value)**: Cylindrical color space. Hue = color (0-360°), Saturation = vividness (0-100%), Value/Lightness = brightness (0-100%).
- **HSL (Hue, Saturation, Lightness)**: Similar to HSV but lightness is perceptual mid-point between black and white.
- **LAB**: Perceptually uniform color space. L = lightness, A = green-red axis, B = blue-yellow axis.

### Color Properties

- **Hue**: The "name" of the color (red, blue, green, etc.). Represented as angle on color wheel (0-360°).
- **Saturation**: Color intensity/purity. 0% = grayscale, 100% = pure color.
- **Lightness/Value**: Brightness. 0% = black, 100% = white (HSL) or pure color (HSV).
- **Chroma**: Colorfulness relative to brightness of white. Related to saturation.
- **Luminance**: Perceived brightness. Weighted combination of RGB (0.299R + 0.587G + 0.114B).

### Color Relationships

- **Complementary**: Colors opposite on color wheel (180° apart). Maximum contrast.
- **Analogous**: Adjacent colors on wheel (±30°). Harmonious.
- **Triadic**: Three colors evenly spaced (120° apart). Vibrant balance.
- **Split-Complementary**: Base color + two colors adjacent to its complement. Softer contrast.
- **Monochromatic**: Single hue with varying saturation/lightness.

### Audio Terms

- **Spectral Centroid**: "Center of mass" of spectrum. Correlates with brightness/timbre.
- **Spectral Flux**: Rate of change in spectrum. Measures "novelty" or onset strength.
- **Dynamic Range**: Difference between loudest and quietest parts. Wide range = more color variation potential.
- **Frequency Bands**: Bass (20-250Hz), Mid (250-4kHz), High (4kHz-20kHz).

### Visual Perception

- **Color Constancy**: Brain's tendency to perceive consistent colors despite lighting changes.
- **Simultaneous Contrast**: Adjacent colors affect each other's appearance.
- **Bezold Effect**: Changing one color in pattern changes perception of all colors.
- **Chromatic Adaptation**: Eyes adjust to color temperature of environment.

---

## Your Current Implementation

### Line-by-Line Analysis

**Lines 284-300: Current Color System**
```glsl
// Line 284: Input color from texture
vec4 currentColor = texture2D(u_texture, uv);

// Line 286-287: Edge detection for glow
float edgeStrength = length(sobel);
float glowStrength = edgeStrength * u_glowIntensity;

// Line 289: Final color accumulator
vec3 finalColor = vec3(0.0);

// Line 290: Convert HSV parameters (0-360, 0-100, 0-100) to normalized (0-1)
vec3 hsv = vec3(u_hue / 360.0, u_saturation / 100.0, u_lightness / 100.0);

// Line 291: Convert HSV to RGB using custom function (lines 133-154)
vec3 rgb = hsv2rgb(hsv);

// Line 292: Apply color tint to texture
vec4 currentColor = texture2D(u_texture, uv);

// Line 293: Multiply texture RGB by color RGB, preserve alpha
finalColor = vec4(currentColor.rgb * rgb, currentColor.a);
```

### What This Means

**Current System**: **Multiplicative Color Tinting**

Your implementation uses a **multiplication blend mode**:
```
Output = Texture_Color × Tint_Color
```

**Properties**:
- ✅ **Preserves texture detail** (dark areas stay dark)
- ✅ **Simple and performant** (single multiply)
- ⚠️ **Cannot lighten** (can only darken or maintain)
- ⚠️ **Cannot shift black** (black × color = black)
- ⚠️ **Static color** (no audio-reactivity)

**Visual Result**:
```
White texture (1,1,1) × Red tint (1,0,0) = Red (1,0,0)      ✓ Full effect
Gray texture (0.5,0.5,0.5) × Red tint (1,0,0) = Dark red (0.5,0,0)  ✓ Partial
Black texture (0,0,0) × Red tint (1,0,0) = Black (0,0,0)    ✗ No effect
```

### Parameters Currently Available

**From JavaScript (lines 540-660)**:
```javascript
// Line 591: Hue (color on wheel)
gl.uniform1f(hueLocation, (params.trailHue || 0) % 360);

// Line 592: Saturation (color intensity)
gl.uniform1f(saturationLocation, params.trailSat || 50);

// Line 593: Lightness (brightness)
gl.uniform1f(lightnessLocation, params.trailLight || 50);

// Line 622: Glow intensity (edge enhancement)
gl.uniform1f(glowIntensityLocation, 0.5);
```

**Current Values** (from context):
- Hue: 330° (magenta-pink)
- Saturation: 100% (fully saturated)
- Lightness: 65% (fairly bright)

### Visual Representation

**Current Color Wheel Position**:
```
        0° Red
         |
   315°  |  45° Orange
      \  |  /
       \ | /
270° ----+---- 90° Green-Yellow
Yellow  / | \
       /  |  \
     /    |    \
  225°    |    135° Green
          |
     180° Cyan

     [330° ← YOU ARE HERE]
     (Magenta-Pink region)
```

**HSV Cylinder Visualization**:
```
     V=100% (White top)
         ___
        /   \
       /  ●  \  ← Your color: H=330°, S=100%, V=65%
      /       \    (On outer edge = full saturation)
     /____ ___\   (Mid-height = 65% brightness)

    V=0% (Black bottom)

    View from top (Hue wheel):
         0°
         |
    270°-+-90°
         |
        180°
```

### Strengths of Current Approach

1. **Performance**: Single HSV→RGB conversion + multiply = very fast
2. **Simplicity**: Easy to understand and modify
3. **Compatibility**: Works with any texture/SVG
4. **Predictability**: Color tint is consistent across frames

### Limitations and Opportunities

**Current Limitations**:
```javascript
// ❌ Static color - no audio connection
const hue = params.trailHue; // Never changes

// ❌ Cannot brighten blacks
finalColor = textureColor * tint; // Multiply can only darken

// ❌ Single color - no palette
vec3 hsv = vec3(u_hue / 360.0, ...); // One color for everything

// ❌ No spatial variation
// Same color applied to entire screen
```

**Improvement Opportunities**:
```javascript
// ✅ Audio-reactive hue rotation
const hue = (baseHue + rotation * high) % 360;

// ✅ Bass-reactive saturation
const sat = baseSat + Math.pow(bass, 2) * 40;

// ✅ Palette switching
const colorPalette = genre === 'electronic' ? neonPalette : warmPalette;

// ✅ Spatial color gradients
vec2 centerDist = length(uv - vec2(0.5));
float hueShift = centerDist * 60.0; // Radial rainbow
```

---

## Color Space Fundamentals

### RGB vs HSV: When to Use Each

**RGB (Red, Green, Blue)**

**Best for**:
- Final output (required by GPU)
- Mixing light (additive blending)
- Direct channel manipulation
- Performance-critical operations

**Challenges**:
- Non-intuitive (what RGB makes "warm orange"?)
- Difficult to adjust "intensity" without changing hue
- Hard to create harmonious palettes

**Example - Adjusting Brightness in RGB**:
```glsl
// ❌ Naive approach - changes color
vec3 color = vec3(0.8, 0.3, 0.1); // Orange
color *= 1.5; // Now (1.0, 0.45, 0.15) - more yellow!

// ✅ Correct approach - preserve ratios
float maxChannel = max(max(color.r, color.g), color.b);
color *= (1.5 / maxChannel); // Scale proportionally
color = clamp(color, 0.0, 1.0); // Prevent overflow
```

**HSV (Hue, Saturation, Value)**

**Best for**:
- Color selection/UI (intuitive)
- Hue rotation effects
- Saturation/brightness adjustments
- Color harmony calculations

**Challenges**:
- Requires conversion to/from RGB (cost: ~10 instructions)
- Not perceptually uniform (blue looks darker than yellow at same V)
- Saturation behaves differently at different V levels

**Example - Safe Brightness Adjustment**:
```glsl
vec3 hsv = rgb2hsv(color);
hsv.z *= 1.5; // Increase value (brightness)
hsv.z = clamp(hsv.z, 0.0, 1.0);
color = hsv2rgb(hsv); // Always valid color
```

### Your Current HSV↔RGB Implementation

**Lines 133-154: HSV to RGB Conversion**
```glsl
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
```

**How it works**:
1. `c.xxx + K.xyz` creates three offset hues (0°, 120°, 240° apart)
2. `fract()` wraps to 0-1 range
3. `* 6.0 - K.www` creates triangle wave pattern
4. `clamp(p - K.xxx, 0.0, 1.0)` shapes into RGB channels
5. `mix(K.xxx, ..., c.y)` applies saturation
6. `c.z * ...` applies value/brightness

**Visual Breakdown**:
```
Hue Input: 0.0 (red)    0.333 (green)    0.667 (blue)
           ↓            ↓                ↓
Step 1:    [0, 2/3, 1/3] [1/3, 0, 2/3]  [2/3, 1/3, 0]
Step 2:    [0, 4, 2]    [2, 0, 4]       [4, 2, 0]
Step 3:    [0, 1, -1]   [-1, 0, 1]      [1, -1, 0]
Step 4:    [0, 1, 0]    [0, 0, 1]       [1, 0, 0]
           ↓            ↓                ↓
RGB:       Red          Blue            Green

(Order is R,G,B but hue wheel is R,Y,G,C,B,M)
```

**Performance**: ~8 instructions. Very fast.

**Lines 155-175: RGB to HSV Conversion**
```glsl
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
```

**How it works**:
1. Find the max and min RGB channels
2. Calculate hue based on which channel is max
3. Calculate saturation as (max - min) / max
4. Value is simply the max channel

**Use case**: When you need to modify existing colors (e.g., shift hue of texture).

### Color Space Comparison Table

| Property | RGB | HSV | HSL | LAB |
|----------|-----|-----|-----|-----|
| **Intuitive** | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **Perceptually Uniform** | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **GPU Native** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Conversion Cost** | Free | ~8 ops | ~10 ops | ~30 ops |
| **Good for Hue Rotation** | ❌ No | ✅ Yes | ✅ Yes | ⚠️ Complex |
| **Good for Brightness** | ⚠️ Hard | ✅ Yes | ✅ Yes | ✅ Yes |
| **Good for Saturation** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Color Mixing** | ✅ Great | ❌ Poor | ❌ Poor | ✅ Great |
| **Best Use** | Output, Blending | UI, Effects | Design | Gradients, Contrast |

### When to Convert

**Stay in RGB when**:
- Doing final compositing (line 298-300 of your shader)
- Blending multiple layers
- Applying textures
- Performance is critical

**Convert to HSV when**:
- Rotating hue (rainbow effects)
- User controls (color pickers)
- Adjusting saturation/brightness independently
- Creating harmonious palettes

**Pattern - Convert Once, Not Per-Pixel**:
```javascript
// ✅ GOOD: Convert in JavaScript
const baseHSV = { h: 330, s: 100, v: 65 };
const rotatedHue = (baseHSV.h + rotation) % 360;
gl.uniform1f(hueLocation, rotatedHue);

// Shader receives hue directly
vec3 hsv = vec3(u_hue / 360.0, u_sat / 100.0, u_val / 100.0);
vec3 rgb = hsv2rgb(hsv); // One conversion per frame

// ❌ BAD: Convert per-pixel
// Inside fragment shader loop (runs millions of times)
vec3 hsv = rgb2hsv(textureColor); // Wasteful!
hsv.x += 0.5;
vec3 rgb = hsv2rgb(hsv);
```

---

## Audio-Reactive Color Strategies

### Strategy 1: Hue Rotation (Frequency → Color)

**Concept**: Map frequency content to position on color wheel.

**Your Current Implementation** (partially):
```javascript
// Line 559-560: Rotation based on high frequencies
rotation += high * 0.8;
rotation = rotation % 360;

// BUT: Rotation is used for geometry, not color!
gl.uniform1f(rotationLocation, rotation);
```

**Enhanced Version - Hue Rotation**:
```javascript
// Map different frequency bands to different hue shifts
const bassHueShift = Math.pow(smoothedBass, 2) * 60;    // 0-60° (warm shift)
const midHueShift = smoothedMid * 30;                    // 0-30° (subtle)
const highHueShift = Math.pow(high, 1.5) * 120;         // 0-120° (wide shift)

// Combine with weights
const totalHueShift = bassHueShift * 0.5 + midHueShift * 0.2 + highHueShift * 0.3;

const finalHue = (params.trailHue + totalHueShift) % 360;
gl.uniform1f(hueLocation, finalHue);
```

**Visual Result**:
```
Base Hue: 330° (Magenta)

No sound:     330° ████ Magenta
Bass hit:     350° ███  Red-Magenta
Mid peak:     340° ████ Magenta-Red
High treble:  90°  ████ Yellow-Green (dramatic shift!)
All together: 60°  ████ Orange-Red
```

**Frequency-to-Color Mappings**:

| Frequency Band | Suggested Hue Shift | Reason | Visual Effect |
|----------------|---------------------|--------|---------------|
| **Bass (0-250Hz)** | ±30° | Warm/cool shift | Subtle mood change |
| **Low-Mid (250-500Hz)** | ±60° | Analogous colors | Harmonious variation |
| **Mid (500-2kHz)** | ±90° | Complementary tones | Noticeable contrast |
| **High-Mid (2k-4kHz)** | ±120° | Triadic relationship | Bold color change |
| **High (4kHz+)** | ±180° | Full complement | Maximum contrast |

### Strategy 2: Saturation (Energy → Intensity)

**Concept**: Map audio energy to color vividness.

**Implementation**:
```javascript
// Bass drives saturation (makes colors "pop" on kick drums)
const bassSatBoost = Math.pow(smoothedBass, 2.5) * 40; // 0-40% boost

// Mid frequencies for sustained saturation
const midSatBoost = smoothedMid * 20; // 0-20% boost

// Combine
const totalSat = Math.min(100, params.trailSat + bassSatBoost + midSatBoost);
gl.uniform1f(saturationLocation, totalSat);
```

**Perceptual Ranges**:
```
Saturation: 0%    ████ Grayscale - no color information
           20%    ████ Subtle tint - muted, professional
           40%    ████ Noticeable color - balanced
           60%    ████ Vibrant - strong presence
           80%    ████ Very saturated - energetic
          100%    ████ Maximum saturation - intense, neon

Your base (100%): Already at maximum!
Boost strategy: Start lower (60-80%) so you have headroom
```

**Alternative - Saturation Pulsing**:
```javascript
// Start from a lower base
const baseSaturation = 70; // Leaves room for growth

// Pulse with beat detection
const isBeat = bass > avgBass * 1.4;
const satPulse = isBeat ? 30 : 0;

// Smooth the pulse
smoothedSatPulse = smoothedSatPulse * 0.6 + satPulse * 0.4;

const finalSat = Math.min(100, baseSaturation + smoothedSatPulse);
```

### Strategy 3: Lightness/Value (Dynamics → Brightness)

**Concept**: Map overall loudness or specific frequencies to brightness.

**Implementation**:
```javascript
// Overall RMS energy
const rms = Math.sqrt((bass*bass + mid*mid + high*high) / 3);
const energyBoost = Math.pow(rms, 1.8) * 25; // 0-25% boost

// High frequencies for "sparkle"
const sparkle = Math.pow(high, 2) * 15; // 0-15% boost

const finalLightness = Math.min(95, params.trailLight + energyBoost + sparkle);
gl.uniform1f(lightnessLocation, finalLightness);
```

**Safety Ranges**:
```
Lightness: 0%    ████ Pure black - nothing visible
          20%    ████ Very dark - moody
          40%    ████ Dark - dramatic
          60%    ████ Medium - balanced
          80%    ████ Bright - energetic
          95%    ████ Very bright - safe maximum
         100%    ████ Pure white - loses all color!

Your base (65%): Good middle ground
Recommend: 50-85% range for audio reactivity
```

**⚠️ Warning - Lightness = 100% Problem**:
```glsl
// At L=100%, HSV converts to pure white regardless of hue!
vec3 hsv = vec3(0.5, 1.0, 1.0); // Hue=180° (cyan), S=100%, V=100%
vec3 rgb = hsv2rgb(hsv);
// Result: rgb = (1.0, 1.0, 1.0) = WHITE

// Solution: Cap at 90-95%
const maxLightness = 90;
```

### Strategy 4: Multi-Parameter Choreography

**Concept**: Coordinate multiple color parameters to create cohesive visual "phrases".

**Example - "Bass Warmth" Pattern**:
```javascript
// When bass hits, shift toward warm colors AND increase saturation
function applyBassWarmth(params, bass) {
    const bassIntensity = Math.pow(bass, 2.5);

    // Shift hue toward red-orange (0-30°)
    const warmShift = bassIntensity * 30;

    // Boost saturation
    const satBoost = bassIntensity * 25;

    // Slightly darken for richness
    const darken = bassIntensity * -10;

    return {
        hue: (params.trailHue + warmShift) % 360,
        sat: Math.min(100, params.trailSat + satBoost),
        light: Math.max(30, params.trailLight + darken)
    };
}
```

**Example - "High Frequency Sparkle"**:
```javascript
function applyHighSparkle(params, high) {
    const sparkle = Math.pow(high, 2);

    // Shift toward cool colors (cyan-blue, +120-180°)
    const coolShift = sparkle * 150;

    // Desaturate slightly (makes it "airy")
    const desaturate = sparkle * -20;

    // Brighten significantly
    const brighten = sparkle * 30;

    return {
        hue: (params.trailHue + coolShift) % 360,
        sat: Math.max(40, params.trailSat + desaturate),
        light: Math.min(95, params.trailLight + brighten)
    };
}
```

**Combining Strategies**:
```javascript
// In draw() function
const bassColors = applyBassWarmth(params, smoothedBass);
const highColors = applyHighSparkle(params, high);
const midFactor = smoothedMid;

// Blend based on which frequency dominates
const bassWeight = smoothedBass / (smoothedBass + smoothedMid + high + 0.01);
const highWeight = high / (smoothedBass + smoothedMid + high + 0.01);

const finalHue =
    bassColors.hue * bassWeight +
    highColors.hue * highWeight +
    params.trailHue * (1 - bassWeight - highWeight);

const finalSat =
    bassColors.sat * bassWeight +
    highColors.sat * highWeight +
    params.trailSat * (1 - bassWeight - highWeight);

const finalLight =
    bassColors.light * bassWeight +
    highColors.light * highWeight +
    params.trailLight * (1 - bassWeight - highWeight);
```

### Strategy Comparison Table

| Strategy | Best For | Subtlety | Impact | CPU Cost |
|----------|----------|----------|--------|----------|
| **Hue Rotation** | Genre variation, Frequency encoding | Medium | High | Low |
| **Saturation** | Energy/intensity, Beat emphasis | High | Medium | Low |
| **Lightness** | Dynamics, Overall energy | Low | High | Low |
| **Multi-Parameter** | Emotional storytelling, Complex music | Low | Very High | Medium |
| **Palette Switching** | Song structure, Genre shifts | N/A | Very High | Medium |

### Anti-Patterns to Avoid

**❌ All Parameters React to Same Input**:
```javascript
// BAD: Everything moves together = muddy
const hue = baseHue + bass * 60;
const sat = baseSat + bass * 30;
const light = baseLight + bass * 20;
// Result: Bass just makes everything "more" without character
```

**❌ Ignoring Perceptual Brightness**:
```javascript
// BAD: Yellow and blue at same HSV value
const yellowHSV = { h: 60, s: 100, v: 100 };   // Feels bright
const blueHSV = { h: 240, s: 100, v: 100 };     // Feels dark
// Solution: Adjust V to compensate for hue's natural luminance
```

**❌ Exceeding Perceptual Limits**:
```javascript
// BAD: Changes too fast for eye to track
hue += Math.random() * 360; // Disorienting

// GOOD: Smooth, musical changes
hue += Math.pow(high, 1.5) * 2; // Max 2° per frame at 60fps = 120°/sec
```

---

## Color Palette Design

### Palette Types

**1. Monochromatic**

**Definition**: Single hue with varying saturation and lightness.

**Best for**: Minimalist aesthetics, professional presentations, single-instrument focus.

**Implementation**:
```javascript
const baseHue = 330; // Magenta

const palette = {
    dark: { h: baseHue, s: 80, l: 30 },    // Deep magenta
    mid: { h: baseHue, s: 100, l: 50 },    // Pure magenta
    bright: { h: baseHue, s: 100, l: 70 }, // Light magenta
    pale: { h: baseHue, s: 40, l: 85 }     // Pale pink
};

// Map to frequency
function getMonochromaticColor(bass, mid, high) {
    if (bass > 0.6) return palette.dark;      // Deep on bass
    if (high > 0.5) return palette.pale;      // Pale on highs
    if (mid > 0.4) return palette.bright;     // Bright on mids
    return palette.mid;                        // Default
}
```

**Visual Example**:
```
Hue: 330° (all same)
     Dark     Mid      Bright   Pale
     ████     ████     ████     ████
     S:80     S:100    S:100    S:40
     L:30     L:50     L:70     L:85
```

**2. Analogous**

**Definition**: 2-4 adjacent hues (within 30° on wheel).

**Best for**: Harmonious, natural feeling, gradual transitions.

**Implementation**:
```javascript
const baseHue = 330; // Magenta

const palette = {
    left: (baseHue - 30 + 360) % 360,  // 300° (Purple)
    center: baseHue,                    // 330° (Magenta)
    right: (baseHue + 30) % 360        // 360°/0° (Red)
};

// Smooth transition based on frequency
function getAnalogousColor(bass, mid, high) {
    // Blend between three hues
    const hue =
        palette.left * bass +
        palette.center * mid +
        palette.right * high;

    return { h: hue % 360, s: 100, l: 65 };
}
```

**Visual Example**:
```
Color Wheel:
    300° Purple ←─┐
                  │ 30° apart
    330° Magenta ←┼─── You
                  │
    360° Red    ←─┘

Smooth transitions, pleasing harmony
```

**3. Complementary**

**Definition**: Two hues opposite on wheel (180° apart).

**Best for**: High contrast, dramatic shifts, call-and-response patterns.

**Implementation**:
```javascript
const baseHue = 330;  // Magenta
const compHue = (baseHue + 180) % 360; // 150° (Green)

const palette = {
    primary: { h: baseHue, s: 100, l: 65 },     // Magenta
    complement: { h: compHue, s: 100, l: 65 }   // Green
};

// Switch on beat or frequency dominance
function getComplementaryColor(bass, high) {
    const usePrimary = bass > high; // Bass = magenta, High = green
    return usePrimary ? palette.primary : palette.complement;
}
```

**Visual Example**:
```
     330° Magenta
         |
    270°-+-90°
         |
     150° Green ← Complement

Maximum contrast - eye-catching!
```

**4. Triadic**

**Definition**: Three hues evenly spaced (120° apart).

**Best for**: Vibrant, balanced, complex music with distinct sections.

**Implementation**:
```javascript
const baseHue = 330; // Magenta

const palette = {
    primary: baseHue,                       // 330° (Magenta)
    secondary: (baseHue + 120) % 360,      // 90° (Yellow-Green)
    tertiary: (baseHue + 240) % 360        // 210° (Cyan-Blue)
};

// Map to frequency bands
function getTriadicColor(bass, mid, high) {
    const total = bass + mid + high + 0.01;

    // Weighted blend
    const hue =
        (palette.primary * bass +
         palette.secondary * mid +
         palette.tertiary * high) / total;

    return { h: hue % 360, s: 100, l: 65 };
}
```

**Visual Example**:
```
        0°
        |
   90°--+--270°
  (2nd) | (Base)
        |
       180°
       (3rd)

Three-way balance - dynamic!
```

**5. Split-Complementary**

**Definition**: Base + two colors adjacent to complement (±30° from complement).

**Best for**: Softer contrast than complementary, more interesting than analogous.

**Implementation**:
```javascript
const baseHue = 330; // Magenta
const comp = (baseHue + 180) % 360; // 150° (Green)

const palette = {
    base: baseHue,                    // 330° (Magenta)
    compLeft: (comp - 30 + 360) % 360,  // 120° (Green)
    compRight: (comp + 30) % 360      // 180° (Cyan)
};

// Use base for most of the time, accents for peaks
function getSplitComplementaryColor(energy, isPeak) {
    if (isPeak) {
        return Math.random() > 0.5 ?
            { h: palette.compLeft, s: 100, l: 70 } :
            { h: palette.compRight, s: 100, l: 70 };
    }
    return { h: palette.base, s: 100, l: 65 };
}
```

**6. Custom Palette from Reference**

**Extract palette from image/artwork**:
```javascript
// Example: Neon cyberpunk palette
const neonPalette = [
    { h: 300, s: 100, l: 50, name: 'Neon Magenta' },
    { h: 180, s: 100, l: 50, name: 'Neon Cyan' },
    { h: 60, s: 100, l: 50, name: 'Neon Yellow' },
    { h: 280, s: 80, l: 60, name: 'Purple Glow' }
];

// Example: Warm sunset palette
const sunsetPalette = [
    { h: 20, s: 90, l: 50, name: 'Deep Orange' },
    { h: 340, s: 85, l: 55, name: 'Coral Pink' },
    { h: 50, s: 80, l: 60, name: 'Golden Yellow' },
    { h: 10, s: 70, l: 40, name: 'Burnt Sienna' }
];

// Select color based on energy
function getPaletteColor(palette, energy) {
    const index = Math.floor(energy * palette.length);
    return palette[Math.min(index, palette.length - 1)];
}
```

### Palette Selection Guide

| Music Genre | Recommended Palette | Reason |
|-------------|---------------------|--------|
| **Electronic/EDM** | Triadic or Custom Neon | High energy, distinct frequency ranges |
| **Classical** | Monochromatic or Analogous | Subtle, sophisticated, harmonious |
| **Rock/Metal** | Complementary (Red/Cyan) | Aggressive contrast, high impact |
| **Jazz** | Split-Complementary | Complex but balanced |
| **Hip-Hop** | Monochromatic + Accent | Strong bass focus, occasional accents |
| **Ambient** | Analogous (cool hues) | Smooth transitions, calming |
| **Pop** | Triadic (bright) | Vibrant, accessible, fun |

---

## Genre-Specific Color Palettes

### Electronic/EDM

**Characteristics**: High energy, clear frequency separation, rhythmic.

**Palette**:
```javascript
const edmPalette = {
    bass: { h: 280, s: 100, l: 50 },    // Deep purple (kick drums)
    synth: { h: 180, s: 100, l: 55 },   // Cyan (synth leads)
    high: { h: 60, s: 100, l: 60 },     // Yellow (hi-hats, cymbals)
    accent: { h: 0, s: 100, l: 50 }     // Red (drops, builds)
};

function getEDMColor(bass, mid, high, isBuildUp) {
    if (isBuildUp) return edmPalette.accent;

    // Frequency dominance
    if (bass > 0.7) return edmPalette.bass;
    if (high > 0.6) return edmPalette.high;
    if (mid > 0.5) return edmPalette.synth;

    // Blend
    const total = bass + mid + high + 0.01;
    const hue =
        (edmPalette.bass.h * bass +
         edmPalette.synth.h * mid +
         edmPalette.high.h * high) / total;

    return { h: hue % 360, s: 100, l: 55 };
}
```

### Classical/Orchestral

**Characteristics**: Dynamic range, harmonic complexity, gradual changes.

**Palette**:
```javascript
const classicalPalette = {
    base: { h: 220, s: 40, l: 50 },     // Muted blue (foundation)
    warm: { h: 30, s: 60, l: 55 },      // Warm gold (strings)
    bright: { h: 50, s: 70, l: 70 },    // Bright yellow (brass)
    dark: { h: 240, s: 50, l: 30 }      // Dark blue (low strings)
};

function getClassicalColor(rms, spectralCentroid) {
    // Spectral centroid = "brightness" of sound
    const brightness = spectralCentroid / 5000; // Normalize to 0-1

    // Dynamic range
    const dynamics = Math.pow(rms, 1.5);

    // Blend warm/cool based on timbre
    const hue = brightness > 0.6 ?
        classicalPalette.bright.h :
        classicalPalette.base.h;

    // Saturation based on dynamics
    const sat = classicalPalette.base.s + dynamics * 30;

    // Lightness follows energy
    const light = 40 + dynamics * 30;

    return { h: hue, s: Math.min(sat, 80), l: Math.min(light, 70) };
}
```

### Rock/Metal

**Characteristics**: Aggressive, distorted, high energy.

**Palette**:
```javascript
const rockPalette = {
    guitar: { h: 0, s: 90, l: 45 },      // Aggressive red
    drums: { h: 30, s: 85, l: 40 },      // Orange-red (kick/snare)
    cymbals: { h: 180, s: 70, l: 65 },   // Cool cyan (contrast)
    bass: { h: 10, s: 80, l: 35 }        // Deep red-orange
};

function getRockColor(bass, mid, high) {
    // Strong bass = deep warm
    if (bass > 0.8) return rockPalette.bass;

    // Cymbal crashes = cool contrast
    if (high > 0.75) return rockPalette.cymbals;

    // Guitars = primary red
    if (mid > 0.6) return rockPalette.guitar;

    // Default blend toward warm
    return {
        h: rockPalette.drums.h,
        s: 85,
        l: 40 + Math.pow(bass + mid, 1.5) * 25
    };
}
```

### Hip-Hop

**Characteristics**: Heavy bass, rhythmic, vocal-centric.

**Palette**:
```javascript
const hiphopPalette = {
    bass: { h: 280, s: 100, l: 40 },     // Deep purple (808s)
    snare: { h: 200, s: 60, l: 60 },     // Cool gray-blue (snares)
    hihat: { h: 0, s: 0, l: 80 },        // Bright white/silver (hi-hats)
    vocal: { h: 45, s: 80, l: 55 }       // Gold (vocal presence)
};

function getHipHopColor(bass, mid, high, hasVocal) {
    // Strong bass foundation
    const baseFactor = Math.pow(bass, 2);

    // Vocal sections shift to gold
    if (hasVocal && mid > 0.4) {
        return {
            h: hiphopPalette.vocal.h,
            s: hiphopPalette.vocal.s,
            l: hiphopPalette.vocal.l + bassFactor * 15
        };
    }

    // Hi-hats = desaturated bright
    if (high > 0.7) return hiphopPalette.hihat;

    // Default = purple bass with saturation boost on hits
    return {
        h: hiphopPalette.bass.h,
        s: 80 + bassFactor * 20,
        l: 40 + bassFactor * 20
    };
}
```

### Ambient/Chill

**Characteristics**: Slow evolution, atmospheric, soothing.

**Palette**:
```javascript
const ambientPalette = {
    base: { h: 200, s: 30, l: 45 },      // Calm blue
    warm: { h: 20, s: 25, l: 50 },       // Subtle warm
    cool: { h: 180, s: 35, l: 55 },      // Soft cyan
    accent: { h: 280, s: 40, l: 60 }     // Gentle purple
};

// Very slow, smooth transitions
let currentHue = ambientPalette.base.h;

function getAmbientColor(smoothedRMS, delta) {
    // Target hue based on energy
    const targetHue = smoothedRMS > 0.5 ?
        ambientPalette.warm.h :
        ambientPalette.cool.h;

    // Ultra-slow lerp (takes ~5 seconds to transition)
    const lerpSpeed = 0.002 * (delta / 16.67); // Normalized to 60fps
    currentHue += (targetHue - currentHue) * lerpSpeed;

    // Very subtle saturation
    const sat = 30 + smoothedRMS * 15;

    // Gentle lightness changes
    const light = 45 + smoothedRMS * 15;

    return { h: currentHue % 360, s: sat, l: light };
}
```

---

## Dynamic Color Transitions

### Smooth vs. Instant Transitions

**Instant (Hard Cut)**:
```javascript
// Good for: Beat-synced changes, dramatic moments
if (isBeat) {
    currentColor = palette.accent;
} else {
    currentColor = palette.base;
}
```

**Smooth (Lerp)**:
```javascript
// Good for: Continuous changes, natural feel
const targetColor = isBeat ? palette.accent : palette.base;

// Linear interpolation
currentHue = currentHue + (targetColor.h - currentHue) * 0.1;
currentSat = currentSat + (targetColor.s - currentSat) * 0.1;
currentLight = currentLight + (targetColor.l - currentLight) * 0.1;
```

**Attack-Release (Musical)**:
```javascript
// Good for: Mimicking instrument envelopes
function attackRelease(current, target, isActive, attackTime, releaseTime) {
    const speed = isActive ? attackTime : releaseTime;
    return current + (target - current) * speed;
}

// Example usage
const isBassHit = bass > 0.7;
const targetSat = isBassHit ? 100 : 60;
const satSpeed = isBassHit ? 0.3 : 0.05; // Fast attack, slow release

currentSat = currentSat + (targetSat - currentSat) * satSpeed;
```

### Transition Timing Guide

| Speed | Lerp Factor | Frames (60fps) | Use Case |
|-------|-------------|----------------|----------|
| **Instant** | 1.0 | 1 frame | Beat sync, stutter effects |
| **Snappy** | 0.3-0.5 | 3-5 frames | Percussion, impacts |
| **Medium** | 0.1-0.2 | 10-20 frames | Musical phrases, buildups |
| **Slow** | 0.02-0.05 | 50-100 frames | Ambient, mood shifts |
| **Glacial** | 0.001-0.01 | 500+ frames | Background evolution |

### Easing Functions for Color

**Linear** (boring):
```javascript
const lerp = (a, b, t) => a + (b - a) * t;
```

**Ease Out** (fast start, slow end - good for decay):
```javascript
const easeOut = (a, b, t) => {
    const eased = 1 - Math.pow(1 - t, 3); // Cubic ease out
    return a + (b - a) * eased;
};
```

**Ease In** (slow start, fast end - good for anticipation):
```javascript
const easeIn = (a, b, t) => {
    const eased = Math.pow(t, 3); // Cubic ease in
    return a + (b - a) * eased;
};
```

**Smooth Step** (slow-fast-slow - natural feeling):
```javascript
const smoothStep = (a, b, t) => {
    const eased = t * t * (3 - 2 * t);
    return a + (b - a) * eased;
};
```

**Elastic** (overshoot and bounce - fun for beats):
```javascript
const elastic = (a, b, t) => {
    const c4 = (2 * Math.PI) / 3;
    const eased = t === 0 ? 0 : t === 1 ? 1 :
        Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    return a + (b - a) * eased;
};
```

### Hue Interpolation Special Case

**Problem**: Hue is circular (0° = 360°).

**Wrong Way**:
```javascript
// BAD: Going from 350° to 10°
const current = 350;
const target = 10;
const lerped = current + (target - current) * 0.1;
// Result: 350 + (10 - 350) * 0.1 = 350 - 34 = 316°
// Wrong! We went backward through the wheel
```

**Right Way**:
```javascript
function lerpHue(current, target, speed) {
    // Calculate shortest path
    let delta = target - current;

    // Wrap to -180 to 180 range
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // Lerp along shortest path
    current = (current + delta * speed) % 360;
    if (current < 0) current += 360;

    return current;
}

// Example:
lerpHue(350, 10, 0.1);
// delta = 10 - 350 = -340
// delta > 180, so delta += 360 = 20 (correct short path!)
// current = (350 + 20 * 0.1) % 360 = 352° (moving forward correctly)
```

### Multi-Stage Color Sequences

**Example - Build-Drop-Break Pattern** (common in EDM):

```javascript
class ColorSequencer {
    constructor() {
        this.stage = 'verse';
        this.stageColors = {
            verse: { h: 220, s: 60, l: 50 },     // Calm blue
            build: { h: 30, s: 80, l: 60 },      // Rising orange
            drop: { h: 0, s: 100, l: 55 },       // Intense red
            break: { h: 180, s: 50, l: 65 }      // Bright cyan
        };
        this.current = this.stageColors.verse;
    }

    setStage(newStage) {
        this.stage = newStage;
    }

    update(delta) {
        const target = this.stageColors[this.stage];
        const speed = this.stage === 'drop' ? 0.4 : 0.05; // Fast on drop

        this.current.h = lerpHue(this.current.h, target.h, speed);
        this.current.s += (target.s - this.current.s) * speed;
        this.current.l += (target.l - this.current.l) * speed;

        return this.current;
    }
}

// Usage
const sequencer = new ColorSequencer();

// Detect build-up (increasing mid energy over time)
if (isBuildup) sequencer.setStage('build');
if (isDrop) sequencer.setStage('drop');
if (isBreak) sequencer.setStage('break');

const color = sequencer.update(delta);
gl.uniform1f(hueLocation, color.h);
```

---

## Multi-Channel Color Mapping

### Strategy: Different Objects = Different Colors

**Concept**: If you have multiple visual elements, assign different colors based on frequency.

**Implementation** (requires shader modification):

**JavaScript**:
```javascript
// Three color uniforms for three frequency bands
const bassColor = { h: 280, s: 100, l: 50 };  // Purple
const midColor = { h: 120, s: 100, l: 55 };   // Green
const highColor = { h: 60, s: 100, l: 60 };   // Yellow

// Convert and send to shader
const bassRGB = hsvToRgb(bassColor);
const midRGB = hsvToRgb(midColor);
const highRGB = hsvToRgb(highColor);

gl.uniform3f(bassColorLocation, bassRGB.r, bassRGB.g, bassRGB.b);
gl.uniform3f(midColorLocation, midRGB.r, midRGB.g, midRGB.b);
gl.uniform3f(highColorLocation, highRGB.r, highRGB.g, highRGB.b);

// Send frequency strengths
gl.uniform1f(bassStrengthLocation, smoothedBass);
gl.uniform1f(midStrengthLocation, smoothedMid);
gl.uniform1f(highStrengthLocation, high);
```

**Shader** (replace lines 290-293):
```glsl
uniform vec3 u_bassColor;
uniform vec3 u_midColor;
uniform vec3 u_highColor;
uniform float u_bassStrength;
uniform float u_midStrength;
uniform float u_highStrength;

// In fragment shader
vec4 currentColor = texture2D(u_texture, uv);

// Blend three colors based on frequency strength
float total = u_bassStrength + u_midStrength + u_highStrength + 0.01;
vec3 blendedColor =
    (u_bassColor * u_bassStrength +
     u_midColor * u_midStrength +
     u_highColor * u_highStrength) / total;

finalColor = vec4(currentColor.rgb * blendedColor, currentColor.a);
```

**Result**: Color shifts smoothly between purple (bass), green (mids), and yellow (highs) based on which frequency dominates.

### Strategy: Spatial Color Gradients

**Concept**: Different screen regions show different colors.

**Shader Implementation**:
```glsl
// Add to fragment shader (after line 189)

// Radial gradient (center to edge)
vec2 center = vec2(0.5, 0.5);
float distFromCenter = distance(uv, center);

// Center = bass color, edge = high color
vec3 centerColor = u_bassColor;
vec3 edgeColor = u_highColor;

vec3 spatialColor = mix(centerColor, edgeColor, distFromCenter * 2.0);

// Apply with frequency modulation
float bassIntensity = u_bassStrength * 2.0;
vec3 finalBlend = mix(spatialColor, centerColor, bassIntensity);

// Later at line 293
finalColor = vec4(currentColor.rgb * finalBlend, currentColor.a);
```

**Vertical Gradient** (bass at bottom, high at top):
```glsl
float verticalPos = uv.y; // 0 at bottom, 1 at top

vec3 bottomColor = u_bassColor;   // Bass frequencies
vec3 topColor = u_highColor;      // High frequencies

vec3 spatialColor = mix(bottomColor, topColor, verticalPos);
```

**Horizontal Gradient** (sweeping across screen):
```glsl
float horizontalPos = uv.x; // 0 at left, 1 at right

// Animate the gradient with time
float gradientPos = fract(u_time * 0.1); // Scrolls left to right

// Create moving gradient
float gradientMask = smoothstep(gradientPos - 0.3, gradientPos, uv.x) *
                     (1.0 - smoothstep(gradientPos, gradientPos + 0.3, uv.x));

vec3 gradientColor = u_bassColor;
vec3 backgroundColor = u_midColor;

vec3 spatialColor = mix(backgroundColor, gradientColor, gradientMask);
```

### Strategy: Layer-Based Color

**Concept**: Edges, trails, and base texture each get different colors.

**Shader Implementation**:
```glsl
// After edge detection (line 287)
vec3 edgeColor = u_highColor;      // Highs = edge glow
vec3 trailColor = u_midColor;      // Mids = trail color
vec3 baseColor = u_bassColor;      // Bass = base tint

// Separate the components
float edgeStrength = length(sobel) * u_glowIntensity;
float trailStrength = u_trailAmount;
float baseStrength = 1.0 - edgeStrength;

// Blend
vec4 currentColor = texture2D(u_texture, uv);

vec3 finalColor =
    currentColor.rgb * baseColor * baseStrength +
    currentColor.rgb * trailColor * trailStrength +
    edgeColor * edgeStrength;

gl_FragColor = vec4(finalColor, currentColor.a);
```

---

## Color Accessibility

### Photosensitive Seizure Prevention

**Guidelines** (WCAG 2.1):
- No more than **3 flashes per second**
- Flash area < 25% of screen OR < 341x256 pixels
- Avoid red flashes (most dangerous)

**Implementation**:
```javascript
class FlashLimiter {
    constructor(maxFlashesPerSecond = 3) {
        this.maxInterval = 1000 / maxFlashesPerSecond; // 333ms for 3fps
        this.lastFlash = 0;
        this.lastColor = { h: 0, s: 0, l: 50 };
    }

    canFlash(newColor) {
        const now = performance.now();
        const timeSinceFlash = now - this.lastFlash;

        // Check if colors are dramatically different (potential flash)
        const hueDiff = Math.abs(newColor.h - this.lastColor.h);
        const lightDiff = Math.abs(newColor.l - this.lastColor.l);

        const isSignificantChange = hueDiff > 60 || lightDiff > 40;

        if (isSignificantChange) {
            if (timeSinceFlash < this.maxInterval) {
                return false; // Too soon, deny flash
            }
            this.lastFlash = now;
        }

        this.lastColor = newColor;
        return true;
    }
}

// Usage
const flashLimiter = new FlashLimiter();

function updateColor(newColor) {
    if (flashLimiter.canFlash(newColor)) {
        gl.uniform1f(hueLocation, newColor.h);
        gl.uniform1f(lightnessLocation, newColor.l);
    } else {
        // Use smoothed transition instead
        const smoothed = {
            h: lerpHue(currentColor.h, newColor.h, 0.1),
            s: currentColor.s + (newColor.s - currentColor.s) * 0.1,
            l: currentColor.l + (newColor.l - currentColor.l) * 0.1
        };
        gl.uniform1f(hueLocation, smoothed.h);
        gl.uniform1f(lightnessLocation, smoothed.l);
    }
}
```

### Motion Sickness Prevention

**Guidelines**:
- Avoid rapid color oscillation
- Provide "reduced motion" mode
- Limit saturation changes to < 50% per second

**Implementation**:
```javascript
class MotionSafeColors {
    constructor(reducedMotion = false) {
        this.reducedMotion = reducedMotion;
        this.maxSatChange = reducedMotion ? 10 : 50; // Per second
        this.lastSat = 50;
        this.lastUpdate = performance.now();
    }

    limitSaturation(targetSat) {
        const now = performance.now();
        const delta = (now - this.lastUpdate) / 1000; // Seconds

        const maxChange = this.maxSatChange * delta;
        const actualChange = targetSat - this.lastSat;

        if (Math.abs(actualChange) > maxChange) {
            // Clamp the change
            const sign = Math.sign(actualChange);
            targetSat = this.lastSat + sign * maxChange;
        }

        this.lastSat = targetSat;
        this.lastUpdate = now;
        return targetSat;
    }
}

// Detect user preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const safeColors = new MotionSafeColors(prefersReducedMotion);

// In draw loop
const safeSat = safeColors.limitSaturation(targetSaturation);
gl.uniform1f(saturationLocation, safeSat);
```

### Color Blindness Considerations

**Types**:
- **Protanopia** (1% of males): Red-blind
- **Deuteranopia** (1% of males): Green-blind
- **Tritanopia** (0.001%): Blue-blind

**Strategy - Use Lightness for Information**:
```javascript
// BAD: Red = bass, Green = mid (invisible to red-green colorblind)
const bassColor = { h: 0, s: 100, l: 50 };   // Red
const midColor = { h: 120, s: 100, l: 50 };  // Green

// GOOD: Use different lightness values
const bassColor = { h: 0, s: 100, l: 30 };   // Dark red
const midColor = { h: 120, s: 100, l: 70 };  // Bright green
// Even if hues look similar, light/dark is still visible
```

**Strategy - Add Redundancy**:
```javascript
// Don't just use color - also use:
// - Position (bass = bottom, high = top)
// - Size (bass = large, high = small)
// - Pattern (bass = solid, high = sparkly)
```

**Testing**:
Use color blindness simulators:
- Chrome DevTools > Rendering > Emulate vision deficiencies
- Online tools like Coblis or Color Oracle

---

## Advanced Color Techniques

### Technique 1: Procedural Color Palettes

**Concept**: Generate harmonious colors algorithmically.

**Implementation - Golden Ratio Hues**:
```javascript
// Golden angle ≈ 137.5° produces aesthetically pleasing spacing
const GOLDEN_ANGLE = 137.507764;

function generateGoldenPalette(count, baseSat = 70, baseLight = 60) {
    const palette = [];
    for (let i = 0; i < count; i++) {
        const hue = (i * GOLDEN_ANGLE) % 360;
        palette.push({ h: hue, s: baseSat, l: baseLight });
    }
    return palette;
}

// Usage
const palette = generateGoldenPalette(5);
// Result: [
//   { h: 0, s: 70, l: 60 },
//   { h: 137.5, s: 70, l: 60 },
//   { h: 275, s: 70, l: 60 },
//   { h: 52.5, s: 70, l: 60 },
//   { h: 190, s: 70, l: 60 }
// ]
// Evenly distributed, harmonious
```

### Technique 2: Spectral Color Mapping

**Concept**: Map frequencies to rainbow (like a real spectrum analyzer).

**Implementation**:
```javascript
// Map 20Hz - 20kHz logarithmically to 0° - 300° (avoid wrapping to red)
function frequencyToHue(frequency) {
    const minFreq = 20;
    const maxFreq = 20000;

    // Logarithmic mapping (human hearing is logarithmic)
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = Math.log10(Math.max(frequency, minFreq));

    const normalized = (logFreq - logMin) / (logMax - logMin);

    // Map to hue range (0-300° avoids red-to-red wrap)
    const hue = normalized * 300;

    return hue;
}

// Usage with FFT data
function getSpectralColor(fftData, sampleRate) {
    // Find dominant frequency
    let maxBin = 0;
    let maxValue = 0;
    for (let i = 0; i < fftData.length; i++) {
        if (fftData[i] > maxValue) {
            maxValue = fftData[i];
            maxBin = i;
        }
    }

    // Convert bin to frequency
    const frequency = maxBin * sampleRate / (fftData.length * 2);

    // Get hue
    const hue = frequencyToHue(frequency);

    // Saturation based on strength
    const sat = Math.min(100, maxValue * 150);

    // Lightness based on overall energy
    const avgEnergy = fftData.reduce((a, b) => a + b) / fftData.length;
    const light = 40 + avgEnergy * 40;

    return { h: hue, s: sat, l: light };
}
```

**Result**: Low bass = red/orange, mids = yellow/green, highs = blue/purple (like a real spectrum).

### Technique 3: Perceptual Lightness Correction

**Problem**: HSV lightness is not perceptually uniform.

**Solution**: Adjust based on hue.

```javascript
// Relative luminance of pure hues at V=100%, S=100%
const hueLuminance = {
    0: 0.299,    // Red
    60: 0.886,   // Yellow (brightest!)
    120: 0.587,  // Green
    180: 0.701,  // Cyan
    240: 0.114,  // Blue (darkest!)
    300: 0.413   // Magenta
};

function getPerceptualLuminance(hue) {
    // Interpolate between known values
    const keys = [0, 60, 120, 180, 240, 300, 360];
    const values = [0.299, 0.886, 0.587, 0.701, 0.114, 0.413, 0.299];

    for (let i = 0; i < keys.length - 1; i++) {
        if (hue >= keys[i] && hue <= keys[i + 1]) {
            const t = (hue - keys[i]) / (keys[i + 1] - keys[i]);
            return values[i] + (values[i + 1] - values[i]) * t;
        }
    }
    return 0.5;
}

function perceptuallyUniformColor(hue, targetLuminance = 0.5, sat = 100) {
    const hueLum = getPerceptualLuminance(hue);

    // Adjust value to achieve target luminance
    // Yellow needs lower V, blue needs higher V
    const adjustedValue = (targetLuminance / hueLum) * 100;
    const clampedValue = Math.max(20, Math.min(100, adjustedValue));

    return { h: hue, s: sat, v: clampedValue };
}

// Example:
perceptuallyUniformColor(60, 0.5);  // Yellow: { h: 60, s: 100, v: 56 }
perceptuallyUniformColor(240, 0.5); // Blue:   { h: 240, s: 100, v: 100 }
// Both appear equally bright despite different V values!
```

### Technique 4: Color Temperature

**Concept**: Warm (red/orange) vs cool (blue/cyan) colors evoke different moods.

**Implementation**:
```javascript
// Color temperature in Kelvin (like photography)
function kelvinToRGB(kelvin) {
    const temp = kelvin / 100;
    let r, g, b;

    // Red
    if (temp <= 66) {
        r = 255;
    } else {
        r = temp - 60;
        r = 329.698727446 * Math.pow(r, -0.1332047592);
        r = Math.max(0, Math.min(255, r));
    }

    // Green
    if (temp <= 66) {
        g = temp;
        g = 99.4708025861 * Math.log(g) - 161.1195681661;
    } else {
        g = temp - 60;
        g = 288.1221695283 * Math.pow(g, -0.0755148492);
    }
    g = Math.max(0, Math.min(255, g));

    // Blue
    if (temp >= 66) {
        b = 255;
    } else if (temp <= 19) {
        b = 0;
    } else {
        b = temp - 10;
        b = 138.5177312231 * Math.log(b) - 305.0447927307;
        b = Math.max(0, Math.min(255, b));
    }

    return { r: r / 255, g: g / 255, b: b / 255 };
}

// Map audio to temperature
function audioToTemperature(bass, high) {
    // Bass = warm (low kelvin), high = cool (high kelvin)
    const minTemp = 2000;  // Warm candlelight
    const maxTemp = 9000;  // Cool daylight

    const balance = high / (bass + high + 0.01); // 0 = all bass, 1 = all high
    const temp = minTemp + balance * (maxTemp - minTemp);

    return kelvinToRGB(temp);
}
```

### Technique 5: Color Harmony Rules

**Implementation - Automatic Harmony Generator**:
```javascript
class ColorHarmony {
    static complementary(hue) {
        return [(hue + 180) % 360];
    }

    static splitComplementary(hue) {
        const comp = (hue + 180) % 360;
        return [
            (comp - 30 + 360) % 360,
            (comp + 30) % 360
        ];
    }

    static triadic(hue) {
        return [
            (hue + 120) % 360,
            (hue + 240) % 360
        ];
    }

    static tetradic(hue) {
        return [
            (hue + 90) % 360,
            (hue + 180) % 360,
            (hue + 270) % 360
        ];
    }

    static analogous(hue, angle = 30) {
        return [
            (hue - angle + 360) % 360,
            (hue + angle) % 360
        ];
    }
}

// Usage - Generate palette from base hue
const baseHue = 330;
const harmonyHues = ColorHarmony.triadic(baseHue);

const palette = [
    { h: baseHue, s: 100, l: 50 },
    { h: harmonyHues[0], s: 100, l: 50 },
    { h: harmonyHues[1], s: 100, l: 50 }
];
// Guaranteed harmonious!
```

---

## Debugging Color Systems

### Visual Debug Overlay

**Implementation**:
```javascript
function drawColorDebugOverlay(ctx, colorState) {
    // Draw in corner of canvas
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 150);

    ctx.fillStyle = 'white';
    ctx.font = '12px monospace';
    ctx.fillText(`Hue: ${colorState.h.toFixed(1)}°`, 20, 30);
    ctx.fillText(`Sat: ${colorState.s.toFixed(1)}%`, 20, 50);
    ctx.fillText(`Light: ${colorState.l.toFixed(1)}%`, 20, 70);

    // Current color swatch
    const rgb = hsvToRgb(colorState);
    ctx.fillStyle = `rgb(${rgb.r*255}, ${rgb.g*255}, ${rgb.b*255})`;
    ctx.fillRect(20, 80, 160, 60);

    // RGB values
    ctx.fillStyle = 'white';
    ctx.fillText(`RGB: ${(rgb.r*255).toFixed(0)}, ${(rgb.g*255).toFixed(0)}, ${(rgb.b*255).toFixed(0)}`, 20, 155);

    ctx.restore();
}

// Usage in draw loop
if (debugMode) {
    const colorState = { h: currentHue, s: currentSat, l: currentLight };
    drawColorDebugOverlay(ctx, colorState);
}
```

### Color History Tracker

**Implementation**:
```javascript
class ColorHistory {
    constructor(maxSamples = 120) {
        this.maxSamples = maxSamples;
        this.history = [];
    }

    record(color) {
        this.history.push({
            ...color,
            timestamp: performance.now()
        });

        if (this.history.length > this.maxSamples) {
            this.history.shift();
        }
    }

    visualize(ctx, x, y, width, height) {
        const sampleWidth = width / this.maxSamples;

        this.history.forEach((sample, i) => {
            const rgb = hsvToRgb(sample);
            ctx.fillStyle = `rgb(${rgb.r*255}, ${rgb.g*255}, ${rgb.b*255})`;
            ctx.fillRect(x + i * sampleWidth, y, sampleWidth + 1, height);
        });

        // Draw labels
        ctx.strokeStyle = 'white';
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = 'white';
        ctx.font = '10px monospace';
        ctx.fillText('Color History (2 sec)', x, y - 5);
    }
}

// Usage
const history = new ColorHistory();

// In draw loop
history.record({ h: currentHue, s: currentSat, l: currentLight });

if (debugMode) {
    history.visualize(ctx, 10, 200, 300, 50);
}
```

### Color Space Visualizer

**Implementation**:
```javascript
function drawHSVWheel(ctx, x, y, radius, currentHue) {
    // Draw full color wheel
    for (let angle = 0; angle < 360; angle++) {
        const startAngle = (angle - 90) * Math.PI / 180;
        const endAngle = (angle + 1 - 90) * Math.PI / 180;

        const rgb = hsvToRgb({ h: angle, s: 100, v: 100 });
        ctx.fillStyle = `rgb(${rgb.r*255}, ${rgb.g*255}, ${rgb.b*255})`;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, radius, startAngle, endAngle);
        ctx.fill();
    }

    // Draw current hue indicator
    const angle = (currentHue - 90) * Math.PI / 180;
    const indicatorX = x + Math.cos(angle) * radius;
    const indicatorY = y + Math.sin(angle) * radius;

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 8, 0, Math.PI * 2);
    ctx.stroke();
}

// Usage
if (debugMode) {
    drawHSVWheel(ctx, 400, 100, 60, currentHue);
}
```

### Console Logging Best Practices

```javascript
// Color-coded console logs
function logColor(label, color) {
    const rgb = hsvToRgb(color);
    const bgColor = `rgb(${rgb.r*255}, ${rgb.g*255}, ${rgb.b*255})`;
    const textColor = color.l > 50 ? 'black' : 'white';

    console.log(
        `%c ${label} `,
        `background: ${bgColor}; color: ${textColor}; padding: 2px 5px; border-radius: 3px;`,
        `H:${color.h.toFixed(0)}° S:${color.s.toFixed(0)}% L:${color.l.toFixed(0)}%`
    );
}

// Usage
logColor('Bass Color', { h: 280, s: 100, l: 50 });
logColor('High Color', { h: 60, s: 100, l: 60 });
```

---

## Common Mistakes

### Mistake 1: Modulating Everything with the Same Signal

**Problem**:
```javascript
// ❌ BAD
const hue = baseHue + bass * 60;
const sat = baseSat + bass * 30;
const light = baseLight + bass * 20;
// Bass just makes everything "more" - no character
```

**Solution**:
```javascript
// ✅ GOOD
const hue = baseHue + high * 120;      // Highs control hue
const sat = baseSat + bass * 40;       // Bass controls saturation
const light = baseLight + mid * 15;    // Mids control lightness
// Each parameter has distinct musical meaning
```

### Mistake 2: Not Clamping Values

**Problem**:
```javascript
// ❌ BAD
const sat = baseSat + boostAmount;
gl.uniform1f(saturationLocation, sat); // Could be 150%!

// GLSL
vec3 hsv = vec3(u_hue / 360.0, u_saturation / 100.0, u_lightness / 100.0);
// u_saturation = 150, so hsv.y = 1.5 (invalid!)
```

**Solution**:
```javascript
// ✅ GOOD
const sat = Math.min(100, Math.max(0, baseSat + boostAmount));
gl.uniform1f(saturationLocation, sat);
```

### Mistake 3: Ignoring Hue Wrapping

**Problem**:
```javascript
// ❌ BAD
let hue = 350;
hue += 20; // hue = 370 (invalid, should be 10)
```

**Solution**:
```javascript
// ✅ GOOD
let hue = 350;
hue = (hue + 20) % 360; // hue = 10
```

### Mistake 4: Using RGB for Hue Rotation

**Problem**:
```javascript
// ❌ BAD - Trying to "rotate" RGB
const r = baseColor.r + offset;
const g = baseColor.g + offset;
const b = baseColor.b + offset;
// This just makes it brighter/darker, doesn't change hue!
```

**Solution**:
```javascript
// ✅ GOOD
const hsv = rgbToHsv(baseColor);
hsv.h = (hsv.h + offset) % 360;
const rgb = hsvToRgb(hsv);
```

### Mistake 5: Forgetting Perceptual Differences

**Problem**:
```javascript
// ❌ BAD - Assuming all hues at V=100% look equally bright
const colors = [
    { h: 60, s: 100, v: 100 },  // Yellow - looks very bright
    { h: 240, s: 100, v: 100 }  // Blue - looks much darker
];
// User perception: inconsistent brightness
```

**Solution**:
```javascript
// ✅ GOOD - Adjust V based on hue luminance
const colors = [
    { h: 60, s: 100, v: 70 },   // Yellow (reduced)
    { h: 240, s: 100, v: 100 }  // Blue (full)
];
// Now both appear similarly bright
```

### Mistake 6: Too Much Saturation

**Problem**:
```javascript
// ❌ BAD - Always at 100% saturation
const sat = 100;
// Result: Visually exhausting, no dynamic range
```

**Solution**:
```javascript
// ✅ GOOD - Leave headroom
const baseSat = 70;
const peakSat = 100;
const sat = baseSat + energyBurst * (peakSat - baseSat);
// Allows saturation to "breathe"
```

### Mistake 7: Ignoring Dark Areas

**Problem**:
```javascript
// Current implementation (line 293)
finalColor = vec4(currentColor.rgb * rgb, currentColor.a);
// If currentColor.rgb = (0, 0, 0), then finalColor = (0, 0, 0)
// Black parts stay black regardless of color!
```

**Solution**:
```glsl
// ✅ GOOD - Additive or screen blend
vec3 tint = hsv2rgb(hsv);

// Option A: Additive (brightens)
finalColor = vec4(currentColor.rgb + tint * 0.3, currentColor.a);

// Option B: Screen blend (lighter version of multiply)
vec3 screen = 1.0 - (1.0 - currentColor.rgb) * (1.0 - tint);
finalColor = vec4(screen, currentColor.a);

// Option C: Mix based on texture brightness
float brightness = dot(currentColor.rgb, vec3(0.299, 0.587, 0.114));
vec3 blended = mix(tint, currentColor.rgb * tint, brightness);
finalColor = vec4(blended, currentColor.a);
```

---

## Copy-Paste Snippets

### Snippet 1: Complete Audio-Reactive Color System

**Drop-in replacement for your current color code** (around line 591-593):

```javascript
// Enhanced audio-reactive color system
class AudioColorMapper {
    constructor(baseHue = 330, baseSat = 80, baseLight = 65) {
        this.baseHue = baseHue;
        this.baseSat = baseSat;
        this.baseLight = baseLight;

        // Smoothed values
        this.smoothedHue = baseHue;
        this.smoothedSat = baseSat;
        this.smoothedLight = baseLight;
    }

    update(bass, mid, high) {
        // Hue: High frequencies rotate toward cool colors
        const highHueShift = Math.pow(high, 1.5) * 90; // 0-90° shift
        const targetHue = (this.baseHue + highHueShift) % 360;

        // Saturation: Bass boost
        const bassSatBoost = Math.pow(bass, 2.5) * 30; // 0-30% boost
        const targetSat = Math.min(100, this.baseSat + bassSatBoost);

        // Lightness: Overall energy with high sparkle
        const energy = Math.sqrt((bass*bass + mid*mid + high*high) / 3);
        const sparkle = Math.pow(high, 2) * 15;
        const targetLight = Math.min(90, this.baseLight + energy * 15 + sparkle);

        // Smooth transitions
        this.smoothedHue = this.lerpHue(this.smoothedHue, targetHue, 0.15);
        this.smoothedSat += (targetSat - this.smoothedSat) * 0.1;
        this.smoothedLight += (targetLight - this.smoothedLight) * 0.12;

        return {
            h: this.smoothedHue,
            s: this.smoothedSat,
            l: this.smoothedLight
        };
    }

    lerpHue(current, target, speed) {
        let delta = target - current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        current = (current + delta * speed) % 360;
        if (current < 0) current += 360;
        return current;
    }
}

// Initialize once
const colorMapper = new AudioColorMapper(params.trailHue, params.trailSat, params.trailLight);

// In draw() function, replace lines 591-593
const color = colorMapper.update(smoothedBass, smoothedMid, high);
gl.uniform1f(hueLocation, color.h);
gl.uniform1f(saturationLocation, color.s);
gl.uniform1f(lightnessLocation, color.l);
```

### Snippet 2: Genre-Based Palette Switcher

```javascript
const palettes = {
    electronic: {
        bass: { h: 280, s: 100, l: 50 },
        mid: { h: 180, s: 100, l: 55 },
        high: { h: 60, s: 100, l: 60 }
    },
    rock: {
        bass: { h: 10, s: 85, l: 40 },
        mid: { h: 0, s: 90, l: 50 },
        high: { h: 180, s: 70, l: 65 }
    },
    ambient: {
        bass: { h: 200, s: 35, l: 45 },
        mid: { h: 220, s: 40, l: 55 },
        high: { h: 180, s: 45, l: 65 }
    }
};

let currentPalette = palettes.electronic; // Change based on song

function getPaletteColor(bass, mid, high) {
    const total = bass + mid + high + 0.01;

    // Blend palette colors based on frequency dominance
    const hue =
        (currentPalette.bass.h * bass +
         currentPalette.mid.h * mid +
         currentPalette.high.h * high) / total;

    const sat =
        (currentPalette.bass.s * bass +
         currentPalette.mid.s * mid +
         currentPalette.high.s * high) / total;

    const light =
        (currentPalette.bass.l * bass +
         currentPalette.mid.l * mid +
         currentPalette.high.l * high) / total;

    return { h: hue % 360, s: sat, l: light };
}

// Usage
const color = getPaletteColor(smoothedBass, smoothedMid, high);
gl.uniform1f(hueLocation, color.h);
gl.uniform1f(saturationLocation, color.s);
gl.uniform1f(lightnessLocation, color.l);
```

### Snippet 3: Beat-Synced Color Flash

```javascript
class BeatColorFlash {
    constructor(flashColor = { h: 0, s: 100, l: 80 }) {
        this.flashColor = flashColor;
        this.baseColor = { h: 330, s: 80, l: 65 };
        this.isFlashing = false;
        this.flashDecay = 0;
    }

    triggerFlash() {
        this.isFlashing = true;
        this.flashDecay = 1.0;
    }

    update(bass, isBeat) {
        if (isBeat && bass > 0.7) {
            this.triggerFlash();
        }

        if (this.isFlashing) {
            this.flashDecay *= 0.85; // Fast decay

            if (this.flashDecay < 0.01) {
                this.isFlashing = false;
                this.flashDecay = 0;
            }
        }

        // Blend flash color with base
        return {
            h: this.lerpHue(this.baseColor.h, this.flashColor.h, this.flashDecay),
            s: this.baseColor.s + (this.flashColor.s - this.baseColor.s) * this.flashDecay,
            l: this.baseColor.l + (this.flashColor.l - this.baseColor.l) * this.flashDecay
        };
    }

    lerpHue(current, target, t) {
        let delta = target - current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return (current + delta * t) % 360;
    }
}

// Usage
const flasher = new BeatColorFlash({ h: 60, s: 100, l: 90 }); // Yellow flash

// In draw loop
const isBeat = smoothedBass > avgBass * 1.4;
const color = flasher.update(smoothedBass, isBeat);
gl.uniform1f(hueLocation, color.h);
gl.uniform1f(saturationLocation, color.s);
gl.uniform1f(lightnessLocation, color.l);
```

### Snippet 4: Radial Color Gradient (Shader)

**Add to fragment shader** (replace line 290-293):

```glsl
// Calculate distance from center
vec2 center = vec2(0.5, 0.5);
float distFromCenter = distance(uv, center);

// Create radial gradient
// Center = base hue, edge = shifted hue
float hueShift = distFromCenter * 120.0; // 120° shift from center to edge
float finalHue = mod(u_hue / 360.0 + hueShift / 360.0, 1.0);

// Optionally: Audio-reactive gradient rotation
float rotation = u_time * 0.05; // Slow rotation
finalHue = mod(finalHue + rotation, 1.0);

vec3 hsv = vec3(finalHue, u_saturation / 100.0, u_lightness / 100.0);
vec3 rgb = hsv2rgb(hsv);

vec4 currentColor = texture2D(u_texture, uv);
vec3 finalColor = currentColor.rgb * rgb;

gl_FragColor = vec4(finalColor, currentColor.a);
```

### Snippet 5: HSV to RGB Helper (JavaScript)

```javascript
function hsvToRgb(hsv) {
    const h = hsv.h / 360;
    const s = hsv.s / 100;
    const v = (hsv.l || hsv.v) / 100;

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    let r, g, b;
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }

    return { r, g, b };
}

function rgbToHsv(rgb) {
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
        if (max === rgb.r) {
            h = ((rgb.g - rgb.b) / delta + (rgb.g < rgb.b ? 6 : 0)) / 6;
        } else if (max === rgb.g) {
            h = ((rgb.b - rgb.r) / delta + 2) / 6;
        } else {
            h = ((rgb.r - rgb.g) / delta + 4) / 6;
        }
    }

    const s = max === 0 ? 0 : delta / max;
    const v = max;

    return { h: h * 360, s: s * 100, v: v * 100 };
}
```

---

## Progression Path

### Beginner (1-2 hours)

**Goal**: Understand current color system and add basic audio-reactivity.

**Checklist**:
- [ ] Read "Your Current Implementation" section
- [ ] Understand HSV vs RGB difference
- [ ] Try "Quick Start" snippet (bass-reactive saturation)
- [ ] Test with different music genres
- [ ] Experiment with hue parameter (0-360°)

**Expected Result**: Colors pulse with music, basic understanding of color spaces.

### Intermediate (3-5 hours)

**Goal**: Implement multi-parameter audio-reactive color system.

**Checklist**:
- [ ] Read "Audio-Reactive Color Strategies" section
- [ ] Implement Snippet 1 (complete audio-reactive system)
- [ ] Test hue rotation with high frequencies
- [ ] Add saturation boost on bass hits
- [ ] Create custom palette for your music style
- [ ] Learn about color harmony (complementary, analogous, etc.)

**Expected Result**: Distinct color behavior for bass/mid/high, smooth transitions, genre-appropriate palette.

### Advanced (5-10 hours)

**Goal**: Genre-specific palettes, beat detection, advanced transitions.

**Checklist**:
- [ ] Read "Genre-Specific Color Palettes" section
- [ ] Implement palette switching system
- [ ] Add beat detection with color flash
- [ ] Create custom color sequencer for song structure
- [ ] Experiment with spatial gradients (radial/vertical)
- [ ] Add color accessibility features (flash limiter)

**Expected Result**: Professional-looking color system that responds musically to different genres and song structure.

### Expert (10+ hours)

**Goal**: Procedural palettes, perceptual corrections, multi-layer color.

**Checklist**:
- [ ] Read "Advanced Color Techniques" section
- [ ] Implement spectral color mapping
- [ ] Add perceptual lightness correction
- [ ] Create procedural palette generator
- [ ] Implement multi-layer color (edges/trails/base)
- [ ] Build color history visualizer for debugging
- [ ] Optimize performance for mobile

**Expected Result**: Sophisticated color system with scientific accuracy, perfect harmony, and optimal performance.

---

## References

### Color Theory
- **Book**: "Interaction of Color" by Josef Albers
- **Book**: "The Elements of Color" by Johannes Itten
- **Web**: Adobe Color (color.adobe.com) - Palette generator
- **Web**: Paletton (paletton.com) - Color scheme designer

### Audio Visualization
- **Article**: "The Art and Science of Music Visualization" (Dataviz Weekly)
- **Tool**: Sonic Visualiser - Analyze audio spectrally
- **Reference**: "Audio-Driven Procedural Animation" (GPU Gems)

### Accessibility
- **Standard**: WCAG 2.1 (Web Content Accessibility Guidelines)
- **Tool**: Color Oracle - Color blindness simulator
- **Article**: "Designing Safer Web Animation For Motion Sensitivity" (A List Apart)

### WebGL/Shaders
- **Book**: "The Book of Shaders" by Patricio Gonzalez Vivo
- **Reference**: "GPU Gems" series (NVIDIA)
- **Tool**: Shadertoy.com - GLSL experimentation

### Implementation Examples
- Look at existing music visualizers:
  - Milkdrop (Winamp) - Classic audio-reactive visuals
  - Plane9 - Modern procedural visualizer
  - GLSL Sandbox - Community shader examples

---

## Next Steps

Now that you understand color theory for audio visualization:

1. **Try the Quick Start** - Get immediate results in 5 minutes
2. **Experiment** - Try different base hues and audio mappings
3. **Create Palettes** - Design genre-specific color schemes
4. **Test Accessibility** - Ensure safe viewing experience
5. **Debug Visually** - Use debug overlays to understand behavior

**Related Guides**:
- **Audio-Reactive Design Patterns** - For mapping audio to any parameter
- **Advanced Distortion Mathematics** - For combining color with distortion effects
- **Shader Optimization Techniques** - For optimizing color conversions

---

**Remember**: Color is emotional. The "right" color isn't just mathematically correct - it's the one that makes the music *feel* right. Trust your eyes and ears!

# Effect Composition & Layering

**A comprehensive guide to combining multiple visual effects into cohesive compositions**

> **Purpose**: Master the art of layering, blending, and composing multiple effects to create complex visuals greater than the sum of their parts.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Glossary](#glossary)
3. [Your Current Composition](#your-current-composition)
4. [Effect Pipeline Architecture](#effect-pipeline-architecture)
5. [Blending Modes](#blending-modes)
6. [Layer Organization](#layer-organization)
7. [Render Order](#render-order)
8. [Masking & Isolation](#masking--isolation)
9. [Multi-Pass Rendering](#multi-pass-rendering)
10. [Effect Interactions](#effect-interactions)
11. [Performance Considerations](#performance-considerations)
12. [Composition Patterns](#composition-patterns)
13. [Common Mistakes](#common-mistakes)
14. [Copy-Paste Compositions](#copy-paste-compositions)
15. [Progression Path](#progression-path)

---

## Quick Start

**Improve your composition in 5 minutes:**

### 1. Understand Your Current Pipeline
Your effects execute in this order:
```
1. Distortion (UV warping)
2. Rotation & Scale
3. Texture Sample
4. Edge Detection (Sobel)
5. Grayscale Conversion
6. Color Tinting (complementary)
7. Trail Accumulation
8. Noise Multiplication
9. Color Inversion (optional)
```

### 2. Try This First
**Add layer separation for more control:**

```glsl
// Current: Everything blended together
vec3 finalColor = normalColor + trails;

// Enhanced: Separate layers
vec3 baseLayer = normalColor;          // Grayscale + texture color
vec3 trailLayer = trails;              // Colored trails
vec3 edgeLayer = coloredEdge;          // Edge glow
vec3 noiseLayer = vec3(noiseValue);    // Noise texture

// Compose with weights
vec3 finalColor =
    baseLayer * 1.0 +
    trailLayer * u_trailStrength +    // Control trail intensity
    edgeLayer * u_edgeStrength +      // Control edge intensity
    baseLayer * (noiseLayer * 0.4);   // Noise modulates base

// Now each layer is independently controllable!
```

### 3. Test Results
- Adjust `u_trailStrength` (0-2) → Control trail visibility
- Adjust `u_edgeStrength` (0-2) → Control edge glow
- Better balance between layers

---

## Glossary

### Composition Terms

- **Layer**: Single visual element (base image, trails, edges, etc.)
- **Composition**: Combining multiple layers into final image
- **Blending**: Method of combining two layers (add, multiply, screen, etc.)
- **Alpha**: Transparency value (0 = transparent, 1 = opaque)
- **Premultiplied Alpha**: Color already multiplied by alpha (common in WebGL)
- **Porter-Duff**: Standard set of compositing operations

### Blending Modes

- **Additive**: A + B. Brightens, can clip to white
- **Multiplicative**: A × B. Darkens, blacks stay black
- **Screen**: 1 - (1-A)(1-B). Brightens without clipping
- **Overlay**: Combination of multiply and screen based on luminance
- **Mix/Lerp**: Linear interpolation between two values
- **Over**: Porter-Duff "over" operator (standard alpha blending)

### Render Terms

- **Single-Pass**: All effects computed in one shader execution
- **Multi-Pass**: Effects computed across multiple render passes
- **Render Target**: Destination for rendering (screen or framebuffer)
- **Intermediate Buffer**: Temporary texture for multi-pass effects
- **Post-Processing**: Effects applied after main rendering

### Layer Types

- **Base Layer**: Foundation image/texture
- **Effect Layer**: Visual effect (glow, trails, distortion)
- **Mask Layer**: Controls where other layers appear
- **Adjustment Layer**: Modifies layers below (color correction, blur)
- **Composite Layer**: Result of combining multiple layers

---

## Your Current Composition

### Complete Effect Flow Analysis

**Lines 186-335: Fragment Shader Pipeline**

```
INPUT: v_texCoord (UV coordinates)
  ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: SPATIAL DISTORTION                                 │
│ Lines 191-247                                               │
│   • 5 distortion types (sin waves, glitch, etc.)           │
│   • Modifies UV coordinates                                │
│   Output: distortedUV                                       │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: GEOMETRIC TRANSFORMATION                           │
│ Lines 249-250                                               │
│   • Rotation around center                                 │
│   • Scale (zoom in/out)                                    │
│   Output: rotated UV                                        │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: BASE TEXTURE SAMPLE                                │
│ Line 253                                                    │
│   • Sample SVG texture with transformed UV                 │
│   Output: texColor (RGBA)                                   │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: EDGE DETECTION                                     │
│ Lines 256-266                                               │
│   • Sobel operator (4 extra texture samples)              │
│   • Calculates edge intensity                             │
│   Output: edge (0-1, smoothstepped)                        │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5: BASE COLOR CONSTRUCTION                            │
│ Lines 269-273                                               │
│   • Convert to grayscale                                   │
│   • Mix black background with grayscale texture            │
│   Output: normalColor (grayscale composite)                │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 6: TEXTURE COLORIZATION                               │
│ Lines 276-289                                               │
│   • Compute complementary color (HSV +180°)                │
│   • Apply glow boost                                       │
│   • Mix into bright areas of texture                       │
│   Output: normalColor (updated with color)                 │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 7: EDGE GLOW                                          │
│ Lines 292-302                                               │
│   • Shift trail color hue                                 │
│   • Boost saturation and brightness                        │
│   • Create colored edge from shifted color                 │
│   • ADD to normalColor                                     │
│   Output: normalColor (with edge glow added)               │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 8: TRAIL ACCUMULATION                                 │
│ Lines 305-313                                               │
│   • Sample previous frame (ping-pong buffer)               │
│   • Decay old trails                                       │
│   • Generate new trails from brightness                    │
│   • Combine decayed + new                                  │
│   Output: trails (accumulated over time)                   │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 9: TRAIL COMPOSITING                                  │
│ Line 316                                                    │
│   • ADD trails to image                                    │
│   Output: finalColor = normalColor + trails                │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 10: NOISE MODULATION                                  │
│ Lines 319-323                                               │
│   • Generate 3D noise                                      │
│   • MULTIPLY finalColor by noise (0.8-1.2 range)          │
│   Output: finalColor (noise-modulated)                     │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 11: COLOR INVERSION (OPTIONAL)                        │
│ Lines 326-332                                               │
│   • If enabled, invert non-black colors                   │
│   Output: finalColor (optionally inverted)                 │
└─────────────────────────────────────────────────────────────┘
  ↓
OUTPUT: gl_FragColor (final RGBA)
```

### Layer Dependency Graph

```
UV Coordinates
  ↓
Distortion ──────→ Rotation ──────→ Texture Sample
                                         ↓
                                    ┌────┴────┐
                                    │         │
                              Edge Detection Grayscale
                                    │         │
                                    └────┬────┘
                                         ↓
                                  Base Color ←── Background
                                         ↓
                                  Colorization ←── Trail Color (HSV)
                                         ↓
                                   Edge Glow ←── Shifted Trail Color
                                         ↓
                                   Normal Color
                                         ↓
                          ┌──────────────┼──────────────┐
                          │              │              │
                    Previous Frame   Brightness    New Content
                          │              │              │
                          └──────────────┼──────────────┘
                                         ↓
                                      Trails
                                         ↓
                                   Composition ←── Normal + Trails
                                         ↓
                                   Noise Modulation
                                         ↓
                                  Color Inversion
                                         ↓
                                    Final Color
```

### Blend Operations Used

| Layer | Blend Mode | Formula | Effect |
|-------|------------|---------|--------|
| **Background + Texture** | mix() | `mix(bgColor, grayscale, alpha)` | Standard alpha blend |
| **Color Tint** | mix() | `mix(base, tint * gray, amount)` | Color based on brightness |
| **Edge Glow** | Additive | `normalColor += coloredEdge` | Brightens edges |
| **Trails** | Additive | `finalColor = normalColor + trails` | Accumulates over time |
| **Noise** | Multiplicative | `finalColor *= (0.8 + noise * 0.4)` | Modulates brightness |
| **Inversion** | Subtract from 1 | `1.0 - finalColor` | Inverts colors |

### Visual Representation

**Layer Stack** (bottom to top):
```
┌─────────────────────────────────────┐  ← Output
│  COLOR INVERSION (optional)         │
├─────────────────────────────────────┤
│  NOISE (multiply, 0.8-1.2)          │  ░░▒▒▓▓████▓▓▒▒░░
├─────────────────────────────────────┤
│  TRAILS (additive)                  │  ════════════════════
├─────────────────────────────────────┤
│  EDGE GLOW (additive)               │  ─────╔══╗──────────
├─────────────────────────────────────┤
│  COLORIZED TEXTURE                  │  ████████████████
├─────────────────────────────────────┤
│  GRAYSCALE TEXTURE                  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
├─────────────────────────────────────┤
│  BLACK BACKGROUND                   │  ░░░░░░░░░░░░░░░░
└─────────────────────────────────────┘
```

### Strengths of Current Composition

1. **Clear Pipeline**: Sequential processing, easy to understand
2. **Efficient**: Single-pass rendering (all in one shader)
3. **Temporal Coherence**: Trails connect frames smoothly
4. **Modulation**: Noise affects entire image uniformly
5. **Controlled Brightness**: Additive layers can brighten but carefully controlled

### Improvement Opportunities

1. **Layer Independence**: Hard to control individual layer strength
2. **Fixed Blend Modes**: Can't easily switch between additive/multiply
3. **No Masking**: Can't isolate effects to specific regions
4. **Limited Layering**: All effects global, no spatial selectivity
5. **Coupled Effects**: Edge glow tied to trail color

---

## Effect Pipeline Architecture

### Single-Pass vs Multi-Pass

**Single-Pass** (your current):
```glsl
void main() {
    // All effects in one shader
    vec2 uv = distort(v_texCoord);
    vec4 color = texture2D(u_texture, uv);
    color = edgeDetect(color);
    color = addTrails(color);
    color = addNoise(color);
    gl_FragColor = color;
}

Pros:
  ✅ Fast (no texture transfers)
  ✅ Simple (one shader)
  ✅ Low memory (no intermediate buffers)

Cons:
  ❌ Hard to reuse effects
  ❌ Coupled dependencies
  ❌ Can't reorder easily
```

**Multi-Pass**:
```javascript
// Pass 1: Distortion
renderToBuffer(distortionBuffer, distortionShader);

// Pass 2: Edge detection
renderToBuffer(edgeBuffer, edgeShader, distortionBuffer);

// Pass 3: Trails
renderToBuffer(trailBuffer, trailShader, edgeBuffer);

// Pass 4: Final composite
renderToScreen(compositeShader, [distortionBuffer, edgeBuffer, trailBuffer]);

Pros:
  ✅ Modular (independent effects)
  ✅ Reusable (effects are separate shaders)
  ✅ Flexible (easy to reorder/disable)

Cons:
  ❌ Slower (multiple render passes)
  ❌ More memory (intermediate buffers)
  ❌ More complex (multiple shaders)
```

### When to Use Multi-Pass

**Use multi-pass when**:
- Effects need to be independently controllable
- Reusing effect results multiple times
- Effect order needs to change dynamically
- Individual effects are complex (blur, etc.)
- Need to debug layers in isolation

**Stick with single-pass when**:
- Performance critical (mobile)
- Effects are simple and coupled
- Clear dependency chain
- No need to reuse intermediate results

**Your case**: Single-pass is appropriate for performance ✅

### Pipeline Patterns

**Linear Pipeline** (your current):
```
A → B → C → D → Output

Example:
Distortion → Texture → Edges → Trails → Output

Pros: Simple, predictable
Cons: No branching, no recombination
```

**Branching Pipeline**:
```
       ┌→ B1 ┐
   A ──┼→ B2 ┼→ C → Output
       └→ B3 ┘

Example:
Texture → [Edge Detection, Blur, Sharpen] → Composite → Output

Pros: Parallel processing, rich detail
Cons: More complex, needs multi-pass
```

**Recombining Pipeline**:
```
   A → B ┐
   ↓     ↓
   C → D → Output

Example:
Texture → Edge ┐
  ↓             ↓
Blur → Trails → Composite → Output

Pros: Layered detail, flexible
Cons: Complex dependencies
```

---

## Blending Modes

### Additive Blending

**Formula**: `C = A + B`

**Characteristics**:
- Brightens image
- Can exceed 1.0 (white clipping)
- Commutative (A+B = B+A)
- Black = identity (A+0 = A)

**Your usage** (lines 302, 316):
```glsl
normalColor += coloredEdge;     // Add edge glow
finalColor = normalColor + trails;  // Add trails
```

**Effect**:
```
Base:   ░░░░████████░░░░
Trails: ════════════════════
Result: ░░░░████████════════ (brightened)

Warning: Can clip to white if both are bright
```

**Alternatives**:
```glsl
// Clamped additive (prevent clipping)
finalColor = min(normalColor + trails, vec3(1.0));

// Weighted additive (control contribution)
finalColor = normalColor + trails * 0.5;

// Soft additive (reduces clipping)
finalColor = normalColor + trails * (1.0 - normalColor);
```

### Multiplicative Blending

**Formula**: `C = A × B`

**Characteristics**:
- Darkens image (unless multiplying by > 1)
- Cannot brighten (max output = min input)
- White = identity (A×1 = A)
- Black = absorb (A×0 = 0)

**Your usage** (line 322):
```glsl
finalColor *= 0.8 + noiseValue * 0.4;  // Range 0.8-1.2
```

**Effect**:
```
Color:  ████████████████
Noise:  ░▒▓█▓▒░░▒▓█▓▒░  (0.8-1.2)
Result: ▓▓███████▓▓▓▓███  (modulated)

Notice: Darkens in dark noise areas, brightens in bright areas
```

**Variations**:
```glsl
// Standard multiply (darkens)
color *= texture.rgb;

// Inverse multiply (brightens)
color *= 1.0 + texture.rgb;

// Contrast multiply
color *= 0.5 + texture.rgb * 1.0;  // 0.5-1.5 range
```

### Screen Blending

**Formula**: `C = 1 - (1-A)(1-B)`

**Characteristics**:
- Brightens without clipping
- Opposite of multiply
- Preserves bright areas from both
- Never darker than either input

**Implementation**:
```glsl
vec3 screen(vec3 a, vec3 b) {
    return 1.0 - (1.0 - a) * (1.0 - b);
}

// Usage
vec3 result = screen(baseColor, glowLayer);
```

**Comparison**:
```
Additive:   A + B           (can clip)
Screen:     1 - (1-A)(1-B)  (never clips)

Base:   0.8, Glow: 0.6
  Additive: 1.4 → 1.0 (clipped)
  Screen:   0.92 (preserved detail)
```

### Overlay Blending

**Formula**:
```glsl
vec3 overlay(vec3 a, vec3 b) {
    vec3 result;
    for (int i = 0; i < 3; i++) {
        if (a[i] < 0.5) {
            result[i] = 2.0 * a[i] * b[i];           // Multiply dark areas
        } else {
            result[i] = 1.0 - 2.0 * (1.0-a[i]) * (1.0-b[i]);  // Screen bright areas
        }
    }
    return result;
}
```

**Effect**: Increases contrast, preserves highlights and shadows

### Mix (Lerp) Blending

**Formula**: `C = A × (1-t) + B × t`

**Your usage** (line 273):
```glsl
vec3 normalColor = mix(u_bgColor, grayscaleTexture, texColor.a);
// If alpha=0: bgColor
// If alpha=1: grayscaleTexture
// If alpha=0.5: 50/50 blend
```

**Weighted Mix**:
```glsl
// Control blend amount
float weight = 0.7;  // 70% A, 30% B
vec3 result = mix(A, B, weight);

// Audio-reactive mix
float weight = 0.5 + u_bass * 0.5;  // 0.5-1.0
vec3 result = mix(A, B, weight);
```

### Alpha Blending (Over Operator)

**Premultiplied Alpha**:
```glsl
// Standard over operator
vec4 over(vec4 src, vec4 dst) {
    vec3 rgb = src.rgb + dst.rgb * (1.0 - src.a);
    float a = src.a + dst.a * (1.0 - src.a);
    return vec4(rgb, a);
}
```

**Your usage** (implicit in line 273):
```glsl
mix(u_bgColor, grayscaleTexture, texColor.a)
// Equivalent to:
// u_bgColor * (1-alpha) + grayscaleTexture * alpha
```

### Blend Mode Comparison

| Mode | Formula | Brightens | Darkens | Clips | Use Case |
|------|---------|-----------|---------|-------|----------|
| **Add** | A + B | ✅ | ❌ | ✅ | Lights, glows, energy |
| **Multiply** | A × B | ❌ | ✅ | ❌ | Shadows, tinting |
| **Screen** | 1-(1-A)(1-B) | ✅ | ❌ | ❌ | Bright effects, safe glow |
| **Overlay** | Mix of × and screen | Both | Both | ❌ | Contrast, texture blend |
| **Mix** | A(1-t)+Bt | Both | Both | ❌ | Crossfades, alpha blend |

---

## Layer Organization

### Layer Types in Your Shader

**Base Layers** (foundation):
```glsl
// 1. Background (line 273)
vec3 base = u_bgColor;  // Solid black

// 2. Grayscale texture (line 270)
vec3 grayscale = vec3(gray);

// Composite
vec3 normalColor = mix(base, grayscale, texColor.a);
```

**Effect Layers** (enhancements):
```glsl
// 3. Colorization (lines 276-289)
vec3 tint = hsv2rgb(textureColorHSV);
normalColor = mix(normalColor, tint * gray, colorMixAmount);

// 4. Edge glow (lines 301-302)
vec3 edgeGlow = shiftedTrailColor * edge * 1.5;
normalColor += edgeGlow;  // Additive

// 5. Trails (lines 305-313)
vec3 trails = decayedTrail + newTrail;
finalColor = normalColor + trails;  // Additive

// 6. Noise (lines 319-322)
float noise = noiseValue;
finalColor *= 0.8 + noise * 0.4;  // Multiplicative
```

**Adjustment Layers** (global modifications):
```glsl
// 7. Color inversion (lines 326-332)
if (u_invertColors && luminance > 0.1) {
    finalColor = 1.0 - finalColor;
}
```

### Improved Layer Organization

**Separate into explicit layers**:
```glsl
// Define layers clearly
struct Layers {
    vec3 background;
    vec3 texture;
    vec3 colorTint;
    vec3 edges;
    vec3 trails;
    vec3 noise;
};

Layers layers;

// Populate layers
layers.background = u_bgColor;
layers.texture = vec3(gray) * texColor.a;
layers.colorTint = textureColor * gray * colorMixAmount;
layers.edges = shiftedTrailColor * edge * 1.5;
layers.trails = decayedTrail + newTrail;
layers.noise = vec3(0.8 + noiseValue * 0.4);

// Compose with explicit control
vec3 finalColor =
    layers.background +
    layers.texture +
    layers.colorTint +
    layers.edges * u_edgeStrength +
    layers.trails * u_trailStrength;

// Apply noise as modulation
finalColor *= layers.noise;
```

**Benefits**:
- Clear separation of concerns
- Easy to debug individual layers
- Independent control via uniforms
- Can reorder more easily

---

## Render Order

### Why Order Matters

**Example: Blur then Edge vs Edge then Blur**

```glsl
// Order 1: Edge → Blur
vec4 tex = texture2D(u_texture, uv);
float edge = detectEdge(tex);
float blurred = blur(edge);  // Blurry edges

// Order 2: Blur → Edge
vec4 tex = texture2D(u_texture, uv);
float blurred = blur(tex);
float edge = detectEdge(blurred);  // Sharp edge of blurred image

// Result: Completely different!
```

**Your order** (correct for your goals):
```
1. Distortion (spatial)
2. Rotation/Scale (geometric)
3. Texture Sample (foundation)
4. Edge Detection (from clean texture)
5. Color/Trails (build up layers)
6. Noise (global modulation)
7. Inversion (final adjustment)

This order makes sense because:
  ✅ Spatial transforms before sampling (correct UV usage)
  ✅ Edge detect from clean texture (before effects muddy it)
  ✅ Noise modulates final result (affects everything equally)
```

### Commutative vs Non-Commutative

**Commutative** (order doesn't matter):
```glsl
// These produce same result:
color = color + glow + trails;
color = color + trails + glow;
color = trails + glow + color;

// Additive operations commute
```

**Non-Commutative** (order matters):
```glsl
// These produce different results:
color = color * 0.5 * noise;  // Half brightness, then noise
color = color * noise * 0.5;  // Noise, then half brightness

// Multiplication is commutative, but visual result feels different
// if you think of them as sequential operations

// This is definitely non-commutative:
color = blur(edge(color));  // ≠ edge(blur(color))
```

**Your pipeline non-commutative examples**:
```glsl
// ❌ Wrong order
noise → edge detection
// Edge detection would find noise patterns, not actual edges!

// ✅ Correct order
edge detection → noise
// Edge detection finds real edges, noise modulates result

// ❌ Wrong order
trails → distortion
// Trails would be warped/broken

// ✅ Correct order
distortion → trails
// Trails accumulate after distortion
```

---

## Masking & Isolation

### What is Masking?

**Concept**: Control where effects are applied.

**Basic mask**:
```glsl
float mask = step(0.5, uv.x);  // 0 on left half, 1 on right half
vec3 effect = glowEffect();
color = mix(color, effect, mask);
// Effect only on right half
```

### Spatial Masks

**Circular mask**:
```glsl
float dist = distance(uv, vec2(0.5));
float mask = 1.0 - smoothstep(0.2, 0.4, dist);
// 1.0 in center, 0.0 at edges

// Apply effect only in center
vec3 effect = noisyEffect();
color = mix(color, effect, mask);
```

**Radial gradient mask**:
```glsl
float dist = length(uv - vec2(0.5));
float mask = 1.0 - dist * 2.0;  // 1.0 at center, 0.0 at corners
mask = clamp(mask, 0.0, 1.0);

// Apply trails more in center
trails *= mask;
```

### Luminance Masks

**Affect only bright or dark areas**:
```glsl
// Luminance
float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

// Bright areas mask
float brightMask = smoothstep(0.5, 0.8, lum);

// Dark areas mask
float darkMask = 1.0 - smoothstep(0.2, 0.5, lum);

// Apply glow only to bright areas
vec3 glow = color * 2.0;
color = mix(color, glow, brightMask);
```

**Your implicit masking** (line 288):
```glsl
float colorMixAmount = gray * texColor.a * (0.8 + u_glowIntensity * 0.5);
// Color only applied where:
//   - Texture is bright (gray)
//   - Texture is opaque (texColor.a)
//   - Glow is active (u_glowIntensity)
```

### Edge Masks

**Affect only edges**:
```glsl
// You already compute edge (line 266)
float edge = smoothstep(0.1, 0.5, edgeIntensity);

// Use as mask for other effects
vec3 edgeGlow = glowColor * edge;  // Only at edges
```

### Audio-Reactive Masks

**Bass-driven mask**:
```glsl
// Create mask from bass
float bassMask = smoothstep(0.3, 0.7, u_bass);

// Apply effect only when bass hits
vec3 pulsEffect = color * 1.5;
color = mix(color, pulsEffect, bassMask);
```

**Frequency-based spatial mask**:
```glsl
// Different frequencies in different regions
float centerDist = length(uv - vec2(0.5));

// Bass in center
float bassMask = (1.0 - centerDist) * u_bass;

// Highs at edges
float highMask = centerDist * u_high;

// Apply different colors
color += bassColor * bassMask;
color += highColor * highMask;
```

---

## Multi-Pass Rendering

### When You Need Multi-Pass

**Your current shader** is single-pass, but these effects would benefit from multi-pass:

1. **Blur**: Requires separable passes (horizontal then vertical)
2. **Complex trails**: Multiple feedback taps from different frames
3. **Independent layer control**: Render each layer to texture, composite later
4. **Reusable effects**: Apply same effect to multiple sources

### Multi-Pass Architecture

**Example: Adding Blur**

```javascript
// Create buffers
const blurBuffer1 = createFramebuffer(width, height);
const blurBuffer2 = createFramebuffer(width, height);

function render() {
    // Pass 1: Render main effect to buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurBuffer1);
    gl.useProgram(mainShader);
    drawQuad();

    // Pass 2: Horizontal blur
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurBuffer2);
    gl.useProgram(blurShaderH);
    gl.bindTexture(gl.TEXTURE_2D, blurBuffer1.texture);
    drawQuad();

    // Pass 3: Vertical blur
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);  // Screen
    gl.useProgram(blurShaderV);
    gl.bindTexture(gl.TEXTURE_2D, blurBuffer2.texture);
    drawQuad();
}
```

**Cost**: 3× draw calls, 2× intermediate buffers

### Multi-Layer Compositing

**Example: Separate Edge and Trail Layers**

```javascript
// Buffers
const baseBuffer = createFramebuffer();
const edgeBuffer = createFramebuffer();
const trailBuffer = createFramebuffer();

function render() {
    // Render base (texture + color)
    renderToBuffer(baseBuffer, baseShader);

    // Render edges (independent)
    renderToBuffer(edgeBuffer, edgeShader, baseBuffer.texture);

    // Render trails (independent)
    renderToBuffer(trailBuffer, trailShader, baseBuffer.texture);

    // Composite all layers
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(compositeShader);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, baseBuffer.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, edgeBuffer.texture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, trailBuffer.texture);

    // Composite shader
    gl.uniform1i(baseTexLocation, 0);
    gl.uniform1i(edgeTexLocation, 1);
    gl.uniform1i(trailTexLocation, 2);
    drawQuad();
}
```

**Composite shader**:
```glsl
uniform sampler2D u_base;
uniform sampler2D u_edges;
uniform sampler2D u_trails;
uniform float u_edgeStrength;
uniform float u_trailStrength;

void main() {
    vec3 base = texture2D(u_base, v_texCoord).rgb;
    vec3 edges = texture2D(u_edges, v_texCoord).rgb;
    vec3 trails = texture2D(u_trails, v_texCoord).rgb;

    // Composite with individual control
    vec3 color = base +
                 edges * u_edgeStrength +
                 trails * u_trailStrength;

    gl_FragColor = vec4(color, 1.0);
}
```

**Benefits**:
- Independent layer strength control
- Can disable layers completely
- Can add new layers without changing existing shaders
- Easier to debug (render layers individually)

**Costs**:
- 4× draw calls
- 3× framebuffers (memory)
- ~30% slower

---

## Effect Interactions

### Constructive Interactions

**When effects enhance each other**:

**Edge + Trails**:
```glsl
// Edges create bright trails (your current implementation)
vec3 edges = detectEdges(texture);
vec3 trails = accumulateTrails(edges + texture);
// Result: Persistent glowing outlines ✅
```

**Noise + Color**:
```glsl
// Noise breaks up flat colors
vec3 color = applyColor(texture);
color *= noise(uv, time);
// Result: Organic, textured color ✅
```

**Distortion + Rotation**:
```glsl
// Distortion creates organic shapes, rotation animates them
vec2 uv = distort(coords);
uv = rotate(uv, angle);
// Result: Flowing, spinning patterns ✅
```

### Destructive Interactions

**When effects fight each other**:

**Too much noise on edges**:
```glsl
// ❌ Edges become noisy, lose definition
float edge = detectEdge(texture);
edge *= noise(uv);  // Noise breaks edge continuity
// Result: Broken, flickering edges
```

**Trails on high-frequency noise**:
```glsl
// ❌ Noise changes every frame, trails try to accumulate
float n = noise(uv, time);  // Different each frame
trails += n;
// Result: Chaotic, unreadable trails
```

**Extreme distortion + edge detection**:
```glsl
// ❌ Distortion creates false edges
vec2 uv = distort(coords, 10.0);  // Extreme warp
float edge = detectEdge(texture2D(u_tex, uv));
// Result: Detecting distortion artifacts, not real edges
```

### Mitigating Destructive Interactions

**Limit effect intensity**:
```glsl
// Instead of applying noise directly to edges
edge *= noise(uv);

// Apply subtle noise
edge *= 0.9 + noise(uv) * 0.1;  // 90-110%
```

**Order effects carefully**:
```glsl
// ❌ Wrong order
vec3 color = applyTrails(applyNoise(texture));
// Trails accumulate noise (chaotic)

// ✅ Correct order
vec3 color = applyNoise(applyTrails(texture));
// Trails form, then noise modulates (controlled)
```

**Use masking to isolate**:
```glsl
// Only apply noise where it won't hurt edges
float edgeMask = 1.0 - edge;
color *= mix(1.0, noise, edgeMask);
// Noise affects non-edge areas only
```

---

## Performance Considerations

### Single-Pass Performance

**Your current shader** (~200 instructions):
```
Advantage: All computed in one pass
  - No texture transfers
  - No framebuffer switches
  - Maximum cache coherency

Disadvantage: Can't skip unused effects
  - Edge detection always runs
  - Noise always runs
  - No granular control
```

### Multi-Pass Performance

**Multi-pass alternative**:
```
Base pass:    50 instructions
Edge pass:    40 instructions
Trail pass:   30 instructions
Composite:    20 instructions
Total:        140 instructions

BUT:
  - 4× draw call overhead (~2ms)
  - 3× framebuffer switches (~1ms)
  - Texture reads from buffers (slower than registers)

Actual performance: ~30% slower despite fewer instructions
```

### Performance by Effect

**Your current effects** (cost per pixel):

| Effect | Instructions | % of Total | Can Skip? |
|--------|--------------|------------|-----------|
| Distortion | 10-50 | 5-25% | ❌ (controls UV) |
| Rotation | 10 | 5% | ⚠️ (could pass identity matrix) |
| Edge Detection | 30 | 15% | ✅ (if edge strength = 0) |
| Color Conversion | 46 | 23% | ❌ (needed for trails) |
| Trails | 10 | 5% | ⚠️ (ping-pong needed) |
| Noise | 45 | 22% | ✅ (biggest savings!) |
| Total | ~200 | 100% | - |

**Optimization strategy**:
```javascript
// Add flags to disable expensive effects
uniform bool u_enableNoise;
uniform bool u_enableEdges;

// In shader
vec3 finalColor = baseColor;

if (u_enableEdges) {
    finalColor += detectEdges() * u_edgeStrength;
}

if (u_enableNoise) {
    finalColor *= noise(uv, time);
}

// Mobile: Disable noise → ~40% faster
```

---

## Composition Patterns

### Pattern 1: Lighten Group

**Concept**: Multiple additive layers.

```glsl
vec3 base = texture2D(u_texture, uv).rgb;
vec3 glow1 = computeGlow1();
vec3 glow2 = computeGlow2();
vec3 glow3 = computeGlow3();

// Add all
vec3 result = base + glow1 + glow2 + glow3;

// Clamp to prevent clipping
result = min(result, vec3(1.0));
```

**Use**: Lighting effects, glows, energy

### Pattern 2: Darken Group

**Concept**: Multiple multiplicative layers.

```glsl
vec3 base = texture2D(u_texture, uv).rgb;
vec3 shadow1 = computeShadow1();  // 0-1 range
vec3 shadow2 = computeShadow2();

// Multiply all
vec3 result = base * shadow1 * shadow2;
// Automatically darkens, never clips
```

**Use**: Shadows, tinting, color correction

### Pattern 3: Sandwich Composition

**Concept**: Base → Effects → Base again.

```glsl
// Bottom layer
vec3 background = u_bgColor;

// Effect layer
vec3 effect = computeTrails();

// Top layer (with alpha)
vec4 foreground = texture2D(u_texture, uv);

// Compose
vec3 result = mix(background, effect, 0.5);
result = mix(result, foreground.rgb, foreground.a);
```

**Use**: Background effects under main content

### Pattern 4: Frequency Separation

**Concept**: Separate low and high frequency details.

```glsl
// Low frequency (blur)
vec3 lowFreq = blur(texture, 10.0);

// High frequency (detail)
vec3 highFreq = texture - lowFreq + 0.5;

// Modify independently
lowFreq *= colorTint;      // Tint low freq
highFreq *= contrastBoost; // Boost detail

// Recombine
vec3 result = lowFreq + (highFreq - 0.5);
```

**Use**: Advanced color grading, detail enhancement

### Pattern 5: Masked Effect

**Concept**: Effect only in specific regions.

```glsl
// Compute mask
float mask = computeMask(uv);

// Compute effect
vec3 effect = expensiveEffect();

// Apply only where mask
vec3 base = texture2D(u_texture, uv).rgb;
vec3 result = mix(base, effect, mask);

// Effect invisible where mask = 0
```

**Use**: Localized effects, vignettes

---

## Common Mistakes

### Mistake 1: Wrong Blend Order

**Problem**:
```glsl
// ❌ Noise modulates trails separately
vec3 trails = accumulateTrails() * noise;
vec3 base = texture * noise;
vec3 result = base + trails;
// Noise affects both differently, looks disconnected
```

**Solution**:
```glsl
// ✅ Noise modulates final result
vec3 trails = accumulateTrails();
vec3 base = texture;
vec3 result = (base + trails) * noise;
// Noise ties everything together
```

### Mistake 2: Forgetting to Clamp Additive

**Problem**:
```glsl
// ❌ Can exceed 1.0
vec3 result = base + glow1 + glow2 + glow3;
// If each is 0.5, result = 2.0 (white clipping)
```

**Solution**:
```glsl
// ✅ Clamp or use screen blend
vec3 result = min(base + glow1 + glow2 + glow3, vec3(1.0));

// Or screen blend (no clipping)
vec3 result = screen(base, glow1);
result = screen(result, glow2);
result = screen(result, glow3);
```

### Mistake 3: Modulating Before Accumulation

**Problem**:
```glsl
// ❌ Noise changes each frame, trails accumulate changing noise
vec3 current = texture * noise(uv, time);
trails = trails * 0.9 + current;
// Result: Chaotic trails
```

**Solution**:
```glsl
// ✅ Accumulate, then modulate
vec3 current = texture;
trails = trails * 0.9 + current;
trails = trails * noise(uv, time);
// Result: Coherent trails with texture
```

**Your code** (correct!):
```glsl
// Lines 305-313: Trails accumulated first
trails = decayedTrail + newTrail;

// Line 316: Combined
finalColor = normalColor + trails;

// Lines 319-322: Then noise modulates everything
finalColor *= (0.8 + noiseValue * 0.4);
```

### Mistake 4: Using Wrong Coordinate Space

**Problem**:
```glsl
// ❌ Edge detection after distortion
vec2 distorted = distort(uv);
vec4 tex = texture2D(u_texture, distorted);
float edge = detectEdge(distorted);  // Detects distortion, not real edges
```

**Solution**:
```glsl
// ✅ Edge detection on clean coordinates
vec4 tex = texture2D(u_texture, uv);
float edge = detectEdge(uv);  // Detects real edges

// Then apply distortion for visual effect
vec2 distorted = distort(uv);
```

**Your code** (correct!):
```glsl
// Distortion modifies UV (lines 191-247)
// Rotation uses distorted UV (line 250)
// Edge detection uses rotated UV (line 256-260)
// Logical order: distort → rotate → sample → detect edges
```

---

## Copy-Paste Compositions

### Composition 1: Layered Control System

**Replace your current composition** (around line 316):

```glsl
// Separate layers explicitly
vec3 baseLayer = mix(u_bgColor, vec3(gray), texColor.a);
vec3 colorLayer = textureColor * gray * colorMixAmount;
vec3 edgeLayer = shiftedTrailColor * edge * 1.5;
vec3 trailLayer = decayedTrail + newTrail;
vec3 noiseLayer = vec3(0.8 + noiseValue * 0.4);

// Compose with control
vec3 composed = baseLayer + colorLayer;
composed += edgeLayer * u_edgeStrength;        // Control edge intensity
composed += trailLayer * u_trailStrength;      // Control trail intensity
composed = composed * noiseLayer * u_noiseStrength;  // Control noise

finalColor = composed;
```

**Add uniforms**:
```glsl
uniform float u_edgeStrength;    // 0-2
uniform float u_trailStrength;   // 0-2
uniform float u_noiseStrength;   // 0-1
```

### Composition 2: Spatial Layer Separation

**Different effects in different regions**:

```glsl
// Define regions
float centerDist = length(uv - vec2(0.5));
float centerMask = 1.0 - smoothstep(0.2, 0.4, centerDist);
float edgeMask = smoothstep(0.3, 0.5, centerDist);

// Apply effects per region
vec3 centerEffect = trails * 2.0;      // Strong trails in center
vec3 edgeEffect = coloredEdge * 3.0;   // Strong edges at rim

// Compose
vec3 finalColor = normalColor +
                  centerEffect * centerMask +
                  edgeEffect * edgeMask;
```

### Composition 3: Audio-Reactive Layer Mixing

**Frequency-based layer blending**:

```glsl
// Three layer styles
vec3 bassStyle = normalColor + trails * 2.0;           // Heavy trails
vec3 midStyle = normalColor + coloredEdge * 2.0;       // Strong edges
vec3 highStyle = normalColor * (1.0 + noiseValue);     // Noise boost

// Blend based on frequency dominance
float total = u_bass + u_mid + u_high + 0.01;
vec3 finalColor =
    (bassStyle * u_bass +
     midStyle * u_mid +
     highStyle * u_high) / total;
```

### Composition 4: Screen-Based Glow

**Non-clipping additive glow**:

```glsl
// Screen blend function
vec3 screen(vec3 a, vec3 b) {
    return 1.0 - (1.0 - a) * (1.0 - b);
}

// Apply glows with screen
vec3 base = normalColor;
vec3 glow1 = coloredEdge;
vec3 glow2 = trails * 0.5;

vec3 finalColor = screen(base, glow1);
finalColor = screen(finalColor, glow2);
// Never clips, preserves detail
```

### Composition 5: Luminance-Selective Effects

**Apply effects based on brightness**:

```glsl
// Luminance
float lum = dot(finalColor, vec3(0.299, 0.587, 0.114));

// Bright glow (only on bright areas)
float brightMask = smoothstep(0.6, 0.8, lum);
vec3 brightGlow = finalColor * 2.0;

// Dark boost (only on dark areas)
float darkMask = 1.0 - smoothstep(0.2, 0.4, lum);
vec3 darkBoost = finalColor * vec3(0.5, 0.7, 1.0);  // Blue tint

// Compose
finalColor = mix(finalColor, brightGlow, brightMask * 0.5);
finalColor = mix(finalColor, darkBoost, darkMask * 0.3);
```

---

## Progression Path

### Beginner (2-3 hours)

**Goal**: Understand current composition and add layer control.

**Checklist**:
- [ ] Read "Your Current Composition" section
- [ ] Understand blend modes (add vs multiply)
- [ ] Add layer strength uniforms
- [ ] Implement Composition 1 (layered control)
- [ ] Test with different layer strengths
- [ ] Document visual results

**Expected Result**: Independent control over edge, trail, noise strength.

### Intermediate (1-2 days)

**Goal**: Implement spatial and audio-reactive composition.

**Checklist**:
- [ ] Implement spatial masks
- [ ] Add radial gradient effects
- [ ] Try Composition 2 (spatial separation)
- [ ] Implement Composition 3 (audio-reactive mixing)
- [ ] Test different masking strategies
- [ ] Profile performance impact

**Expected Result**: Spatially-varying and music-reactive compositions.

### Advanced (3-5 days)

**Goal**: Multi-pass rendering and advanced blending.

**Checklist**:
- [ ] Set up multi-pass architecture
- [ ] Separate edge and trail into own passes
- [ ] Implement screen blending
- [ ] Try Composition 4 (screen-based glow)
- [ ] Add luminance-selective effects
- [ ] Create layer debugging visualizer

**Expected Result**: Modular multi-pass system with advanced blending.

### Expert (1+ week)

**Goal**: Production compositing system with full control.

**Checklist**:
- [ ] Build layer management system
- [ ] Implement all blend modes
- [ ] Create layer presets
- [ ] Add effect isolation for debugging
- [ ] Performance optimization per layer
- [ ] Document composition patterns
- [ ] Create automated composition testing

**Expected Result**: Professional compositing system with presets and full creative control.

---

## References

### Compositing Theory
- **Porter-Duff Compositing** - Original paper (1984)
- **"Compositing Digital Images"** - Thomas Porter & Tom Duff
- **"Digital Compositing for Film and Video"** - Steve Wright

### Blend Modes
- **Photoshop Blend Modes** - Adobe documentation
- **"GPU Gems"** - Chapters on compositing
- **"Real-Time Rendering"** - Blending chapter

### Multi-Pass Rendering
- **"OpenGL Programming Guide"** - Framebuffer objects
- **"WebGL Programming Guide"** - Off-screen rendering
- **LearnOpenGL.com** - Framebuffers tutorial

### Practical Examples
- **Shadertoy** - Search "composition" for examples
- **The Book of Shaders** - Compositing chapter
- **Inigo Quilez** - Articles on layering

---

## Next Steps

Now that you understand effect composition:

1. **Add Layer Control** - Implement strength uniforms
2. **Experiment with Blend Modes** - Try screen, overlay
3. **Test Spatial Masks** - Different effects in regions
4. **Profile Performance** - Measure impact of layers
5. **Document Presets** - Save good combinations

**Related Guides**:
- **Color Theory for Audio Visualization** - For layer coloring
- **Shader Optimization Techniques** - For optimizing layers
- **Ping-Pong Buffer Architecture** - For multi-pass trails
- **WebGL Rendering Pipeline** - For multi-pass setup

---

**Remember**: Composition is an art. The technical knowledge enables creativity - experiment with different layer combinations to find your unique visual style!

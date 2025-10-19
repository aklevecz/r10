# Ping-Pong Buffer Architecture

**A comprehensive guide to feedback loops, trail effects, and temporal visual persistence**

> **Purpose**: Master the art of creating visual trails, echoes, and temporal effects through ping-pong buffer techniques in WebGL.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Glossary](#glossary)
3. [Your Current Implementation](#your-current-implementation)
4. [Why Ping-Pong Buffers Exist](#why-ping-pong-buffers-exist)
5. [Buffer Swapping Mechanics](#buffer-swapping-mechanics)
6. [Trail Mathematics](#trail-mathematics)
7. [Feedback Patterns](#feedback-patterns)
8. [Multi-Buffer Systems](#multi-buffer-systems)
9. [Common Artifacts & Solutions](#common-artifacts--solutions)
10. [Advanced Feedback Techniques](#advanced-feedback-techniques)
11. [Performance Optimization](#performance-optimization)
12. [Debugging Ping-Pong Systems](#debugging-ping-pong-systems)
13. [Common Mistakes](#common-mistakes)
14. [Copy-Paste Snippets](#copy-paste-snippets)
15. [Progression Path](#progression-path)

---

## Quick Start

**Get better trails in 5 minutes:**

### 1. Understand Your Current System
You use **ping-pong buffers** to create trails:
```javascript
// Lines 344-377: Two framebuffers that swap each frame
const fb1 = { framebuffer, texture };
const fb2 = { framebuffer, texture };

// Each frame:
// 1. Read from previous frame's buffer
// 2. Draw to current frame's buffer
// 3. Swap buffers
```

### 2. Try This First
**Add audio-reactive trail length:**

```javascript
// In your draw() function around line 650
// Current: Fixed trail amount
gl.uniform1f(trailAmountLocation, 0.85);

// Enhanced: Audio-reactive
const baseTrail = 0.85;
const trailBoost = Math.pow(smoothedMid, 2) * 0.1; // 0-0.1
const finalTrail = Math.min(0.95, baseTrail + trailBoost);
gl.uniform1f(trailAmountLocation, finalTrail);
```

### 3. Test With Music
- **Quiet section** → Shorter trails (baseTrail = 0.85)
- **Mid peak** → Longer trails (up to 0.95)
- **Result**: Trails extend during musical intensity

**Result**: Dynamic trail length that breathes with the music.

---

## Glossary

### Buffer Concepts

- **Framebuffer**: Off-screen rendering target. Like a canvas you can draw to without showing it on screen.
- **Texture**: Image data stored in GPU memory. Can be used as input to shaders.
- **Render Target**: Destination for rendering operations. Can be screen or framebuffer.
- **Ping-Pong**: Two buffers that alternate roles each frame. One is read, one is written, then they swap.
- **Feedback Loop**: Using previous frame's output as current frame's input. Creates temporal effects.

### Trail Concepts

- **Trail Amount**: How much of previous frame to retain (0-1). 0 = no trail, 1 = infinite trail.
- **Trail Decay**: Rate at which trails fade. Inverse of trail amount (decay = 1 - amount).
- **Persistence**: How long trails remain visible. Related to trail amount.
- **Motion Blur**: Smooth blending of movement over time. Natural result of trails.
- **Echo Effect**: Discrete copies of image at different times. Multiple feedback taps.

### WebGL Rendering

- **glBindFramebuffer**: Set which framebuffer to render to (null = screen).
- **glFramebufferTexture2D**: Attach texture to framebuffer as render target.
- **glViewport**: Set rendering rectangle size.
- **glClear**: Fill buffer with color (usually transparent or black).
- **Texture Sampling**: Reading pixel color from texture in shader.

### Feedback Types

- **Multiplicative Feedback**: Multiply previous frame by factor < 1. Exponential decay.
- **Additive Feedback**: Add previous frame + new content. Can accumulate infinitely.
- **Subtractive Feedback**: Subtract from previous frame. Creates negative trails.
- **Custom Blending**: Arbitrary combination function. Maximum creative control.

### Artifacts

- **Feedback Explosion**: Trails grow infinitely bright. Caused by feedback > 1.0.
- **Stuck Pixels**: Pixels that never fade. Caused by feedback = 1.0 or precision errors.
- **Color Shift**: Colors change over time in trails. Caused by non-uniform RGB feedback.
- **Ghosting**: Persistent afterimages. Caused by high feedback values.
- **Flicker**: Temporal aliasing. Caused by single-buffer feedback.

---

## Your Current Implementation

### Complete Architecture Analysis

**Lines 344-377: Framebuffer Setup**

```javascript
// Line 344-345: Create two framebuffers
const framebuffer1 = gl.createFramebuffer();
const framebuffer2 = gl.createFramebuffer();

// Line 347-348: Create two textures
const texture1 = gl.createTexture();
const texture2 = gl.createTexture();

// Line 350-367: Configure texture1
gl.bindTexture(gl.TEXTURE_2D, texture1);
gl.texImage2D(
    gl.TEXTURE_2D,
    0,                    // Mipmap level
    gl.RGBA,              // Internal format (Red, Green, Blue, Alpha)
    canvas.width,         // Width
    canvas.height,        // Height
    0,                    // Border (must be 0)
    gl.RGBA,              // Format
    gl.UNSIGNED_BYTE,     // Type (0-255 per channel)
    null                  // Data (null = allocate empty)
);

gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
// MIN_FILTER = LINEAR: Smooth when shrinking texture
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
// MAG_FILTER = LINEAR: Smooth when enlarging texture
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
// WRAP_S: Don't repeat horizontally, clamp to edge
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
// WRAP_T: Don't repeat vertically, clamp to edge

// Line 369-377: Configure texture2 (identical to texture1)
// ... same setup ...

// Line 379-382: Attach textures to framebuffers
gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer1);
gl.framebufferTexture2D(
    gl.FRAMEBUFFER,           // Target
    gl.COLOR_ATTACHMENT0,     // Attachment point
    gl.TEXTURE_2D,            // Texture target
    texture1,                 // Texture to attach
    0                         // Mipmap level
);
// Now framebuffer1 renders to texture1

gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer2);
gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture2,
    0
);
// Now framebuffer2 renders to texture2

// Line 384-398: Store in objects for easy swapping
let buffers = {
    read: {
        framebuffer: framebuffer1,
        texture: texture1
    },
    write: {
        framebuffer: framebuffer2,
        texture: texture2
    }
};
```

**What This Creates**:

```
GPU Memory:
┌─────────────────────────────────────────┐
│ Framebuffer 1 → Texture 1 (1024×1024)  │  Buffer A
│   ├─ RGBA (4 bytes per pixel)          │
│   └─ Total: 4 MB                        │
├─────────────────────────────────────────┤
│ Framebuffer 2 → Texture 2 (1024×1024)  │  Buffer B
│   ├─ RGBA (4 bytes per pixel)          │
│   └─ Total: 4 MB                        │
└─────────────────────────────────────────┘
Total GPU Memory: 8 MB (for ping-pong system)
```

**Lines 540-650: Render Loop (Simplified)**

```javascript
// Line 588: Bind "write" buffer as render target
gl.bindFramebuffer(gl.FRAMEBUFFER, buffers.write.framebuffer);

// Line 589: Set rendering size to match framebuffer
gl.viewport(0, 0, canvas.width, canvas.height);

// Line 595: Send "read" texture to shader as u_feedback
gl.activeTexture(gl.TEXTURE1);
gl.bindTexture(gl.TEXTURE_2D, buffers.read.texture);
gl.uniform1i(feedbackLocation, 1);
// Shader can now sample previous frame via texture2D(u_feedback, uv)

// Line 619: Send trail amount to shader
gl.uniform1f(trailAmountLocation, 0.85);
// Shader multiplies previous frame by this value

// Line 625: Draw quad (renders to write buffer)
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
// Fragment shader runs for every pixel, creating new frame

// Line 627-632: Swap buffers
const temp = buffers.read;
buffers.read = buffers.write;
buffers.write = temp;
// Next frame: What we just wrote becomes what we read
//            What we just read becomes what we write

// Line 634-639: Copy to screen
gl.bindFramebuffer(gl.FRAMEBUFFER, null); // null = screen
gl.viewport(0, 0, canvas.width, canvas.height);
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, buffers.read.texture);
gl.uniform1i(textureLocation, 0);
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
// Draw the buffer we just created to the screen
```

**Lines 265-278: Shader Feedback Logic**

```glsl
// Line 268: Sample previous frame from feedback buffer
vec4 previousFrame = texture2D(u_feedback, gl_FragCoord.xy / u_resolution);

// Why gl_FragCoord.xy / u_resolution?
// gl_FragCoord.xy = pixel position (0 to width/height)
// u_resolution = canvas size (width, height)
// Division = normalize to 0-1 range for texture sampling

// Line 270-271: Apply trail decay
vec4 trail = previousFrame * u_trailAmount;
// u_trailAmount = 0.85 → each frame retains 85% of previous
// After 1 frame:  85% remains
// After 2 frames: 72.25% remains (0.85²)
// After 3 frames: 61.4% remains (0.85³)
// After 5 frames: 44.4% remains (0.85⁵)
// After 10 frames: 19.7% remains (0.85¹⁰)

// Line 273-276: Combine trail with new content
vec4 newContent = /* ... your distortion/color effects ... */;

// Line 298: Add new content on top of trail
gl_FragColor = mix(trail, newContent, newContent.a);
// If newContent is opaque (alpha=1), use newContent
// If newContent is transparent (alpha=0), use trail
// Blends based on alpha
```

### Visual Representation

**Ping-Pong Buffer Flow (Single Frame)**:

```
Frame N:
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Read Buffer (framebuffer1)     Write Buffer (fb2)      │
│  ┌─────────────────┐            ┌─────────────────┐     │
│  │                 │            │                 │     │
│  │  Previous frame │───────────▶│  New frame      │     │
│  │  (texture1)     │   Shader   │  (texture2)     │     │
│  │                 │   reads    │                 │     │
│  │  ████████       │   from     │  ████████       │     │
│  │  ██████         │   here,    │  ██████░░       │     │
│  │  ████           │   writes   │  ████░░░░       │     │
│  │                 │   here     │                 │     │
│  └─────────────────┘            └─────────────────┘     │
│         ▲                              │                │
│         │         Swap buffers         │                │
│         └──────────────────────────────┘                │
│                                                          │
└──────────────────────────────────────────────────────────┘

Frame N+1:
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Read Buffer (framebuffer2)     Write Buffer (fb1)      │
│  ┌─────────────────┐            ┌─────────────────┐     │
│  │                 │            │                 │     │
│  │  Previous frame │───────────▶│  New frame      │     │
│  │  (texture2)     │   Shader   │  (texture1)     │     │
│  │                 │            │                 │     │
│  │  ████████       │            │  ████████       │     │
│  │  ██████░░       │            │  ██████░░░      │     │
│  │  ████░░░░       │            │  ████░░░░░░     │     │
│  │                 │            │                 │     │
│  └─────────────────┘            └─────────────────┘     │
│         ▲                              │                │
│         │         Swap buffers         │                │
│         └──────────────────────────────┘                │
│                                                          │
└──────────────────────────────────────────────────────────┘

Notice: Buffers switch roles each frame!
        Trail gets progressively fainter (░ = faded pixels)
```

**Trail Decay Over Time**:

```
u_trailAmount = 0.85

Frame 0:  ████████ (100% - new content drawn)
Frame 1:  ███████░ (85% - first decay)
Frame 2:  ██████░░ (72% - 0.85²)
Frame 3:  █████░░░ (61% - 0.85³)
Frame 4:  ████░░░░ (52% - 0.85⁴)
Frame 5:  ███░░░░░ (44% - 0.85⁵)
Frame 10: █░░░░░░░ (20% - 0.85¹⁰)
Frame 15: ░░░░░░░░ (9% - 0.85¹⁵)
Frame 20: ░░░░░░░░ (4% - 0.85²⁰)

Trail becomes imperceptible after ~15-20 frames (250-333ms at 60fps)
```

### Parameter Analysis

**Your Current Settings**:

```javascript
// Trail amount (line 619)
u_trailAmount = 0.85
├─ Retention: 85% per frame
├─ Decay rate: 15% per frame
├─ Half-life: log(0.5) / log(0.85) = 4.3 frames (72ms at 60fps)
└─ Trail length: ~15-20 frames visible (250-333ms)

// Texture filtering (lines 361-362)
MIN_FILTER = LINEAR
MAG_FILTER = LINEAR
├─ Smooth interpolation (not pixelated)
├─ Slight blur on trails (softens edges)
└─ Minimal cost (~5% slower than NEAREST)

// Texture wrapping (lines 363-364)
WRAP_S = CLAMP_TO_EDGE
WRAP_T = CLAMP_TO_EDGE
├─ Coordinates outside 0-1 clamp to edge
├─ Prevents tiling artifacts
└─ Necessary for edge distortion effects
```

### Strengths of Current Implementation

1. **Clean Architecture**: Separate read/write buffers prevent feedback artifacts
2. **Efficient Swapping**: Pointer swap (not buffer copy) is instant
3. **Smooth Trails**: Linear filtering creates natural motion blur
4. **Stable Decay**: 0.85 is good balance (visible trails, no accumulation)
5. **Proper Clear**: Screen buffer cleared each frame (prevents double-image)

### Limitations and Opportunities

**Current Limitations**:

```javascript
// ❌ Fixed trail length
u_trailAmount = 0.85; // Never changes

// ❌ Uniform decay across entire frame
// All pixels fade at same rate

// ❌ Single feedback tap
// Only previous frame used, not frame N-2, N-3, etc.

// ❌ No spatial variation
// Can't have different trail lengths in different areas

// ❌ Simple multiplicative decay
// No custom fade curves or patterns
```

**Improvement Opportunities**:

```javascript
// ✅ Audio-reactive trail length
u_trailAmount = 0.85 + smoothedMid * 0.1;

// ✅ Spatial trail variation
// Center = long trails, edges = short trails
float distFromCenter = length(uv - vec2(0.5));
float localTrail = mix(0.9, 0.7, distFromCenter);

// ✅ Multi-tap feedback (echo effect)
vec4 trail1 = texture2D(u_feedback1, uv) * 0.85;
vec4 trail2 = texture2D(u_feedback2, uv) * 0.5; // Older frame
vec4 combined = trail1 + trail2 * 0.3;

// ✅ Custom decay curves
// Exponential: pow(trail, 2.0) - faster fade
// Logarithmic: sqrt(trail) - slower fade
// Threshold: trail > 0.1 ? trail * 0.85 : 0.0 - hard cutoff

// ✅ Color-specific decay
// Fade red faster than blue for color-shifting trails
trail.r *= 0.8;
trail.g *= 0.85;
trail.b *= 0.9;
```

---

## Why Ping-Pong Buffers Exist

### The Problem: Single-Buffer Feedback

**What if we tried to read and write to the same buffer?**

```javascript
// ❌ BROKEN: Single buffer approach
gl.bindFramebuffer(gl.FRAMEBUFFER, singleBuffer);

// In shader:
vec4 previous = texture2D(u_texture, uv); // Read from singleBuffer
gl_FragColor = previous * 0.85;           // Write to singleBuffer

// Problem: Reading and writing to same buffer simultaneously!
```

**Result**: Undefined behavior, often produces:
- Flickering (reads race with writes)
- Tearing (parts of image from different frames)
- Complete corruption (GPU dependent)

**Why It Fails**:
```
GPU executes many pixels in parallel:

Pixel (0,0) writes at time T
Pixel (100,100) reads at time T
  ├─ Does it read old value or new value?
  └─ Undefined! GPU doesn't guarantee order

Different GPUs handle this differently:
  - Some show flicker
  - Some show black screen
  - Some appear to work (but unstable)
```

### The Solution: Ping-Pong (Double Buffering)

**Two buffers, alternating roles**:

```javascript
// ✅ CORRECT: Ping-pong approach
gl.bindFramebuffer(gl.FRAMEBUFFER, writeBuffer);

// In shader:
vec4 previous = texture2D(u_readTexture, uv);  // Read from buffer A
gl_FragColor = previous * 0.85;                 // Write to buffer B

// Next frame: Swap!
// Now read from B, write to A
```

**Why It Works**:
```
Frame N:
  Read: Buffer A (complete, stable)
  Write: Buffer B (being modified)
  ├─ No conflict! Reading finished buffer, writing different buffer
  └─ Guaranteed consistency

Frame N+1:
  Read: Buffer B (now complete from previous write)
  Write: Buffer A (safe to overwrite)
  ├─ Swap is instant (just pointer reassignment)
  └─ Continuous feedback loop, no corruption
```

### Memory Cost vs. Benefit

**Cost**:
```
Single buffer: 1 × (width × height × 4 bytes)
  Example: 1024×1024×4 = 4 MB

Ping-pong: 2 × (width × height × 4 bytes)
  Example: 2×1024×1024×4 = 8 MB

Additional cost: 4 MB (one extra framebuffer)
```

**Benefit**:
- Stable, predictable feedback
- No flicker or tearing
- Cross-platform compatibility
- Enables complex temporal effects

**Verdict**: 4 MB is trivial on modern GPUs (typically 2-8 GB VRAM). Always worth it for stability.

### Alternative Approaches (Why Not Use Them)

**Approach 1: CPU Readback**
```javascript
// Read pixels to CPU, process, write back
gl.readPixels(...); // ~10-50ms (SLOW!)
// Process on CPU
gl.texSubImage2D(...); // Upload back

// Problem: 100× slower than GPU
// Problem: Stalls pipeline (GPU waits for CPU)
// Verdict: Never do this for real-time effects
```

**Approach 2: Single Buffer with Sync**
```javascript
// Force GPU to finish before reading
gl.finish(); // Wait for all operations
// Then read and write

// Problem: Destroys parallelism (GPU idles)
// Problem: Reduces framerate by 50-90%
// Verdict: Defeats purpose of GPU
```

**Approach 3: Triple Buffering**
```javascript
// Three buffers rotating
// Read: Buffer A
// Write: Buffer B
// Display: Buffer C

// Benefit: Smoother display on some systems
// Cost: +50% memory (12 MB vs 8 MB)
// Verdict: Overkill for most visualizations
//          Use ping-pong (double buffering)
```

---

## Buffer Swapping Mechanics

### The Swap Operation

**Your implementation (lines 627-632)**:

```javascript
const temp = buffers.read;
buffers.read = buffers.write;
buffers.write = temp;
```

**What happens**:
```
Before swap:
  buffers.read  = { framebuffer: fb1, texture: tex1 }
  buffers.write = { framebuffer: fb2, texture: tex2 }

After swap:
  buffers.read  = { framebuffer: fb2, texture: tex2 }  ← Was write
  buffers.write = { framebuffer: fb1, texture: tex1 }  ← Was read

Physical buffers (fb1, fb2, tex1, tex2):
  - Not copied or modified
  - Just references swapped
  - Instant operation (< 1 microsecond)
```

**Cost Analysis**:
```
Pointer swap:     ~0.001ms (instant)
Buffer copy:      ~1-5ms (1024×1024 RGBA)
Clear buffer:     ~0.1ms (fill with zeros)

Swap is 1000× faster than copy!
```

### Why Swap Instead of Copy?

**Copy Approach** (slower):
```javascript
// ❌ Copy approach (don't do this)
function copyBuffer(source, dest) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dest);
    gl.blitFramebuffer(
        0, 0, width, height,
        0, 0, width, height,
        gl.COLOR_BUFFER_BIT,
        gl.NEAREST
    );
}

// Each frame:
copyBuffer(writeBuffer, readBuffer); // 1-5ms!
// Render to writeBuffer
```

**Swap Approach** (faster - your current):
```javascript
// ✅ Swap approach (what you do)
const temp = buffers.read;
buffers.read = buffers.write;
buffers.write = temp;
// < 0.001ms!
```

**Performance Impact**:
```
At 60fps (16.67ms per frame):

Copy approach:     1-5ms wasted per frame
                   = 6-30% of frame budget

Swap approach:     < 0.001ms
                   = < 0.01% of frame budget

Swap is essential for 60fps!
```

### Swap Timing

**When to swap**:

```javascript
// ✅ CORRECT: Swap after rendering, before display
gl.bindFramebuffer(gl.FRAMEBUFFER, buffers.write.framebuffer);
// ... render to write buffer ...
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

// Swap now (after write is complete, before next read)
const temp = buffers.read;
buffers.read = buffers.write;
buffers.write = temp;

// Display the buffer we just wrote (now in 'read')
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
gl.bindTexture(gl.TEXTURE_2D, buffers.read.texture);
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
```

**Wrong timing**:

```javascript
// ❌ WRONG: Swap before rendering completes
gl.bindFramebuffer(gl.FRAMEBUFFER, buffers.write.framebuffer);
const temp = buffers.read;
buffers.read = buffers.write; // Swap too early!
buffers.write = temp;
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Might read incomplete buffer

// ❌ WRONG: Swap after display
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
gl.bindTexture(gl.TEXTURE_2D, buffers.read.texture);
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
const temp = buffers.read; // Too late, already displayed old frame
buffers.read = buffers.write;
buffers.write = temp;
```

### Initialization

**First frame problem**:

```
Frame 0:
  Read buffer: Empty (never written to)
  Write buffer: Will be written this frame

What does shader read?
  - Depends on GPU state (usually zeros or random)
  - Can cause flicker on first frame
```

**Solution: Clear buffers on init**:

```javascript
// After creating framebuffers (add to your code ~line 398)
function clearFramebuffer(framebuffer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.clearColor(0, 0, 0, 0); // Transparent black
    gl.clear(gl.COLOR_BUFFER_BIT);
}

clearFramebuffer(framebuffer1);
clearFramebuffer(framebuffer2);

// Now both buffers start with known state (transparent)
```

---

## Trail Mathematics

### Exponential Decay

**Your current implementation**:

```glsl
vec4 trail = previousFrame * u_trailAmount;
```

**Mathematics**:

```
Let:
  I₀ = initial intensity (1.0)
  α = trail amount (0.85)
  n = number of frames

Intensity after n frames:
  Iₙ = I₀ × αⁿ

Example (α = 0.85):
  Frame 0:  I₀ = 1.0
  Frame 1:  I₁ = 1.0 × 0.85¹ = 0.85
  Frame 2:  I₂ = 1.0 × 0.85² = 0.7225
  Frame 3:  I₃ = 1.0 × 0.85³ = 0.6141
  Frame 5:  I₅ = 1.0 × 0.85⁵ = 0.4437
  Frame 10: I₁₀ = 1.0 × 0.85¹⁰ = 0.1969
  Frame 20: I₂₀ = 1.0 × 0.85²⁰ = 0.0388
  Frame 30: I₃₀ = 1.0 × 0.85³⁰ = 0.0076
```

**Half-Life** (time to reach 50%):

```
0.5 = αⁿ
log(0.5) = n × log(α)
n = log(0.5) / log(α)

For α = 0.85:
  n = log(0.5) / log(0.85)
  n = -0.693 / -0.163
  n ≈ 4.3 frames

At 60fps: 4.3 frames × 16.67ms = 72ms half-life
```

**Visibility Threshold** (when trail becomes imperceptible):

```
Assuming minimum visible intensity = 0.01 (1%):

0.01 = αⁿ
n = log(0.01) / log(α)

For α = 0.85:
  n = log(0.01) / log(0.85)
  n ≈ 28.4 frames

At 60fps: 28.4 × 16.67ms = 473ms (about half a second)
```

### Trail Amount Comparison

| α (Trail Amount) | Half-Life (frames) | Half-Life (ms @ 60fps) | Visible Duration (frames) | Character |
|------------------|--------------------|-----------------------|---------------------------|-----------|
| **0.50** | 1.0 | 17ms | 7 | Very short, snappy |
| **0.70** | 2.0 | 33ms | 13 | Short, responsive |
| **0.80** | 3.1 | 52ms | 21 | Medium-short |
| **0.85** | 4.3 | 72ms | 28 | Medium (yours) |
| **0.90** | 6.6 | 110ms | 44 | Long |
| **0.95** | 13.5 | 225ms | 90 | Very long |
| **0.98** | 34.3 | 572ms | 228 | Extreme persistence |
| **0.99** | 68.9 | 1148ms | 459 | Nearly infinite |
| **1.00** | ∞ | ∞ | ∞ | Infinite (stuck pixels) |

### Decay Rate Formulas

**Convert between trail amount and decay rate**:

```javascript
// Trail amount → Decay rate
const decayRate = 1 - trailAmount;
// Example: 0.85 → 0.15 (15% decay per frame)

// Decay rate → Trail amount
const trailAmount = 1 - decayRate;
// Example: 0.15 → 0.85

// Trail amount → Half-life (frames)
const halfLife = Math.log(0.5) / Math.log(trailAmount);
// Example: 0.85 → 4.3 frames

// Desired half-life (frames) → Trail amount
const trailAmount = Math.pow(0.5, 1 / desiredHalfLife);
// Example: Want 10 frame half-life → α = 0.933

// Desired half-life (ms) → Trail amount (at 60fps)
const halfLifeFrames = desiredHalfLifeMs / 16.67;
const trailAmount = Math.pow(0.5, 1 / halfLifeFrames);
// Example: Want 200ms half-life → α = 0.944
```

### Custom Decay Curves

**Linear Decay** (constant subtraction):

```glsl
// Instead of multiply
vec4 trail = max(previousFrame - 0.05, 0.0);

// Effect: Subtracts 0.05 (5%) per frame
// Different feel: Constant fade speed regardless of brightness
```

```
Exponential (yours):     Linear decay:
Frame 0: ████████         ████████
Frame 1: ███████░         ███████▌  (subtract 0.05)
Frame 2: ██████░░         ███████   (subtract 0.05)
Frame 3: █████░░░         ██████▌   (subtract 0.05)
Frame 4: ████░░░░         ██████    (subtract 0.05)
Frame 5: ███░░░░░         █████▌    (subtract 0.05)

Exponential: Fades slower as it gets dimmer
Linear: Constant fade speed
```

**Power Curve Decay** (custom falloff):

```glsl
// Square root decay (slower)
vec4 trail = sqrt(previousFrame) * 0.9;

// Squared decay (faster)
vec4 trail = previousFrame * previousFrame * 0.95;

// Custom power
float power = 1.5;
vec4 trail = pow(previousFrame, vec4(power)) * u_trailAmount;
```

**Threshold Decay** (hard cutoff):

```glsl
// Only retain values above threshold
vec4 trail = previousFrame * u_trailAmount;
float brightness = dot(trail.rgb, vec3(0.299, 0.587, 0.114));

if (brightness < 0.05) {
    trail = vec4(0.0); // Hard cutoff at 5%
}

// Effect: Trails suddenly disappear instead of fading to nearly-nothing
```

**Asymptotic Decay** (never fully reaches zero):

```glsl
// Always retain small amount
float minRetention = 0.01;
vec4 trail = previousFrame * mix(u_trailAmount, 1.0, minRetention);

// Or:
vec4 trail = previousFrame * u_trailAmount + previousFrame * 0.01;

// Effect: Very faint "ghost" remains forever
// Use case: Persistent background glow
```

---

## Feedback Patterns

### Pattern 1: Simple Multiplicative (Your Current)

**Implementation**:
```glsl
vec4 trail = texture2D(u_feedback, uv) * u_trailAmount;
vec4 newContent = /* ... */;
gl_FragColor = mix(trail, newContent, newContent.a);
```

**Characteristics**:
- Exponential decay
- Stable (never explodes)
- Natural-looking motion blur
- Good for: General trails, motion blur

### Pattern 2: Additive Feedback

**Implementation**:
```glsl
vec4 trail = texture2D(u_feedback, uv);
vec4 newContent = /* ... */;

// Add new content to trail
gl_FragColor = trail * 0.95 + newContent * 0.5;

// Must ensure total doesn't exceed 1.0
gl_FragColor = clamp(gl_FragColor, 0.0, 1.0);
```

**Characteristics**:
- Accumulates brightness
- Can bloom/glow
- Requires clamping
- Good for: Light painting, energy buildup

**Warning**: Can explode if coefficients > 1.0!

```glsl
// ❌ BROKEN: Feedback explosion
gl_FragColor = trail + newContent; // Can grow infinitely!

// ✅ SAFE: Controlled accumulation
gl_FragColor = clamp(trail * 0.95 + newContent * 0.5, 0.0, 1.0);
```

### Pattern 3: Displaced Feedback (Motion Echo)

**Implementation**:
```glsl
// Offset UV coordinates based on time or audio
vec2 offset = vec2(sin(u_time * 0.5), cos(u_time * 0.5)) * 0.01;
vec2 displacedUV = uv + offset;

vec4 trail = texture2D(u_feedback, displacedUV) * u_trailAmount;
vec4 newContent = /* ... */;
gl_FragColor = mix(trail, newContent, newContent.a);
```

**Effect**: Trails spiral, drift, or move in patterns

**Use cases**:
- Psychedelic swirls
- Vortex effects
- Wind/drift simulation

**Example - Audio-driven displacement**:
```glsl
// Rotate trails based on audio
float angle = u_bass * 0.1; // Bass controls rotation
vec2 center = vec2(0.5, 0.5);
vec2 centered = uv - center;

// Rotate
float s = sin(angle);
float c = cos(angle);
vec2 rotated = vec2(
    centered.x * c - centered.y * s,
    centered.x * s + centered.y * c
);

vec2 rotatedUV = rotated + center;
vec4 trail = texture2D(u_feedback, rotatedUV) * 0.9;
```

### Pattern 4: Color-Shifting Feedback

**Implementation**:
```glsl
vec4 trail = texture2D(u_feedback, uv);

// Shift hue of trail
vec3 hsv = rgb2hsv(trail.rgb);
hsv.x += 0.01; // Shift hue by 3.6° per frame
hsv.x = fract(hsv.x); // Wrap around

vec3 shiftedRGB = hsv2rgb(hsv);
trail.rgb = shiftedRGB;

trail *= u_trailAmount;

vec4 newContent = /* ... */;
gl_FragColor = mix(trail, newContent, newContent.a);
```

**Effect**: Trails gradually change color over time

**Variations**:
```glsl
// Different decay per color channel
trail.r *= 0.8;  // Red fades fastest
trail.g *= 0.85; // Green medium
trail.b *= 0.9;  // Blue persists longest

// Result: Trails shift from white → yellow → cyan → blue
```

### Pattern 5: Zoom Feedback

**Implementation**:
```glsl
// Sample from slightly zoomed-in position
vec2 center = vec2(0.5, 0.5);
vec2 toCenter = center - uv;
vec2 zoomedUV = uv + toCenter * 0.01; // Move 1% toward center

vec4 trail = texture2D(u_feedback, zoomedUV) * u_trailAmount;
vec4 newContent = /* ... */;
gl_FragColor = mix(trail, newContent, newContent.a);
```

**Effect**:
- Zoom in (positive): Trails implode toward center
- Zoom out (negative): Trails explode from center

**Audio-reactive zoom**:
```javascript
// In JavaScript
const zoomAmount = 0.01 + bass * 0.02; // 0.01-0.03
gl.uniform1f(zoomAmountLocation, zoomAmount);
```

```glsl
// In shader
vec2 toCenter = vec2(0.5) - uv;
vec2 zoomedUV = uv + toCenter * u_zoomAmount;
vec4 trail = texture2D(u_feedback, zoomedUV) * u_trailAmount;
```

### Pattern 6: Multi-Tap Echo

**Implementation** (requires 3+ buffers):

```glsl
// Sample multiple past frames
vec4 frame1 = texture2D(u_feedback1, uv); // Previous frame
vec4 frame2 = texture2D(u_feedback2, uv); // 2 frames ago
vec4 frame3 = texture2D(u_feedback3, uv); // 3 frames ago

// Combine with decreasing weights
vec4 echo =
    frame1 * 0.6 +
    frame2 * 0.3 +
    frame3 * 0.1;

vec4 newContent = /* ... */;
gl_FragColor = mix(echo, newContent, newContent.a);
```

**Effect**: Discrete echoes/ghosts instead of smooth trail

**Setup** (needs triple buffering):
```javascript
// Create 3 buffers instead of 2
const buffers = [
    createFramebuffer(), // Current
    createFramebuffer(), // Previous
    createFramebuffer()  // Older
];

// Each frame, rotate buffers
function rotateBuffers() {
    const temp = buffers[2];
    buffers[2] = buffers[1];
    buffers[1] = buffers[0];
    buffers[0] = temp;
}
```

### Pattern 7: Conditional Feedback

**Implementation**:
```glsl
vec4 trail = texture2D(u_feedback, uv);
vec4 newContent = /* ... */;

// Only keep trail in certain areas
float distFromCenter = length(uv - vec2(0.5));

if (distFromCenter < 0.3) {
    // Center: Long trails
    trail *= 0.95;
} else {
    // Edges: Short trails
    trail *= 0.7;
}

gl_FragColor = mix(trail, newContent, newContent.a);
```

**Variations**:
```glsl
// Frequency-based trails
if (u_bass > 0.7) {
    trail *= 0.98; // Long trails on bass hits
} else {
    trail *= 0.85; // Normal trails
}

// Brightness-based trails
float brightness = dot(trail.rgb, vec3(0.299, 0.587, 0.114));
if (brightness > 0.8) {
    trail *= 0.95; // Bright areas persist
} else {
    trail *= 0.8;  // Dark areas fade faster
}
```

### Pattern 8: Feedback with Blur

**Implementation**:
```glsl
// Sample 9-tap blur of previous frame
vec2 texelSize = 1.0 / u_resolution;
vec4 blur = vec4(0.0);

for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
        vec2 offset = vec2(float(x), float(y)) * texelSize;
        blur += texture2D(u_feedback, uv + offset);
    }
}

blur /= 9.0; // Average of 9 samples
vec4 trail = blur * u_trailAmount;

vec4 newContent = /* ... */;
gl_FragColor = mix(trail, newContent, newContent.a);
```

**Effect**: Trails blur and diffuse over time

**Performance**: 9× texture reads per pixel (expensive!)

**Optimized - Separable Blur**:
```glsl
// Pass 1: Horizontal blur (write to intermediate buffer)
vec4 blur = vec4(0.0);
for (int i = -2; i <= 2; i++) {
    vec2 offset = vec2(float(i), 0.0) * texelSize;
    blur += texture2D(u_feedback, uv + offset);
}
blur /= 5.0;

// Pass 2: Vertical blur (write to output)
vec4 finalBlur = vec4(0.0);
for (int i = -2; i <= 2; i++) {
    vec2 offset = vec2(0.0, float(i)) * texelSize;
    finalBlur += texture2D(u_intermediate, uv + offset);
}
finalBlur /= 5.0;

// Now use finalBlur as trail
```

---

## Multi-Buffer Systems

### Triple Buffering (3-Frame Echo)

**Use case**: Discrete echoes at different delays

**Setup**:
```javascript
const buffers = {
    current: createFramebuffer(),
    previous: createFramebuffer(),
    older: createFramebuffer()
};

function rotateBuffers() {
    const temp = buffers.older;
    buffers.older = buffers.previous;
    buffers.previous = buffers.current;
    buffers.current = temp;
}
```

**Shader**:
```glsl
uniform sampler2D u_previous;  // 1 frame ago
uniform sampler2D u_older;     // 2 frames ago

void main() {
    vec4 prev1 = texture2D(u_previous, uv);
    vec4 prev2 = texture2D(u_older, uv);

    // Echo effect: Current + ghost from 2 frames ago
    vec4 echo = prev1 * 0.85 + prev2 * 0.3;

    vec4 newContent = /* ... */;
    gl_FragColor = mix(echo, newContent, newContent.a);
}
```

**Memory cost**: +50% (12 MB vs 8 MB for 1024×1024 RGBA)

### Quad Buffering (Stereo/Beat Sync)

**Use case**: Beat-synchronized double trails

**Setup**:
```javascript
const buffers = {
    A1: createFramebuffer(),
    A2: createFramebuffer(),
    B1: createFramebuffer(),
    B2: createFramebuffer()
};

let useA = true; // Toggle on beat

function onBeat() {
    useA = !useA; // Switch buffer pairs
}

function getCurrentBuffers() {
    return useA
        ? { read: buffers.A1, write: buffers.A2 }
        : { read: buffers.B1, write: buffers.B2 };
}
```

**Effect**: Trails "freeze" on beat, then new trails start

**Memory cost**: +100% (16 MB vs 8 MB)

### Multi-Resolution Buffers

**Use case**: Performance optimization with layered effects

**Setup**:
```javascript
const buffers = {
    fullRes: createFramebuffer(1024, 1024),   // Main trail
    halfRes: createFramebuffer(512, 512),     // Blur/glow
    quarterRes: createFramebuffer(256, 256)   // Ambient
};
```

**Render flow**:
```
1. Render full detail to fullRes (1024×1024)
2. Downsample and blur to halfRes (512×512)
3. Extreme blur to quarterRes (256×256)
4. Composite all three layers

Result: Fast multi-scale trails
```

**Memory savings**:
```
Full resolution:     1024×1024 = 4 MB
Half resolution:     512×512   = 1 MB
Quarter resolution:  256×256   = 0.25 MB
────────────────────────────────────────
Total:                          5.25 MB

vs. Three full buffers: 12 MB
Savings: 57%!
```

---

## Common Artifacts & Solutions

### Artifact 1: Feedback Explosion

**Symptom**: Trails get infinitely bright, screen becomes white

**Cause**:
```glsl
// ❌ Trail amount > 1.0
vec4 trail = previousFrame * 1.1; // Grows 10% per frame!

// ❌ Additive without clamping
gl_FragColor = trail + newContent; // Can exceed 1.0
```

**Solution**:
```glsl
// ✅ Ensure trail amount < 1.0
vec4 trail = previousFrame * min(u_trailAmount, 0.99);

// ✅ Clamp output
gl_FragColor = clamp(trail + newContent, 0.0, 1.0);

// ✅ Renormalize if over 1.0
vec4 color = trail + newContent;
float maxChannel = max(max(color.r, color.g), color.b);
if (maxChannel > 1.0) {
    color.rgb /= maxChannel;
}
gl_FragColor = color;
```

### Artifact 2: Stuck Pixels

**Symptom**: Some pixels never fade, remain permanently bright

**Cause**:
```glsl
// ❌ Trail amount = exactly 1.0
vec4 trail = previousFrame * 1.0; // Never decays!

// ❌ Floating-point precision
vec4 trail = previousFrame * 0.99999; // Decays so slowly it appears stuck
```

**Solution**:
```glsl
// ✅ Hard cutoff below threshold
vec4 trail = previousFrame * u_trailAmount;
if (dot(trail.rgb, vec3(0.299, 0.587, 0.114)) < 0.005) {
    trail = vec4(0.0); // Force to zero below 0.5%
}

// ✅ Ensure maximum trail amount
const maxTrail = 0.99;
gl.uniform1f(trailAmountLocation, Math.min(trailAmount, maxTrail));
```

### Artifact 3: Color Shift

**Symptom**: Trails change color over time (white → yellow → red)

**Cause**:
```glsl
// ❌ Different decay per channel
trail.r *= 0.9;
trail.g *= 0.85;
trail.b *= 0.8; // Blue fades fastest

// Result: White (1,1,1) → Yellow (1,0.94,0.89) → Orange → Red
```

**Solution** (if unintended):
```glsl
// ✅ Uniform decay
vec4 trail = previousFrame * u_trailAmount;
// All channels decay equally

// If intentional color shift is desired:
// Document it clearly and provide control parameter
```

### Artifact 4: Edge Artifacts

**Symptom**: Strange patterns at screen edges

**Cause**:
```glsl
// Sampling outside 0-1 range with incorrect wrap mode
vec2 offset = vec2(0.1, 0.0);
vec4 trail = texture2D(u_feedback, uv + offset);
// If uv.x = 0.95, samples at 1.05 (outside texture!)
```

**Solution**:
```javascript
// ✅ Set texture wrap mode to CLAMP_TO_EDGE (you already do this!)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
```

```glsl
// ✅ Clamp UV coordinates in shader
vec2 clampedUV = clamp(uv + offset, 0.0, 1.0);
vec4 trail = texture2D(u_feedback, clampedUV);
```

### Artifact 5: Temporal Aliasing (Flicker)

**Symptom**: Trails flicker or show strobing patterns

**Cause**:
- Using only one buffer (read/write conflict)
- Inconsistent frame timing
- Interaction with camera movement

**Solution**:
```javascript
// ✅ Use ping-pong buffers (you do!)
// Prevents read/write conflicts

// ✅ Time-based decay instead of frame-based
const deltaTime = currentTime - lastTime;
const decayPerSecond = 0.15; // 15% per second
const frameDecay = 1.0 - (decayPerSecond * deltaTime);
gl.uniform1f(trailAmountLocation, frameDecay);
```

### Artifact 6: Moire Patterns

**Symptom**: Wavy interference patterns in trails

**Cause**:
- Using NEAREST filtering (aliasing)
- Feedback displacement at certain frequencies

**Solution**:
```javascript
// ✅ Use LINEAR filtering (you already do!)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

// ✅ Add slight noise to break up patterns
```

```glsl
vec2 noise = vec2(
    fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453),
    fract(sin(dot(uv, vec2(93.9898, 67.345))) * 43758.5453)
);
vec2 noisyUV = uv + noise * 0.001; // Tiny offset
vec4 trail = texture2D(u_feedback, noisyUV) * u_trailAmount;
```

---

## Advanced Feedback Techniques

### Technique 1: Temporal Pooling

**Concept**: Average multiple past frames for smoother motion

**Implementation**:
```glsl
// Requires storing frame weights
uniform sampler2D u_frame1; // Current
uniform sampler2D u_frame2; // -1 frame
uniform sampler2D u_frame3; // -2 frames

void main() {
    vec4 f1 = texture2D(u_frame1, uv) * 0.5;
    vec4 f2 = texture2D(u_frame2, uv) * 0.3;
    vec4 f3 = texture2D(u_frame3, uv) * 0.2;

    vec4 pooled = f1 + f2 + f3;

    vec4 newContent = /* ... */;
    gl_FragColor = mix(pooled, newContent, newContent.a);
}
```

**Effect**: Super-smooth motion blur (like 180° shutter in film)

### Technique 2: Directional Trails

**Concept**: Trails follow direction of movement

**Implementation** (requires optical flow or velocity buffer):
```glsl
// Simplified: Sample in direction of previous frame gradient
vec2 texelSize = 1.0 / u_resolution;

// Calculate gradient (direction of change)
vec4 center = texture2D(u_feedback, uv);
vec4 right = texture2D(u_feedback, uv + vec2(texelSize.x, 0.0));
vec4 up = texture2D(u_feedback, uv + vec2(0.0, texelSize.y));

vec2 gradient = vec2(
    length(right - center),
    length(up - center)
);

// Sample along gradient direction
vec2 direction = normalize(gradient) * 0.01;
vec4 trail = texture2D(u_feedback, uv - direction) * u_trailAmount;

vec4 newContent = /* ... */;
gl_FragColor = mix(trail, newContent, newContent.a);
```

**Effect**: Trails "smear" in direction of motion (cinematic)

### Technique 3: Selective Feedback

**Concept**: Only certain elements create trails

**Implementation**:
```glsl
vec4 trail = texture2D(u_feedback, uv) * u_trailAmount;
vec4 newContent = /* ... */;

// Only bright elements leave trails
float brightness = dot(newContent.rgb, vec3(0.299, 0.587, 0.114));
if (brightness > 0.7) {
    // Bright: Leave trail
    gl_FragColor = max(trail, newContent);
} else {
    // Dark: Clear trail
    gl_FragColor = newContent;
}
```

**Use cases**:
- Sparks/particles trail, background doesn't
- Highlights glow, shadows don't
- Specific frequency bands trail

### Technique 4: Warped Feedback

**Concept**: Use distortion field to control trail flow

**Implementation**:
```glsl
// Create flow field from noise
float angle = noise(uv * 5.0 + u_time * 0.1) * 6.28;
vec2 flow = vec2(cos(angle), sin(angle)) * 0.01;

vec2 warpedUV = uv + flow;
vec4 trail = texture2D(u_feedback, warpedUV) * u_trailAmount;

vec4 newContent = /* ... */;
gl_FragColor = mix(trail, newContent, newContent.a);
```

**Effect**: Trails swirl and flow in organic patterns

### Technique 5: Ping-Pong with Intermediate Processing

**Concept**: Process feedback before using it

**Implementation**:
```glsl
// Read feedback
vec4 trail = texture2D(u_feedback, uv);

// Process: Edge enhance
vec2 ts = 1.0 / u_resolution;
vec4 blur = (
    texture2D(u_feedback, uv + vec2(ts.x, 0)) +
    texture2D(u_feedback, uv - vec2(ts.x, 0)) +
    texture2D(u_feedback, uv + vec2(0, ts.y)) +
    texture2D(u_feedback, uv - vec2(0, ts.y))
) / 4.0;

vec4 enhanced = trail + (trail - blur) * 0.5; // Sharpen

// Apply decay
enhanced *= u_trailAmount;

vec4 newContent = /* ... */;
gl_FragColor = mix(enhanced, newContent, newContent.a);
```

**Effect**: Trails maintain detail (don't blur out)

---

## Performance Optimization

### Optimization 1: Reduce Buffer Resolution

**Concept**: Trails don't need full resolution

**Implementation**:
```javascript
// Create feedback buffers at lower resolution
const feedbackWidth = canvas.width / 2;
const feedbackHeight = canvas.height / 2;

const texture1 = createTexture(feedbackWidth, feedbackHeight);
const texture2 = createTexture(feedbackWidth, feedbackHeight);

// Render main scene at full resolution
// Feedback at half resolution
```

**Performance gain**: 4× fewer pixels (2× width, 2× height)

**Quality impact**: Minimal - trails are blurry anyway

**Memory savings**: 75% (2 MB vs 8 MB for 1024×1024)

### Optimization 2: Conditional Feedback Update

**Concept**: Skip feedback when audio is silent

**Implementation**:
```javascript
let skipFrames = 0;

function draw() {
    const hasAudio = bass > 0.01 || mid > 0.01 || high > 0.01;

    if (!hasAudio) {
        skipFrames++;
        if (skipFrames > 60) {
            // Silent for 1 second, skip feedback
            // Just clear and return
            return;
        }
    } else {
        skipFrames = 0;
    }

    // Normal rendering with feedback
    // ...
}
```

**Performance gain**: ~30% when silent

### Optimization 3: Simplified Feedback Shader

**Concept**: Separate complex effects from simple feedback

**Implementation**:
```javascript
// Two shaders:
// 1. Simple feedback shader (just multiply)
// 2. Complex effect shader (distortion, color, etc.)

// Render feedback (fast)
gl.useProgram(feedbackShader);
gl.uniform1f(trailAmountLocation, 0.85);
// Draw

// Render effects on top (slow, but only for new content)
gl.useProgram(effectShader);
// Draw
```

**Performance gain**: 20-40% if effects are complex

### Optimization 4: Texture Format Optimization

**Current**: RGBA (4 bytes per pixel)

**Alternative**: RGB (3 bytes per pixel) if alpha not needed

```javascript
// If you don't need transparency in feedback:
gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGB,  // No alpha channel
    width,
    height,
    0,
    gl.RGB,
    gl.UNSIGNED_BYTE,
    null
);
```

**Memory savings**: 25% (3 MB vs 4 MB per buffer)

**Note**: You need alpha for your current implementation (mix based on alpha)

### Optimization 5: Reduce Swaps

**Concept**: Don't swap every frame (for slow trails)

**Implementation**:
```javascript
let frameCount = 0;

function draw() {
    frameCount++;

    // Only update feedback every 2 frames
    if (frameCount % 2 === 0) {
        // Swap buffers
        const temp = buffers.read;
        buffers.read = buffers.write;
        buffers.write = temp;
    }

    // Always render to screen
    // ...
}
```

**Effect**: Trails update at 30fps, display at 60fps

**Performance gain**: 40-50% on feedback operations

**Quality impact**: Noticeable (less smooth trails)

**Recommendation**: Only use for very slow devices

---

## Debugging Ping-Pong Systems

### Debug Technique 1: Visualize Read Buffer

**Implementation**:
```javascript
// Draw read buffer in corner of screen
function drawDebugBuffer(gl, texture, x, y, width, height) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(x, y, width, height);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// In draw loop (after main render)
drawDebugBuffer(gl, buffers.read.texture, 0, 0, 200, 200);
```

**Use**: See what shader is reading from (previous frame)

### Debug Technique 2: Freeze Feedback

**Implementation**:
```javascript
let freezeFeedback = false;

window.addEventListener('keydown', (e) => {
    if (e.key === 'f') freezeFeedback = !freezeFeedback;
});

function draw() {
    // ... render to write buffer ...

    if (!freezeFeedback) {
        // Normal swap
        const temp = buffers.read;
        buffers.read = buffers.write;
        buffers.write = temp;
    }
    // If frozen, keep reading same buffer (trails freeze)
}
```

**Use**: Inspect trail behavior, debug artifacts

### Debug Technique 3: Trail Amount Scrubbing

**Implementation**:
```javascript
let debugTrailAmount = 0.85;

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') debugTrailAmount = Math.min(debugTrailAmount + 0.05, 1.0);
    if (e.key === 'ArrowDown') debugTrailAmount = Math.max(debugTrailAmount - 0.05, 0.0);
    console.log(`Trail amount: ${debugTrailAmount}`);
});

// Use debugTrailAmount instead of fixed value
gl.uniform1f(trailAmountLocation, debugTrailAmount);
```

**Use**: Find optimal trail length interactively

### Debug Technique 4: Color-Code Buffers

**Implementation**:
```glsl
// In feedback shader, tint each buffer differently
vec4 trail = texture2D(u_feedback, uv);

#ifdef BUFFER_A
    trail.r *= 1.1; // Slightly more red in buffer A
#endif

#ifdef BUFFER_B
    trail.g *= 1.1; // Slightly more green in buffer B
#endif

trail *= u_trailAmount;
```

**Use**: Verify buffers are swapping correctly (should flicker between red/green tint)

### Debug Technique 5: Feedback Statistics

**Implementation**:
```javascript
// Add to draw loop
if (frameCount % 60 === 0) { // Every second
    // Read a sample of pixels from feedback buffer
    const pixels = new Uint8Array(4 * 100); // Sample 100 pixels
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffers.read.framebuffer);
    gl.readPixels(0, 0, 10, 10, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let totalBrightness = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i] / 255;
        const g = pixels[i + 1] / 255;
        const b = pixels[i + 2] / 255;
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += brightness;
    }

    const avgBrightness = totalBrightness / 100;
    console.log(`Feedback avg brightness: ${(avgBrightness * 100).toFixed(1)}%`);

    if (avgBrightness > 0.9) {
        console.warn('WARNING: Feedback explosion detected!');
    }
}
```

**Use**: Detect feedback explosion early

---

## Common Mistakes

### Mistake 1: Not Swapping Buffers

**Problem**:
```javascript
// ❌ Forgot to swap
gl.bindFramebuffer(gl.FRAMEBUFFER, buffers.write.framebuffer);
// ... render ...

// Display
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
gl.bindTexture(gl.TEXTURE_2D, buffers.read.texture);
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

// FORGOT TO SWAP!
// Next frame reads same buffer again (no feedback)
```

**Solution**:
```javascript
// ✅ Always swap after render, before display
const temp = buffers.read;
buffers.read = buffers.write;
buffers.write = temp;
```

### Mistake 2: Swapping References to Same Buffer

**Problem**:
```javascript
// ❌ Both references point to same buffer
const buffers = {
    read: framebuffer1,
    write: framebuffer1  // SAME AS READ!
};

// Swapping does nothing
const temp = buffers.read;
buffers.read = buffers.write;
buffers.write = temp;
// Still both pointing to framebuffer1!
```

**Solution**:
```javascript
// ✅ Create two distinct buffers
const buffers = {
    read: { framebuffer: fb1, texture: tex1 },
    write: { framebuffer: fb2, texture: tex2 }  // Different!
};
```

### Mistake 3: Not Clearing Write Buffer

**Problem**:
```javascript
// ❌ Old content from 2 frames ago still in write buffer
gl.bindFramebuffer(gl.FRAMEBUFFER, buffers.write.framebuffer);
// Don't clear
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Blends with old content!
```

**Solution** (if you want clean slate each frame):
```javascript
// ✅ Clear before drawing (optional, depends on effect)
gl.bindFramebuffer(gl.FRAMEBUFFER, buffers.write.framebuffer);
gl.clearColor(0, 0, 0, 0);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
```

**Note**: Your implementation doesn't clear, which is correct for feedback! Only clear if you want to erase history.

### Mistake 4: Wrong Texture Unit

**Problem**:
```javascript
// ❌ Binding to wrong texture unit
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, buffers.read.texture);
gl.uniform1i(feedbackLocation, 1); // Says unit 1, but bound to 0!
```

**Solution**:
```javascript
// ✅ Match texture unit to uniform value
gl.activeTexture(gl.TEXTURE1);  // Activate unit 1
gl.bindTexture(gl.TEXTURE_2D, buffers.read.texture);
gl.uniform1i(feedbackLocation, 1);  // Uniform says unit 1
```

### Mistake 5: Trail Amount > 1.0

**Problem**:
```javascript
// ❌ Feedback explosion
const trailAmount = 1.05; // Grows every frame!
gl.uniform1f(trailAmountLocation, trailAmount);
```

**Solution**:
```javascript
// ✅ Clamp to safe range
const trailAmount = Math.min(desiredAmount, 0.99);
gl.uniform1f(trailAmountLocation, trailAmount);
```

### Mistake 6: Forgetting to Resize Buffers

**Problem**:
```javascript
// ❌ Canvas resizes, buffers don't
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Buffers still old size! Stretched/squashed.
});
```

**Solution**:
```javascript
// ✅ Recreate buffers on resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Recreate textures at new size
    deleteFramebuffers(buffers);
    buffers = createFramebuffers(canvas.width, canvas.height);
});
```

---

## Copy-Paste Snippets

### Snippet 1: Audio-Reactive Trail Length

**Add to your draw() function**:

```javascript
// Around line 619, replace fixed trail amount with:
const baseTrail = 0.85;

// Option A: Mid-frequency reactive
const midBoost = Math.pow(smoothedMid, 2) * 0.1;
const trailAmount = Math.min(0.95, baseTrail + midBoost);

// Option B: Overall energy reactive
const energy = (smoothedBass + smoothedMid + high) / 3;
const energyBoost = Math.pow(energy, 1.5) * 0.12;
const trailAmount = Math.min(0.95, baseTrail + energyBoost);

// Option C: Beat-synced (requires beat detector)
const beatBoost = isBeat ? 0.15 : 0;
const trailAmount = Math.min(0.95, baseTrail + beatBoost);

gl.uniform1f(trailAmountLocation, trailAmount);
```

### Snippet 2: Spatial Trail Variation

**Add to fragment shader (around line 270)**:

```glsl
// Calculate distance from center
vec2 center = vec2(0.5, 0.5);
float distFromCenter = length(gl_FragCoord.xy / u_resolution - center);

// Vary trail amount by position
// Center = long trails (0.95)
// Edge = short trails (0.75)
float spatialTrail = mix(0.95, 0.75, distFromCenter * 2.0);

// Apply to feedback
vec4 previousFrame = texture2D(u_feedback, gl_FragCoord.xy / u_resolution);
vec4 trail = previousFrame * spatialTrail;

// ... rest of shader ...
```

### Snippet 3: Color-Shifting Trails

**Add to fragment shader**:

```glsl
vec4 previousFrame = texture2D(u_feedback, gl_FragCoord.xy / u_resolution);

// Convert to HSV
vec3 hsv = rgb2hsv(previousFrame.rgb);

// Shift hue based on audio
hsv.x += u_high * 0.02; // High frequencies shift hue 7.2° per frame max
hsv.x = fract(hsv.x);   // Wrap around at 1.0

// Convert back to RGB
previousFrame.rgb = hsv2rgb(hsv);

// Apply decay
vec4 trail = previousFrame * u_trailAmount;
```

### Snippet 4: Zoom Feedback

**Add uniforms to shader**:

```glsl
uniform float u_zoomAmount; // Send from JavaScript
```

**In fragment shader**:

```glsl
// Calculate zoom displacement
vec2 uv = gl_FragCoord.xy / u_resolution;
vec2 center = vec2(0.5, 0.5);
vec2 toCenter = center - uv;

// Zoom in (positive) or out (negative)
vec2 zoomedUV = uv + toCenter * u_zoomAmount;

// Sample with zoom
vec4 previousFrame = texture2D(u_feedback, zoomedUV);
vec4 trail = previousFrame * u_trailAmount;
```

**In JavaScript**:

```javascript
// Bass-driven zoom
const zoomBase = 0.005;  // Subtle zoom in
const zoomBoost = Math.pow(smoothedBass, 2) * 0.02; // 0-0.02
const totalZoom = zoomBase + zoomBoost;

gl.uniform1f(zoomAmountLocation, totalZoom);
```

### Snippet 5: Complete Ping-Pong Setup

**Standalone setup function**:

```javascript
function createPingPongBuffers(gl, width, height) {
    function createFramebufferTexture() {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0
        );

        // Clear to transparent
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        return { framebuffer, texture };
    }

    const buffer1 = createFramebufferTexture();
    const buffer2 = createFramebufferTexture();

    return {
        read: buffer1,
        write: buffer2,
        swap() {
            const temp = this.read;
            this.read = this.write;
            this.write = temp;
        }
    };
}

// Usage
const buffers = createPingPongBuffers(gl, canvas.width, canvas.height);

// In draw loop
gl.bindFramebuffer(gl.FRAMEBUFFER, buffers.write.framebuffer);
// ... render ...
buffers.swap();
```

---

## Progression Path

### Beginner (1-2 hours)

**Goal**: Understand ping-pong concept and make basic modifications.

**Checklist**:
- [ ] Read "Your Current Implementation" section
- [ ] Understand why two buffers are needed
- [ ] Verify buffer swapping in your code
- [ ] Try adjusting trail amount (0.5-0.95)
- [ ] Implement audio-reactive trail length (Snippet 1)
- [ ] Test with different music

**Expected Result**: Trails that respond to music, understanding of feedback loops.

### Intermediate (3-5 hours)

**Goal**: Implement spatial variation and custom decay curves.

**Checklist**:
- [ ] Read "Trail Mathematics" section
- [ ] Calculate half-life of your current trails
- [ ] Implement spatial trail variation (Snippet 2)
- [ ] Try different decay curves (power, linear, threshold)
- [ ] Add trail amount debugging controls
- [ ] Implement freeze feedback debug tool

**Expected Result**: Complex trail behaviors, mathematical understanding of decay.

### Advanced (6-10 hours)

**Goal**: Create custom feedback patterns and multi-buffer systems.

**Checklist**:
- [ ] Read "Feedback Patterns" section
- [ ] Implement color-shifting trails (Snippet 3)
- [ ] Implement zoom feedback (Snippet 4)
- [ ] Try displaced feedback (rotation/drift)
- [ ] Create triple-buffer echo system
- [ ] Implement conditional feedback (spatial/frequency-based)
- [ ] Add blur feedback pass

**Expected Result**: Unique trail effects, multi-tap echoes, custom visual styles.

### Expert (10+ hours)

**Goal**: Advanced techniques, optimization, production-ready system.

**Checklist**:
- [ ] Read "Advanced Feedback Techniques" section
- [ ] Implement directional trails (optical flow)
- [ ] Create multi-resolution buffer system
- [ ] Optimize buffer resolution for performance
- [ ] Implement comprehensive debugging tools
- [ ] Profile feedback system performance
- [ ] Create automated trail parameter search
- [ ] Document all artifacts and solutions

**Expected Result**: Professional-grade feedback system with optimal performance and complete control.

---

## References

### WebGL Framebuffers
- **MDN**: WebGLRenderingContext.createFramebuffer()
- **WebGL Fundamentals**: Framebuffers
- **Book**: "WebGL Programming Guide" by Matsuda & Lea (Chapter 10)

### Feedback Loops
- **Paper**: "Real-Time Rendering" by Akenine-Möller et al. (Chapter on post-processing)
- **Article**: "Ping-Pong Technique in OpenGL" (Lighthouse3D)
- **Video**: "Feedback Effects in Shaders" (The Art of Code)

### Motion Blur
- **Paper**: "Motion Blur as a Post-Processing Effect" (GPU Gems 3)
- **Article**: "Implementing Motion Blur" (Real-Time Rendering)
- **Reference**: Film camera shutter angles and motion blur theory

### Temporal Effects
- **Course**: "GPU Programming and Architecture" (Udacity)
- **Paper**: "Temporal Reprojection Anti-Aliasing" (SIGGRAPH)
- **Article**: "Frame Buffers" (Learn OpenGL)

### Implementation Examples
- **Shadertoy**: Search "feedback" for examples
- **GitHub**: "regl-feedback" library
- **Demo**: "Chrome Experiments" feedback effects

---

## Next Steps

Now that you understand ping-pong buffers:

1. **Try the Quick Start** - Add audio-reactive trails immediately
2. **Experiment with Trail Amounts** - Find your aesthetic
3. **Add Spatial Variation** - Different trail lengths in different areas
4. **Create Custom Patterns** - Color shifts, zooms, rotations
5. **Optimize** - Reduce buffer resolution if needed

**Related Guides**:
- **Audio-Reactive Design Patterns** - For controlling trail amount with audio features
- **Advanced Distortion Mathematics** - For displaced/warped feedback
- **Shader Optimization Techniques** - For optimizing feedback performance
- **Effect Composition & Layering** - For combining feedback with other effects

---

**Remember**: Ping-pong buffers are the foundation of temporal effects. Master this, and you unlock infinite creative possibilities - every frame becomes a canvas that remembers the past!

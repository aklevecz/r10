# Profile Creation Guide

This guide explains how to create and add new rendering profiles to the R10 project.

## Overview

Profiles define complete parameter sets for both browser and server rendering. The goal is: **same profile = same visual output, regardless of environment**.

## Key Principle

**CRITICAL**: Every parameter must exist in BOTH browser and server profiles with equivalent values. Missing parameters will cause rendering inconsistencies.

---

## Step-by-Step Process

### 1. Create Profile in Test Page (Recommended)

The easiest way to create a new profile is using the test-profile-comparison page:

1. Navigate to `/test-profile-comparison`
2. Adjust all sliders and toggles to your desired values
3. Click "Save Current Settings as Profile"
4. Enter a profile name (e.g., "v12")
5. The profile is now saved in localStorage

**What gets saved:**
- All base parameters (bassPower, scaleMin, etc.)
- Intensity multipliers (rotationIntensity, scaleIntensity, etc.)
- Effect toggles (enableRotation, enableInversion, etc.)

### 2. Export Profile from Browser

Open browser console and run:

```javascript
const profiles = JSON.parse(localStorage.getItem('customProfiles'));
console.log(JSON.stringify(profiles['YOUR_PROFILE_NAME'], null, 2));
```

Copy the output - this is your complete profile configuration.

### 3. Add Profile to Browser Profiles File

**File**: `/src/lib/profiles.js`

Add your profile to the `PROFILES` object:

```javascript
export const PROFILES = {
  'legacy-browser': { /* ... */ },
  'legacy-server': { /* ... */ },

  'YOUR_PROFILE_NAME': {
    name: 'Your Profile Name',
    description: 'Description of what makes this profile unique',

    // ========== FRAME RATE ==========
    frameRate: 60,

    // ========== AUDIO ANALYSIS ==========
    fftSize: 256,
    temporalSmoothing: 0.8,  // Browser uses Web Audio API temporal smoothing

    bassPower: 3.0,
    midPower: 1.5,
    highPower: 1.5,

    // ========== MOTION - SMOOTHING ==========
    bassSmoothing: 0.7,
    midSmoothing: 0.85,

    // ========== MOTION - SPEED ==========
    rotationSpeed: 0.8,

    // ========== EFFECTS - DISTORTION ==========
    distortionThreshold: 0.5,
    distortionMultiplier: 0.6,
    distortionBaseSpeed: 0.02,
    distortionSpeedMultiplier: 0.2,

    // ========== EFFECTS - SCALE ==========
    scaleMin: 0.15,
    scaleRange: 0.8,

    // ========== EFFECTS - TRAILS ==========
    trailDecay: 0.92,

    // ========== EFFECTS - INVERSION ==========
    inversionBassThreshold: 0.7,
    inversionDurationMs: 300,        // Milliseconds for browser
    inversionCooldownMs: 500,        // Milliseconds for browser
    inversionFadeInMs: 100,          // Milliseconds for browser
    inversionFadeOutMs: 100,         // Milliseconds for browser
    inversionWhiteDimFactor: 0.6,

    // ========== EFFECTS - HUE SHIFT ==========
    hueShiftMultiplier: 240,

    // ========== INTENSITY MULTIPLIERS ==========
    rotationIntensity: 1.0,
    scaleIntensity: 1.0,
    distortionIntensity: 1.0,
    hueShiftIntensity: 1.0,
    trailIntensity: 1.0,

    // ========== EFFECT TOGGLES ==========
    enableRotation: true,
    enableScale: true,
    enableDistortion: true,
    enableHueShift: true,
    enableInversion: true,
    enableTrails: true
  }
};
```

### 4. Add Profile to Server Profiles File

**File**: `/server/profiles.js`

Add the SAME profile with server-specific adaptations:

```javascript
export const PROFILES = {
  'legacy-browser': { /* ... */ },
  'legacy-server': { /* ... */ },

  'YOUR_PROFILE_NAME': {
    name: 'Your Profile Name',
    description: 'Description of what makes this profile unique',

    // ========== FRAME RATE ==========
    frameRate: 60,

    // ========== AUDIO ANALYSIS ==========
    fftSize: 256,
    fftScaling: 'linear',      // Server uses fft.js with linear scaling
    fftMultiplier: 120,        // Server-specific calibration
    temporalSmoothing: 0,      // Server doesn't use temporal smoothing

    bassPower: 3.0,            // SAME as browser
    midPower: 1.5,             // SAME as browser
    highPower: 1.5,            // SAME as browser

    // ========== MOTION - SMOOTHING ==========
    bassSmoothing: 0.7,        // SAME as browser
    midSmoothing: 0.85,        // SAME as browser

    // ========== MOTION - SPEED ==========
    rotationSpeed: 0.8,        // SAME as browser (or compensated if needed)

    // ========== EFFECTS - DISTORTION ==========
    distortionThreshold: 0.5,       // SAME as browser (or compensated)
    distortionMultiplier: 0.6,      // SAME as browser (or compensated)
    distortionBaseSpeed: 0.02,      // SAME as browser
    distortionSpeedMultiplier: 0.2, // SAME as browser

    // ========== EFFECTS - SCALE ==========
    scaleMin: 0.15,            // SAME as browser
    scaleRange: 0.8,           // SAME as browser

    // ========== EFFECTS - TRAILS ==========
    trailDecay: 0.92,          // SAME as browser

    // ========== EFFECTS - INVERSION ==========
    inversionBassThreshold: 0.7,    // SAME as browser
    inversionDurationFrames: 18,    // Convert ms to frames: 300ms ÷ (1000/60) = 18 frames
    inversionCooldownFrames: 30,    // Convert ms to frames: 500ms ÷ (1000/60) = 30 frames
    inversionFadeInFrames: 6,       // Convert ms to frames: 100ms ÷ (1000/60) = 6 frames
    inversionFadeOutFrames: 6,      // Convert ms to frames: 100ms ÷ (1000/60) = 6 frames
    inversionWhiteDimFactor: 0.6,   // SAME as browser

    // ========== EFFECTS - HUE SHIFT ==========
    hueShiftMultiplier: 240,   // SAME as browser

    // ========== INTENSITY MULTIPLIERS ==========
    rotationIntensity: 1.0,    // SAME as browser
    scaleIntensity: 1.0,       // SAME as browser
    distortionIntensity: 1.0,  // SAME as browser
    hueShiftIntensity: 1.0,    // SAME as browser
    trailIntensity: 1.0,       // SAME as browser

    // ========== EFFECT TOGGLES ==========
    enableRotation: true,      // SAME as browser
    enableScale: true,         // SAME as browser
    enableDistortion: true,    // SAME as browser
    enableHueShift: true,      // SAME as browser
    enableInversion: true,     // SAME as browser
    enableTrails: true         // SAME as browser
  }
};
```

---

## Browser vs Server Differences

### Parameters that MUST be different:

1. **Audio Analysis**:
   - Browser: `temporalSmoothing: 0.8` (Web Audio API)
   - Server: `fftScaling: 'linear', fftMultiplier: 120, temporalSmoothing: 0`

2. **Inversion Timing**:
   - Browser: Uses milliseconds (`inversionDurationMs`, `inversionCooldownMs`, etc.)
   - Server: Uses frames (`inversionDurationFrames`, `inversionCooldownFrames`, etc.)
   - **Conversion**: `frames = ms ÷ (1000 / fps)`
   - Example at 60fps: `300ms = 300 ÷ 16.67 = 18 frames`

### Parameters that MAY need compensation:

Some effects may render differently between browser and server due to FFT analysis differences. If visuals don't match:

1. **Distortion**: Adjust `distortionThreshold` and `distortionMultiplier`
2. **Rotation**: Adjust `rotationSpeed`
3. **Scale**: Usually doesn't need compensation

**Example** (from legacy-server profile):
- Browser: `rotationSpeed: 0.8`
- Server: `rotationSpeed: 1.8` (compensated higher)

### Parameters that MUST be identical:

- All base parameters (bassPower, midPower, highPower)
- Smoothing values (bassSmoothing, midSmoothing)
- Scale parameters (scaleMin, scaleRange)
- Trail decay
- Hue shift multiplier
- **ALL intensity multipliers**
- **ALL effect toggles**

---

## Complete Parameter Checklist

Use this checklist when creating a new profile:

### Audio Analysis (5 params)
- [ ] frameRate
- [ ] fftSize
- [ ] bassPower
- [ ] midPower
- [ ] highPower

### Browser-specific Audio (1 param)
- [ ] temporalSmoothing

### Server-specific Audio (3 params)
- [ ] fftScaling
- [ ] fftMultiplier
- [ ] temporalSmoothing (set to 0)

### Motion (3 params)
- [ ] bassSmoothing
- [ ] midSmoothing
- [ ] rotationSpeed

### Distortion (4 params)
- [ ] distortionThreshold
- [ ] distortionMultiplier
- [ ] distortionBaseSpeed
- [ ] distortionSpeedMultiplier

### Scale (2 params)
- [ ] scaleMin
- [ ] scaleRange

### Trails (1 param)
- [ ] trailDecay

### Inversion - Browser (5 params)
- [ ] inversionBassThreshold
- [ ] inversionDurationMs
- [ ] inversionCooldownMs
- [ ] inversionFadeInMs
- [ ] inversionFadeOutMs
- [ ] inversionWhiteDimFactor

### Inversion - Server (5 params)
- [ ] inversionBassThreshold
- [ ] inversionDurationFrames
- [ ] inversionCooldownFrames
- [ ] inversionFadeInFrames
- [ ] inversionFadeOutFrames
- [ ] inversionWhiteDimFactor

### Hue Shift (1 param)
- [ ] hueShiftMultiplier

### Intensity Multipliers (5 params)
- [ ] rotationIntensity
- [ ] scaleIntensity
- [ ] distortionIntensity
- [ ] hueShiftIntensity
- [ ] trailIntensity

### Effect Toggles (6 params)
- [ ] enableRotation
- [ ] enableScale
- [ ] enableDistortion
- [ ] enableHueShift
- [ ] enableInversion
- [ ] enableTrails

**Browser Total**: 34 parameters
**Server Total**: 37 parameters (includes fftScaling, fftMultiplier, and frame-based inversion)

---

## Testing Your Profile

### 1. Test in Browser

1. Navigate to `/test-profile-comparison`
2. Select your new profile from the dropdown
3. Verify all sliders and toggles match your expected values
4. Play audio and observe the visualization

### 2. Test on Server

Run a test render:

```javascript
node --input-type=module -e "
import { generateVideo } from './server/renderer.js';

const params = {
  audioUrl: 'YOUR_AUDIO_URL',
  distortionType: 4,
  trailHue: 330,
  trailSat: 100,
  trailLight: 65,
  pngUrl: 'server/raptor-svg.png',
  profile: 'YOUR_PROFILE_NAME'
};

const result = await generateVideo(params);
console.log('SUCCESS:', result);
"
```

### 3. Compare Outputs

1. Record browser visualization
2. Compare with server-rendered video
3. Look for differences in:
   - Rotation speed and smoothness
   - Scale range and responsiveness
   - Distortion intensity
   - Color inversion timing and intensity
   - Trail persistence

### 4. Adjust Compensation if Needed

If server rendering doesn't match browser:
- Adjust `rotationSpeed` (usually needs to be higher on server)
- Adjust `distortionThreshold` (usually needs to be lower on server)
- Adjust `distortionMultiplier` (usually needs to be higher on server)

---

## Common Mistakes

### ❌ Missing Parameters

**Problem**: Profile works in browser but fails on server (or vice versa)

**Solution**: Use the checklist above to ensure ALL parameters are present in both files

### ❌ Incorrect Time Conversions

**Problem**: Inversion timing feels wrong on server

**Solution**: Verify frame conversion math:
```
frames = milliseconds ÷ (1000 / frameRate)

At 60fps:
300ms = 300 ÷ 16.67 = 18 frames
500ms = 500 ÷ 16.67 = 30 frames
```

### ❌ Missing Intensity/Toggle Values

**Problem**: Effects don't respond to sliders or toggles

**Solution**: Always include ALL intensity multipliers and effect toggles, even if set to defaults (1.0 and true)

### ❌ Wrong temporalSmoothing

**Problem**: Audio feels sluggish on browser or jittery on server

**Solution**:
- Browser should have `temporalSmoothing: 0.8` (or your desired value 0-1)
- Server should ALWAYS have `temporalSmoothing: 0`

---

## Profile Naming Conventions

- Use lowercase with hyphens for multi-word names: `high-energy`, `smooth-motion`
- Version-based profiles: `v11`, `v12`, etc.
- Purpose-based profiles: `legacy-browser`, `legacy-server`
- Descriptive profiles: `bass-heavy`, `minimal-rotation`

---

## Advanced: Creating Variants

To create a variant of an existing profile:

1. Copy the entire profile block
2. Change the profile key and name
3. Modify only the parameters you want to change
4. **Important**: Keep ALL other parameters, even if unchanged

Example:

```javascript
'v11-no-inversion': {
  // Copy all v11 parameters...
  name: 'v11 (No Inversion)',
  // ... all other params stay the same ...
  enableInversion: false,  // Only change this
}
```

---

## Troubleshooting

### Profile doesn't appear in dropdown

1. Check syntax - missing comma, bracket, etc.
2. Verify profile is in PROFILES object
3. Check browser console for errors
4. Clear browser cache and reload

### Profile loads but values are wrong

1. Verify `getProfileConfig()` is working correctly
2. Check that profile loading logic includes intensity/toggle values
3. Ensure no typos in parameter names

### Browser and server renders don't match

1. Double-check ALL parameters are present in both files
2. Verify time conversion (ms → frames) is correct
3. Test with compensation adjustments (rotation, distortion)
4. Check FFT analysis settings (fftMultiplier, fftScaling)

---

## Reference: Legacy Profile Examples

See these existing profiles for reference:

- **legacy-browser**: Original browser implementation (60fps, smooth motion)
- **legacy-server**: Original server implementation (compensated motion)
- **v11**: Example of custom profile with intensity multipliers and toggles

---

## Questions?

If you encounter issues not covered in this guide, check:
- `/docs/PING_PONG_BUFFER_ARCHITECTURE.md` - Shader implementation details
- `/server/renderer.js` - Server rendering pipeline
- `/src/lib/components/AudioVisualizerWebGL.svelte` - Browser rendering implementation

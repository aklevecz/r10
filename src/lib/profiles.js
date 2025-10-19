/**
 * Shared Rendering Profiles for Browser and Server
 *
 * These profiles define complete parameter sets that can be used in both:
 * - Browser (AudioVisualizerWebGL.svelte)
 * - Server (server/renderer.js)
 *
 * Goal: Same profile = same visual output, regardless of environment
 */

/**
 * Profile Definitions
 *
 * TWO profiles only:
 * - legacy-browser: Current browser implementation
 * - legacy-server: Current server implementation
 *
 * Both available in both environments for parity.
 */
export const PROFILES = {
  /**
   * LEGACY-BROWSER
   *
   * Current browser implementation (AudioVisualizerWebGL.svelte)
   * - 60fps (requestAnimationFrame)
   * - Web Audio API with temporal smoothing
   * - Smooth, responsive motion
   */
  'legacy-browser': {
    name: 'Legacy Browser',
    description: 'Original browser implementation - 60fps, smooth motion',

    // ========== FRAME RATE ==========
    frameRate: 60,  // Browser runs at 60fps via requestAnimationFrame

    // ========== AUDIO ANALYSIS ==========
    // Browser uses Web Audio API AnalyserNode
    fftSize: 256,
    temporalSmoothing: 0.8,  // analyser.smoothingTimeConstant = 0.8

    // Frequency band analysis (identical in both)
    // Bass: bins 0-3 (4 bins)
    // Mid: bins 4-15 (12 bins)
    // High: bins 16-63 (48 bins)
    bassPower: 3.0,   // Math.pow(bass, 3.0)
    midPower: 1.5,    // Math.pow(mid, 1.5)
    highPower: 1.5,   // Math.pow(high, 1.5)

    // ========== MOTION - SMOOTHING ==========
    bassSmoothing: 0.7,   // smoothedBass = smoothedBass * 0.7 + bass * 0.3
    midSmoothing: 0.85,   // smoothedMid = smoothedMid * 0.85 + mid * 0.15

    // ========== MOTION - SPEED ==========
    rotationSpeed: 0.8,   // rotation += high * 0.8 (degrees per frame)

    // ========== EFFECTS - DISTORTION ==========
    distortionThreshold: 0.5,       // Mid threshold to trigger distortion
    distortionMultiplier: 0.6,      // Intensity multiplier
    distortionBaseSpeed: 0.02,      // Base time accumulation
    distortionSpeedMultiplier: 0.2, // Speed scaling with intensity

    // ========== EFFECTS - SCALE ==========
    scaleMin: 0.15,   // Minimum scale
    scaleRange: 0.8,  // Range (max = min + range = 0.95)

    // ========== EFFECTS - TRAILS ==========
    trailDecay: 0.92,  // Trail persistence (0-1)

    // ========== EFFECTS - INVERSION ==========
    inversionBassThreshold: 0.7,  // Bass level to trigger inversion
    inversionDurationMs: 300,     // How long inversion lasts (milliseconds)
    inversionCooldownMs: 500,     // Cooldown between inversions (milliseconds)

    // ========== EFFECTS - HUE SHIFT ==========
    hueShiftMultiplier: 240  // hueShift = high * 240
  },

  /**
   * LEGACY-SERVER
   *
   * Current server implementation (server/renderer.js)
   * - 30fps (configurable)
   * - Linear FFT scaling with arbitrary multiplier
   * - No temporal smoothing
   * - Compensated motion parameters
   */
  'legacy-server': {
    name: 'Legacy Server',
    description: 'Original server implementation - compensated motion',

    // ========== FRAME RATE ==========
    frameRate: 60,  // Match browser at 60fps

    // ========== AUDIO ANALYSIS ==========
    // Server uses fft.js library with custom scaling
    fftSize: 256,
    fftScaling: 'linear',      // Linear magnitude scaling
    fftMultiplier: 120,        // magnitude * 255 * 120 (calibrated to match browser analysis values)
    temporalSmoothing: 0,      // No per-bin temporal smoothing

    // Frequency band analysis (identical in both)
    bassPower: 3.0,
    midPower: 1.5,
    highPower: 1.5,

    // ========== MOTION - SMOOTHING ==========
    bassSmoothing: 0.7,   // Same as browser
    midSmoothing: 0.85,   // Same as browser

    // ========== MOTION - SPEED ==========
    rotationSpeed: 1.8,   // rotation += high * 1.8 (COMPENSATED - higher than browser)

    // ========== EFFECTS - DISTORTION ==========
    distortionThreshold: 0.3,       // COMPENSATED - lower than browser
    distortionMultiplier: 0.7,      // COMPENSATED - higher than browser
    distortionBaseSpeed: 0.02,      // Same as browser
    distortionSpeedMultiplier: 0.2, // Same as browser

    // ========== EFFECTS - SCALE ==========
    scaleMin: 0.15,   // Same as browser
    scaleRange: 0.8,  // Same as browser

    // ========== EFFECTS - TRAILS ==========
    trailDecay: 0.92,  // Same as browser

    // ========== EFFECTS - INVERSION ==========
    inversionBassThreshold: 0.7,  // Same as browser
    inversionDurationFrames: 18,  // 18 frames at 60fps = 300ms
    inversionCooldownFrames: 30,  // 30 frames at 60fps = 500ms

    // ========== EFFECTS - HUE SHIFT ==========
    hueShiftMultiplier: 240  // Same as browser
  }
};

/**
 * Get a profile configuration
 *
 * @param {string} profileName - Profile name ('legacy-browser' or 'legacy-server')
 * @returns {Object} Complete configuration object
 */
export function getProfileConfig(profileName = 'legacy-browser') {
  const profile = PROFILES[profileName];

  if (!profile) {
    console.warn(`Unknown profile "${profileName}", falling back to "legacy-browser"`);
    return { ...PROFILES['legacy-browser'] };
  }

  return { ...profile };
}

/**
 * Get list of all available profile names
 *
 * @returns {string[]} Array of profile names
 */
export function getAvailableProfiles() {
  return Object.keys(PROFILES);
}

/**
 * Get profile metadata (name and description)
 *
 * @param {string} profileName - Profile name
 * @returns {Object} { name, description } or null if not found
 */
export function getProfileInfo(profileName) {
  const profile = PROFILES[profileName];
  if (!profile) return null;

  return {
    name: profile.name,
    description: profile.description
  };
}

/**
 * List all profiles with their metadata
 *
 * @returns {Object[]} Array of { id, name, description }
 */
export function listProfiles() {
  return Object.entries(PROFILES).map(([id, profile]) => ({
    id,
    name: profile.name,
    description: profile.description
  }));
}

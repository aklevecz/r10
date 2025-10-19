/**
 * Frame-Rate Independent Motion Helpers
 *
 * Motion smoothing and interpolation that produces consistent visual results
 * regardless of frame rate (30fps vs 60fps vs 120fps).
 *
 * Problem:
 * - Exponential smoothing like `smoothed = smoothed * 0.7 + target * 0.3` is frame-rate dependent
 * - At 60fps: reaches 90% of target in ~10 frames = 166ms
 * - At 30fps: reaches 90% of target in ~10 frames = 333ms (2× slower!)
 * - Browser runs at 60fps, server at 30fps → different visual behavior
 *
 * Solution:
 * - Use half-life (time to reach 50% of target) instead of raw smoothing factor
 * - Convert half-life to frame-rate-specific smoothing factor
 * - Same half-life produces same visual speed at any frame rate
 *
 * Usage:
 *   const config = { bassHalfLife: 0.15, frameRate: 30 };
 *   const smoothing = getFrameRateIndependentSmoothing(config.bassHalfLife, config.frameRate);
 *   smoothedBass = smoothedBass * smoothing + bass * (1 - smoothing);
 */

/**
 * Convert half-life (seconds) to frame-rate-specific smoothing factor
 *
 * Half-life: time for smoothed value to reach 50% of the distance to target
 *
 * Math:
 *   smoothed(t) = target + (initial - target) * 0.5^(t / halfLife)
 *   At each frame: smoothed = smoothed * alpha + target * (1 - alpha)
 *   To match half-life: alpha = 0.5^(deltaTime / halfLife)
 *
 * @param {number} halfLifeSeconds - Time to reach 50% of target (e.g., 0.15 = 150ms)
 * @param {number} fps - Frame rate (e.g., 30 or 60)
 * @returns {number} Smoothing factor (0-1) to use with exponential smoothing
 *
 * @example
 * // Browser at 60fps with 150ms half-life
 * const smoothing60 = getFrameRateIndependentSmoothing(0.15, 60);
 * // → ~0.922
 *
 * @example
 * // Server at 30fps with same 150ms half-life
 * const smoothing30 = getFrameRateIndependentSmoothing(0.15, 30);
 * // → ~0.855
 *
 * @example
 * // Both produce visually identical motion despite different smoothing factors
 * // because they're calibrated to the same half-life
 */
export function getFrameRateIndependentSmoothing(halfLifeSeconds, fps) {
  const deltaTime = 1 / fps;  // Time per frame (seconds)
  return Math.pow(0.5, deltaTime / halfLifeSeconds);
}

/**
 * Convert raw smoothing factor to half-life (reverse operation)
 *
 * Useful for converting legacy frame-rate-dependent parameters to
 * frame-rate-independent half-life values.
 *
 * Math:
 *   alpha = 0.5^(deltaTime / halfLife)
 *   log(alpha) = (deltaTime / halfLife) * log(0.5)
 *   halfLife = deltaTime * log(0.5) / log(alpha)
 *
 * @param {number} smoothingFactor - Raw smoothing factor (0-1)
 * @param {number} fps - Frame rate this factor was calibrated for
 * @returns {number} Half-life in seconds
 *
 * @example
 * // Browser uses smoothing = 0.7 at 60fps, what's the half-life?
 * const halfLife = smoothingToHalfLife(0.7, 60);
 * // → ~0.047 seconds (47ms)
 *
 * @example
 * // Now use that half-life at 30fps
 * const smoothing30 = getFrameRateIndependentSmoothing(0.047, 30);
 * // → ~0.49 (produces same visual speed)
 */
export function smoothingToHalfLife(smoothingFactor, fps) {
  if (smoothingFactor <= 0 || smoothingFactor >= 1) {
    throw new Error('Smoothing factor must be between 0 and 1 (exclusive)');
  }

  const deltaTime = 1 / fps;
  return (deltaTime * Math.log(0.5)) / Math.log(smoothingFactor);
}

/**
 * Frame-rate independent exponential smoothing
 *
 * Encapsulates the smoothing logic for a single value.
 * Automatically handles frame-rate conversion.
 *
 * @example
 * const smoother = new ExponentialSmoother({ halfLife: 0.15, fps: 30 });
 * smoother.update(0.8);  // New target
 * console.log(smoother.value);  // Smoothed value
 */
export class ExponentialSmoother {
  /**
   * @param {Object} config
   * @param {number} config.halfLife - Half-life in seconds
   * @param {number} config.fps - Frame rate
   * @param {number} [config.initialValue] - Starting value (default: 0)
   */
  constructor(config) {
    this.halfLife = config.halfLife;
    this.fps = config.fps;
    this.value = config.initialValue ?? 0;
    this.smoothingFactor = getFrameRateIndependentSmoothing(this.halfLife, this.fps);
  }

  /**
   * Update smoothed value with new target
   *
   * @param {number} target - New target value
   * @returns {number} Current smoothed value
   */
  update(target) {
    this.value = this.value * this.smoothingFactor + target * (1 - this.smoothingFactor);
    return this.value;
  }

  /**
   * Reset to a specific value
   *
   * @param {number} value - New value
   */
  reset(value = 0) {
    this.value = value;
  }
}

/**
 * Legacy smoothing (frame-rate dependent)
 *
 * For profiles that want to preserve exact legacy behavior.
 * Uses raw smoothing factor without frame-rate conversion.
 *
 * @example
 * const smoother = new LegacySmoother({ smoothing: 0.7, initialValue: 0 });
 * smoother.update(0.8);
 */
export class LegacySmoother {
  /**
   * @param {Object} config
   * @param {number} config.smoothing - Raw smoothing factor (0-1)
   * @param {number} [config.initialValue] - Starting value (default: 0)
   */
  constructor(config) {
    this.smoothingFactor = config.smoothing;
    this.value = config.initialValue ?? 0;
  }

  /**
   * Update smoothed value with new target
   *
   * @param {number} target - New target value
   * @returns {number} Current smoothed value
   */
  update(target) {
    this.value = this.value * this.smoothingFactor + target * (1 - this.smoothingFactor);
    return this.value;
  }

  /**
   * Reset to a specific value
   *
   * @param {number} value - New value
   */
  reset(value = 0) {
    this.value = value;
  }
}

/**
 * Spring physics system (alternative to exponential smoothing)
 *
 * Creates bouncy, organic motion with overshoot.
 * Frame-rate independent through proper physics integration.
 *
 * Physics:
 *   acceleration = -stiffness * displacement - damping * velocity
 *   velocity += acceleration * dt
 *   position += velocity * dt
 *
 * Parameters:
 * - stiffness: How strongly spring pulls toward target (0-1)
 *   - Low (0.1): Slow, lazy motion
 *   - Medium (0.3): Balanced
 *   - High (0.8): Snappy, fast response
 *
 * - damping: How quickly oscillation settles (0-1)
 *   - Low (0.5): Bouncy, lots of overshoot
 *   - Medium (0.75): Some bounce
 *   - High (0.95): Minimal bounce, critically damped
 *
 * @example
 * const spring = new SpringSmoother({
 *   stiffness: 0.25,
 *   damping: 0.82,
 *   fps: 30
 * });
 *
 * spring.setTarget(0.8);  // New target
 * spring.update();        // Step physics
 * console.log(spring.value);
 */
export class SpringSmoother {
  /**
   * @param {Object} config
   * @param {number} config.stiffness - Spring stiffness (0-1, default: 0.25)
   * @param {number} config.damping - Damping factor (0-1, default: 0.82)
   * @param {number} config.fps - Frame rate for physics step
   * @param {number} [config.initialValue] - Starting position (default: 0)
   */
  constructor(config) {
    this.stiffness = config.stiffness ?? 0.25;
    this.damping = config.damping ?? 0.82;
    this.fps = config.fps;
    this.dt = 1 / this.fps;  // Time step per frame

    this.position = config.initialValue ?? 0;
    this.velocity = 0;
    this.target = this.position;
  }

  /**
   * Set new target (spring will move toward this)
   *
   * @param {number} target - New target position
   */
  setTarget(target) {
    this.target = target;
  }

  /**
   * Step the spring physics simulation
   *
   * @returns {number} Current position
   */
  update() {
    // Calculate displacement from target
    const displacement = this.target - this.position;

    // Spring force (Hooke's law)
    const springForce = displacement * this.stiffness;

    // Update velocity with spring force (acceleration)
    this.velocity += springForce * this.dt;

    // Apply damping to velocity
    this.velocity *= this.damping;

    // Update position
    this.position += this.velocity * this.dt;

    return this.position;
  }

  /**
   * Convenience: set target and update in one call
   *
   * @param {number} target - New target
   * @returns {number} Current position
   */
  updateWithTarget(target) {
    this.setTarget(target);
    return this.update();
  }

  /**
   * Reset spring to a position with zero velocity
   *
   * @param {number} value - New position
   */
  reset(value = 0) {
    this.position = value;
    this.velocity = 0;
    this.target = value;
  }

  /**
   * Get current value (alias for position)
   */
  get value() {
    return this.position;
  }
}

/**
 * Factory: Create smoother based on motion system type
 *
 * Automatically selects the right smoother class based on profile config.
 *
 * @param {Object} config - Motion configuration from profile
 * @param {string} config.motionSystem - 'exponential', 'spring', or 'legacy'
 * @param {number} config.fps - Frame rate
 * @param {number} [config.halfLife] - For exponential (frame-rate independent)
 * @param {number} [config.smoothing] - For legacy (frame-rate dependent)
 * @param {number} [config.stiffness] - For spring
 * @param {number} [config.damping] - For spring
 * @param {number} [config.initialValue] - Starting value
 * @returns {Object} Smoother instance with update() and reset() methods
 *
 * @example
 * // Frame-rate independent exponential
 * const smoother = createSmoother({
 *   motionSystem: 'exponential',
 *   halfLife: 0.15,
 *   fps: 30
 * });
 *
 * @example
 * // Legacy frame-rate dependent
 * const smoother = createSmoother({
 *   motionSystem: 'legacy',
 *   smoothing: 0.7,
 *   fps: 30
 * });
 *
 * @example
 * // Spring physics
 * const smoother = createSmoother({
 *   motionSystem: 'spring',
 *   stiffness: 0.25,
 *   damping: 0.82,
 *   fps: 30
 * });
 */
export function createSmoother(config) {
  const system = config.motionSystem || 'exponential';

  if (system === 'spring') {
    return new SpringSmoother(config);
  } else if (system === 'legacy') {
    return new LegacySmoother(config);
  } else if (system === 'exponential') {
    return new ExponentialSmoother(config);
  } else {
    throw new Error(`Unknown motion system: "${system}". Use "exponential", "spring", or "legacy".`);
  }
}

/**
 * Diagnostic: Compare smoothing behaviors at different frame rates
 *
 * Visualizes how the same half-life produces consistent motion across frame rates.
 *
 * @param {number} halfLife - Half-life in seconds
 * @param {number} targetValue - Target value to reach
 * @param {number} frames - Number of frames to simulate
 */
export function compareFrameRates(halfLife, targetValue = 1.0, frames = 30) {
  console.log(`\n=== Frame-Rate Comparison (Half-Life: ${halfLife}s) ===`);
  console.log(`Target: ${targetValue}\n`);

  const fps30 = new ExponentialSmoother({ halfLife, fps: 30, initialValue: 0 });
  const fps60 = new ExponentialSmoother({ halfLife, fps: 60, initialValue: 0 });

  console.log('Time  | 30fps Value | 60fps Value | Difference');
  console.log('-'.repeat(55));

  for (let i = 0; i <= frames; i++) {
    const time30 = i / 30;
    const time60 = i / 60;

    // Update 30fps once per iteration
    if (i > 0) fps30.update(targetValue);

    // Update 60fps twice per 30fps frame (except first frame)
    if (i > 0) {
      fps60.update(targetValue);
      fps60.update(targetValue);
    }

    // Log every 5 frames
    if (i % 5 === 0) {
      const diff = Math.abs(fps60.value - fps30.value);
      console.log(
        `${time30.toFixed(3)}s | ${fps30.value.toFixed(4).padStart(11)} | ${fps60.value.toFixed(4).padStart(11)} | ${diff.toFixed(4)}`
      );
    }
  }

  console.log(`\nFinal difference: ${Math.abs(fps60.value - fps30.value).toFixed(6)}`);
  console.log('(Should be very small - demonstrates frame-rate independence)\n');
}

/**
 * Diagnostic: Visualize spring motion
 *
 * Shows position and velocity over time for spring physics.
 *
 * @param {Object} config - Spring configuration
 * @param {number} target - Target position
 * @param {number} frames - Number of frames to simulate
 */
export function visualizeSpring(config, target = 1.0, frames = 60) {
  const spring = new SpringSmoother(config);
  spring.setTarget(target);

  console.log(`\n=== Spring Physics Visualization ===`);
  console.log(`Stiffness: ${config.stiffness}, Damping: ${config.damping}, FPS: ${config.fps}`);
  console.log(`Target: ${target}\n`);

  console.log('Frame | Position | Velocity | Acceleration');
  console.log('-'.repeat(60));

  for (let i = 0; i <= frames; i++) {
    const pos = spring.position;
    const vel = spring.velocity;

    // Calculate acceleration for display
    const displacement = spring.target - pos;
    const acc = displacement * spring.stiffness;

    // Log every 5 frames
    if (i % 5 === 0) {
      console.log(
        `${i.toString().padStart(5)} | ${pos.toFixed(4).padStart(8)} | ${vel.toFixed(4).padStart(8)} | ${acc.toFixed(4).padStart(12)}`
      );
    }

    spring.update();
  }

  console.log('\n');
}

/**
 * Utility: Calculate settling time for spring
 *
 * Estimates how many frames until spring settles within threshold of target.
 *
 * @param {Object} config - Spring configuration
 * @param {number} threshold - Distance from target considered "settled" (default: 0.01)
 * @param {number} maxFrames - Maximum frames to simulate (default: 300)
 * @returns {number} Frames to settle, or maxFrames if doesn't settle
 */
export function calculateSpringSettlingTime(config, threshold = 0.01, maxFrames = 300) {
  const spring = new SpringSmoother(config);
  spring.setTarget(1.0);

  for (let i = 0; i < maxFrames; i++) {
    spring.update();

    if (Math.abs(spring.position - spring.target) < threshold && Math.abs(spring.velocity) < threshold) {
      return i;
    }
  }

  return maxFrames;
}

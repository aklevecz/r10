# Plan: Add User Button for Resuming Render with Audio

## Current Problem
- `onMount` automatically starts polling and tries to play audio
- Audio context requires user interaction (gesture) to start
- User has no control over when to resume

## Proposed Solution

**Add a "Resume" button when cached job is detected:**

### 1. Detection Phase (automatic on mount)
- Check for cached job data
- Set UI state to show "job in progress" message
- **Do NOT start polling yet**
- Show a button: "Resume Render"

### 2. User Interaction (on button click)
- Start polling `waitForCompletion()`
- Show VisualizerLoadingScreen with audio
- Update progress as normal

### 3. UI States

**State 1: Job detected, awaiting resume**
- Message: "You have a render in progress"
- Song info displayed (from cached data)
- Button: "Resume Render"

**State 2: User clicked resume**
- VisualizerLoadingScreen visible
- Audio playing
- Progress updates

**State 3: Completion**
- Video displayed as normal

## Implementation Steps

1. Add new state variable: `awaitingResume = $state(false)`
2. Modify `onMount`:
   - Detect cached job
   - Set `awaitingResume = true`
   - Set `selectedSong` from cache
   - **Don't call `waitForCompletion()` yet**
3. Add `resumeRender()` function that starts polling
4. Add conditional UI block for "awaiting resume" state
5. Wire up button to call `resumeRender()`

## Benefits
- ✅ Complies with browser audio context requirements
- ✅ User has control over when to resume
- ✅ Clear feedback about job status
- ✅ No automatic audio playback

## Files to Modify
- `/Users/arielklevecz/r10/src/lib/components/SongSearch.svelte`
  - Add `awaitingResume` state
  - Modify `onMount` hook (lines 54-94)
  - Add `resumeRender()` function
  - Add UI block for awaiting resume state

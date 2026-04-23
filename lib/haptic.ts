/**
 * Thin wrapper over navigator.vibrate so every surface feels alive
 * without branching logic in the UI.
 *
 * iOS Safari currently ignores Vibration API calls outright; Android
 * Chrome honors them. No fallback is needed: the worst case is silence.
 */

function v(pattern: number | number[]) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Permission denied or unsupported — silent.
  }
}

export const haptic = {
  tap: () => v(10),
  press: () => v(15),
  success: () => v([12, 40, 24]),
  error: () => v([40, 30, 40]),
};

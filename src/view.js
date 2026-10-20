// The old picture was a perspective camera. Layers at different depths then
// crossed the ground line at different screen heights, so the horizon split
// and the ranges jumped as the kitten climbed. This view is orthographic.
// One scale maps world +Y up and world +X right. Parallax is horizontal only,
// so every layer keeps the grass line.

export const CAM_Z = 980;
export const CAM_FOV = 34;

// Landscape phones map a short screenH onto the full frustum, so the kitten
// reads tiny. Shrink the world half-height a bit (~18% closer).
const LANDSCAPE_ZOOM = 0.85;

export function viewHalfHeight(screenW = 0, screenH = 0) {
  let halfH = Math.tan((CAM_FOV * Math.PI) / 360) * CAM_Z;
  if (screenW > 0 && screenH > 0) {
    const aspect = screenW / screenH;
    if (aspect > 1.2 && screenH < 520) halfH *= LANDSCAPE_ZOOM;
  }
  return halfH;
}

// Width of the old perspective frustum at a flyby's depth. Used only to
// decide when a distant craft has left the screen.
export function viewHalfWidthAt(z) {
  return Math.tan((CAM_FOV * Math.PI) / 360) * (CAM_Z - z) * 2.05;
}

export function viewHalfWidth(screenW, screenH) {
  const aspect = screenW / Math.max(1, screenH);
  return viewHalfHeight(screenW, screenH) * Math.max(0.3, aspect);
}

// world is y-up. Pixi's +Y points down, so the container scale flips it.
// A child at (wx, wy) lands on the pixel for that world point.
export function applyWorld(world, screenW, screenH, camX, camY) {
  const halfH = viewHalfHeight(screenW, screenH);
  const scale = screenH / (2 * halfH);
  world.scale.set(scale, -scale);
  world.position.set(screenW / 2 - camX * scale, screenH / 2 + camY * scale);
  return {
    scale,
    halfH,
    halfW: halfH * (screenW / Math.max(1, screenH)),
    screenW,
    screenH,
    camX,
    camY,
  };
}

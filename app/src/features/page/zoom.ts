export const ZOOM_MIN = 50;
export const ZOOM_MAX = 300;
export const ZOOM_STEPS = [50, 75, 100, 125, 150, 200, 250, 300];

export const stepZoom = (z: number, dir: 1 | -1): number =>
  (dir > 0 ? ZOOM_STEPS.find((s) => s > z) ?? ZOOM_MAX : [...ZOOM_STEPS].reverse().find((s) => s < z) ?? ZOOM_MIN);

/** The scale at which the 900 × 1200 sheet fits the room between the top keys and the bottom bar (100%). */
export const fitScale = (deskW: number, deskH: number, padTop: number, padBottom: number): number =>
  Math.min((deskW - 28) / 900, (deskH - padTop - padBottom - 20) / 1200, 1.05);

import { Stage } from './Stage';

/** The 3D desk, or null where the browser cannot draw it. */
export function createStage(canvas: HTMLCanvasElement): Stage | null {
  try { return new Stage(canvas); } catch (e) { console.warn('3D desk unavailable', e); return null; }
}

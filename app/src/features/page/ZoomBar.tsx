import { Minus, Plus } from '../../ui/icons';
import { stepZoom, ZOOM_MAX, ZOOM_MIN } from './zoom';

export function ZoomBar({ zoom, onZoom, onFit }: { zoom: number; onZoom(z: number): void; onFit(): void }) {
  return (
    <div className="zoom" role="group" aria-label="Zoom">
      <button type="button" className="zoom-key" id="zoomIn" aria-label="Zoom in" title="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => onZoom(stepZoom(zoom, 1))}><Plus /></button>
      <input type="range" id="zoomRange" min={ZOOM_MIN} max={ZOOM_MAX} step={5} value={zoom} aria-label="Zoom level" aria-orientation="vertical" aria-valuetext={`${zoom}%`}
        onChange={(e) => onZoom(+e.target.value)} />
      <button type="button" className="zoom-key" id="zoomOut" aria-label="Zoom out" title="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => onZoom(stepZoom(zoom, -1))}><Minus /></button>
      <button type="button" className="zoom-fit" id="zoomFit" title="Fit the page to the screen" onClick={onFit}>{zoom}%</button>
    </div>
  );
}

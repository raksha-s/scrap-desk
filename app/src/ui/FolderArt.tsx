import { skinFor } from '../engine/manifest';

/** The coloured folder picture, cropped to the folder itself (the source images have wide margins). */
export function FolderArt({ skin }: { skin: string }) {
  const f = skinFor(skin), g = f.geo;
  return (
    <span className="folder-art" style={{ aspectRatio: `${g.bw * f.w} / ${g.bh * f.h}` }}>
      <img src={f.file} alt="" draggable={false} style={{ width: `${100 / g.bw}%`, left: `${(-g.bx / g.bw) * 100}%`, top: `${(-g.by / g.bh) * 100}%` }} />
    </span>
  );
}

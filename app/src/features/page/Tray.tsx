// The bottom bar: a record, a camera and a stamp standing in a cardboard base.
import { MAX_IMAGES } from './addPiece';

export type Tool = 'album' | 'camera' | 'stickers';

export function Tray({ full, onTool }: { full: boolean; onTool(t: Tool): void }) {
  const image = full ? `Limit of ${MAX_IMAGES} images reached` : 'Add Image';
  return (
    <div className="tray pv-tools" role="toolbar" aria-label="Page tools">
      <button type="button" className="obj obj-record" id="toolAlbum" aria-label="Add Music Cover" onClick={() => onTool('album')}>
        <span className="obj-art" aria-hidden="true"><img className="rec-disc" src="art/ui/record/record.png" alt="" draggable={false} /><img className="rec-sleeve" src="art/ui/record/sleeve.png" alt="" draggable={false} /></span>
        <span className="obj-tip" aria-hidden="true">Add Music Cover</span>
      </button>
      <button type="button" className="obj obj-camera" id="toolCamera" aria-label={image} aria-disabled={full} onClick={() => onTool('camera')}>
        <span className="obj-art" aria-hidden="true"><img className="cam-print" src="art/ui/camera/print.png" alt="" draggable={false} /><img className="cam-body-art" src="art/ui/camera/camera.png" alt="" draggable={false} /></span>
        <span className="obj-tip" aria-hidden="true">{image}</span>
      </button>
      <button type="button" className="obj obj-sticker" id="toolStickers" aria-label="Add Sticker" onClick={() => onTool('stickers')}>
        <span className="obj-art" aria-hidden="true"><img className="stk-art" src="art/ui/sticker/stamp.png" alt="" draggable={false} /></span>
        <span className="obj-tip" aria-hidden="true">Add Sticker</span>
      </button>
    </div>
  );
}

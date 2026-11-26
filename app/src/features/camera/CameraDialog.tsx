// Instant photo: browser camera → polaroid that "develops". Falls back to the phone's camera picker.
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../ui/Dialog';
import { cameraSession } from './session';

interface Props { open: boolean; onShot(picture: Blob): void; onClose(): void }

export function CameraDialog(props: Props) {
  return (
    <Dialog open={props.open} onClose={props.onClose} className="dlg dlg-camera" id="cameraDlg" labelledBy="camTitle">
      <Camera {...props} />
    </Dialog>
  );
}

// on the page itself, so it carries on after the dialog has closed
function flash() {
  const f = document.createElement('div'); f.className = 'flash'; document.body.append(f); setTimeout(() => f.remove(), 520);
}

function Camera({ onShot, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage('');
    if (!navigator.mediaDevices?.getUserMedia) { setMessage('This browser can’t open a camera here (phones need https). Use “From files” to take or pick a photo.'); return; }
    let live = true;
    const session = cameraSession(navigator.mediaDevices);
    session.start(facing).then(async (stream) => {
      if (!stream || !live) return;
      video.current!.srcObject = stream; await video.current!.play();
    }).catch((e: Error) => {
      if (!live) return;
      setMessage(e.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow it in the address bar, or use “From files”.' : 'No camera found. Use “From files” to pick a photo instead.');
    });
    return () => { live = false; session.stop(); };
  }, [facing]);

  function shoot() {
    const v = video.current!;
    if (!v.srcObject || !v.videoWidth) { setMessage('No live camera yet — use “From files”.'); return; }
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    const x = c.getContext('2d')!;
    if (facing === 'user') { x.translate(c.width, 0); x.scale(-1, 1); }
    x.drawImage(v, 0, 0, c.width, c.height);
    flash();
    c.toBlob((blob) => { if (blob) onShot(blob); }, 'image/jpeg', 0.92);
  }

  return (
    <>
      <header className="dlg-head"><h2 id="camTitle">Take a polaroid</h2><button type="button" className="x" aria-label="Close" onClick={onClose}>×</button></header>
      <div className="cam-body">
        <div className={`viewfinder${facing === 'user' ? ' front' : ''}`} id="viewfinder">
          <video ref={video} id="camVideo" playsInline muted />
          {message && <p className="cam-msg">{message}</p>}
        </div>
        <div className="cam-row">
          <button type="button" className="key key-sm" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}><span>Flip</span></button>
          <button type="button" className="shutter" aria-label="Take photo" onClick={shoot} />
          <label className="key key-sm cam-file"><span>From files</span>
            <input type="file" id="camFile" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onShot(f); }} />
          </label>
        </div>
      </div>
    </>
  );
}

// Instant photo: browser camera → polaroid that "develops". Falls back to the phone's camera picker.
import { $, wireDialog } from './ui.js';

const dlg = $('#cameraDlg'), video = $('#camVideo'), msg = $('#camMsg'), vf = $('#viewfinder');
let stream = null, facing = 'environment', resolver;

function stop() { stream?.getTracks().forEach((t) => t.stop()); stream = null; video.srcObject = null; }

async function start() {
  stop(); msg.hidden = true;
  if (!navigator.mediaDevices?.getUserMedia) return fail('This browser can’t open a camera here (phones need https). Use “From files” to take or pick a photo.');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    video.srcObject = stream; await video.play();
    vf.classList.toggle('front', facing === 'user');
  } catch (e) {
    fail(e.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow it in the address bar, or use “From files”.' : 'No camera found. Use “From files” to pick a photo instead.');
  }
}
function fail(t) { msg.textContent = t; msg.hidden = false; }

function finish(result) { const r = resolver; resolver = null; stop(); dlg.close(); r?.(result); }

$('#camShoot').addEventListener('click', () => {
  if (!stream || !video.videoWidth) { fail('No live camera yet — use “From files”.'); return; }
  const w = video.videoWidth, h = video.videoHeight; const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); if (facing === 'user') { x.translate(w, 0); x.scale(-1, 1); } x.drawImage(video, 0, 0, w, h);
  const f = document.createElement('div'); f.className = 'flash'; document.body.append(f); setTimeout(() => f.remove(), 520);
  finish({ src: c.toDataURL('image/jpeg', 0.88), w, h });
});
$('#camFlip').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; start(); });
$('#camFile').addEventListener('change', (e) => {
  const f = e.target.files?.[0]; if (!f) return; const src = URL.createObjectURL(f);
  const i = new Image(); i.onload = () => finish({ src, w: i.naturalWidth, h: i.naturalHeight }); i.src = src; e.target.value = '';
});
dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
wireDialog(dlg);
dlg.addEventListener('close', () => { stop(); if (resolver) { const r = resolver; resolver = null; r(null); } });

export function openCamera() {
  dlg.showModal(); start();
  return new Promise((res) => { resolver = res; });
}

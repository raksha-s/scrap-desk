/** Opens the camera and makes sure it is released, even if permission arrives after the dialog has closed. */
export function cameraSession(media: MediaDevices) {
  let stream: MediaStream | null = null;
  let turn = 0;
  const release = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());
  const stop = () => { turn++; release(stream); stream = null; };
  return {
    async start(facing: 'user' | 'environment'): Promise<MediaStream | null> {
      stop(); const mine = turn;
      const got = await media.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (mine !== turn) { release(got); return null; }      // closed or flipped while waiting
      stream = got;
      return got;
    },
    stop,
  };
}

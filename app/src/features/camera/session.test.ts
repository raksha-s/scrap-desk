import { describe, expect, it, vi } from 'vitest';
import { cameraSession } from './session';

const streamOf = () => { const track = { stop: vi.fn() }; return { track, stream: { getTracks: () => [track] } as unknown as MediaStream }; };
const media = (getUserMedia: () => Promise<MediaStream>) => ({ getUserMedia: vi.fn(getUserMedia) }) as unknown as MediaDevices;

describe('camera session', () => {
  it('asks for the chosen camera and stops it', async () => {
    const { stream, track } = streamOf(); const m = media(async () => stream);
    const s = cameraSession(m);
    expect(await s.start('user')).toBe(stream);
    expect(m.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    s.stop(); expect(track.stop).toHaveBeenCalled();
  });

  it('stops a stream that arrives after the dialog closed', async () => {
    const { stream, track } = streamOf(); let resolve!: (s: MediaStream) => void;
    const s = cameraSession(media(() => new Promise((res) => { resolve = res; })));
    const pending = s.start('environment'); s.stop(); resolve(stream);
    expect(await pending).toBeNull();
    expect(track.stop).toHaveBeenCalled();
  });

  it('keeps only the latest camera when flipped quickly', async () => {
    const a = streamOf(), b = streamOf(); const waiting: ((s: MediaStream) => void)[] = [];
    const s = cameraSession(media(() => new Promise((res) => { waiting.push(res); })));
    const first = s.start('environment'), second = s.start('user');
    waiting[1](b.stream); waiting[0](a.stream);
    expect(await first).toBeNull(); expect(await second).toBe(b.stream);
    expect(a.track.stop).toHaveBeenCalled(); expect(b.track.stop).not.toHaveBeenCalled();
  });
});

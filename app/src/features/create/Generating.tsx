export interface Narration { line: string; sub: string; chips: string[] }

export function Generating({ narration }: { narration: Narration | null }) {
  if (!narration) return null;
  return (
    <div className="gen" id="gen" aria-live="polite">
      <div className="gen-card">
        <div className="gen-stack" aria-hidden="true"><i /><i /><i /></div>
        <p className="gen-line">{narration.line}</p>
        <p className="gen-sub">{narration.sub}</p>
        <ul className="gen-chips">{narration.chips.map((c, i) => <li key={`${c}-${i}`}>{c}</li>)}</ul>
      </div>
    </div>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseDay(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

export interface DateText { title: string; chip: string; short: string; span: 'day' | 'month' | 'multi' }

export function describeDates(start: string, end?: string): DateText {
  const a = parseDay(start), b = parseDay(end || start);
  const sameDay = a.getTime() === b.getTime();
  const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const lastDay = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
  const mon = (d: Date) => MONTHS[d.getMonth()];
  const m3 = (d: Date) => mon(d).slice(0, 3);
  if (sameDay) return { title: `${a.getDate()} ${mon(a)}`, chip: `${WD[a.getDay()]} · ${a.getFullYear()}`, short: `${a.getDate()} ${m3(a)} ${a.getFullYear()}`, span: 'day' };
  if (sameMonth) {
    const whole = a.getDate() === 1 && b.getDate() === lastDay;
    return { title: mon(a), chip: whole ? `${a.getDate()} – ${b.getDate()} ${m3(a)} ${a.getFullYear()}` : `${a.getDate()} – ${b.getDate()} ${m3(a)} ${a.getFullYear()}`, short: `${m3(a)} ${a.getFullYear()}`, span: 'month' };
  }
  if (a.getFullYear() === b.getFullYear()) return { title: `${m3(a)} – ${m3(b)}`, chip: `${a.getDate()} ${m3(a)} – ${b.getDate()} ${m3(b)} ${a.getFullYear()}`, short: `${m3(a)} – ${m3(b)} ${a.getFullYear()}`, span: 'multi' };
  return { title: `${a.getFullYear()} – ${b.getFullYear()}`, chip: `${a.getDate()} ${m3(a)} ${a.getFullYear()} – ${b.getDate()} ${m3(b)} ${b.getFullYear()}`, short: `${m3(a)} ${a.getFullYear()} – ${m3(b)} ${b.getFullYear()}`, span: 'multi' };
}

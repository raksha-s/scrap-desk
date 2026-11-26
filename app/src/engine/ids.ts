let n = 0;
// the random tail keeps ids made in different sessions (or tabs) apart once they are saved
export const uid = (prefix = 'x'): string =>
  `${prefix}${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Astro's trailingSlash: 'always' guard runs before Vite's development proxy.
// Use canonical URLs directly so POST bodies never depend on a redirect.
export function cerplusApiUrl(path: string): string {
  const index = path.indexOf('?');
  const pathname = index === -1 ? path : path.slice(0, index);
  const query = index === -1 ? '' : path.slice(index);
  return `/cerplus/api${pathname.replace(/\/+$/, '')}/${query}`;
}

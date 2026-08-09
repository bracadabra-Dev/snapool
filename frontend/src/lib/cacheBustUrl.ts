/** Append a version query param so replaced assets at a stable URL reload. */
export function cacheBustUrl(url: string | null | undefined, version: number): string | undefined {
  if (!url) return undefined;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${version}`;
}

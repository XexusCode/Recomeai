export function encodeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function decodeSlug(slug: string): string {
  return decodeURIComponent(slug).trim().replace(/-+/g, " ").replace(/\s+/g, " ");
}



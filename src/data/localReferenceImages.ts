/** Optional high-resolution artwork kept outside Git; published WebP previews remain portable. */
const images = import.meta.glob([
    '../../*.png',
    '!../../[123].png',
    '!../../structure*.png',
    '!../../ChatGPT*.png',
    '!../../UMP.png',
], {
    eager: true,
    query: '?url',
    import: 'default',
}) as Record<string, string>;

export function localReferenceImage(name: string): string | null {
    return images[`../../${name}`] ?? null;
}

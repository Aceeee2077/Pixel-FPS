/** Keyframed wrist motion; the hand never performs a full revolution. */
export function drawPose(progress: number, knife: boolean): number[] {
    const frames = knife ? [
        [0, .12, -.55, .16, -.65, .4, -.65],
        [.48, .04, -.12, .07, -.24, .25, -.38],
        [.78, -.02, .025, -.015, .05, -.06, .08],
        [1, 0, 0, 0, 0, 0, 0],
    ] : [[0, .03, -.42, .08, -.38, .12, -.1], [1, 0, 0, 0, 0, 0, 0]];
    const t = Math.max(0, Math.min(1, progress));
    const end = frames.findIndex((f, i) => i > 0 && t <= f[0]);
    const b = frames[end < 0 ? frames.length - 1 : end], a = frames[Math.max(0, (end < 0 ? frames.length - 1 : end) - 1)];
    const u = (t - a[0]) / (b[0] - a[0]), s = u * u * (3 - 2 * u);
    return a.slice(1).map((v, i) => v + (b[i + 1] - v) * s);
}

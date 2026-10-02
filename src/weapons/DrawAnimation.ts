/**
 * Keyframed wrist motion; the hand never performs a full revolution.
 *
 * The blade is drawn by turning it into the frame - it starts swung down and
 * flat, then rises into the idle grip. The travel is deliberately short: the
 * idle pose already sits low in the corner, so a long drop would carry the
 * whole viewmodel off the bottom of the screen.
 */
export function drawPose(progress: number, knife: boolean): number[] {
    const frames = knife ? [
        [0, .07, -.05, .05, .3, -.35, .42],
        [.48, .03, -.02, .02, .12, -.16, .2],
        [.78, -.01, .005, -.01, -.04, .06, -.07],
        [1, 0, 0, 0, 0, 0, 0],
    ] : [[0, .03, -.42, .08, -.38, .12, -.1], [1, 0, 0, 0, 0, 0, 0]];
    const t = Math.max(0, Math.min(1, progress));
    const end = frames.findIndex((f, i) => i > 0 && t <= f[0]);
    const b = frames[end < 0 ? frames.length - 1 : end], a = frames[Math.max(0, (end < 0 ? frames.length - 1 : end) - 1)];
    const u = (t - a[0]) / (b[0] - a[0]), s = u * u * (3 - 2 * u);
    return a.slice(1).map((v, i) => v + (b[i + 1] - v) * s);
}

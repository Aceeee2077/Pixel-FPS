import * as THREE from 'three';

/**
 * Procedural PBR textures drawn on canvas at runtime. The GLB carries geometry,
 * material names, roughness and metalness; these textures add the fine surface
 * detail (brick joints, asphalt grain, wood planks, brushed metal) without
 * shipping large texture files or depending on Blender-only nodes.
 */
export class SurfaceLibrary {
    private textures = new Map<string, { map: THREE.CanvasTexture; roughnessMap?: THREE.CanvasTexture }>();

    private canvas(w: number, h: number) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return { canvas: c, ctx: c.getContext('2d')! };
    }

    private noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount = 18) {
        const img = ctx.getImageData(0, 0, w, h);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() * 2 - 1) * amount;
            d[i] = Math.max(0, Math.min(255, d[i] + n));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
        }
        ctx.putImageData(img, 0, 0);
    }

    private makeTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true) {
        const { canvas, ctx } = this.canvas(w, h);
        draw(ctx);
        const t = new THREE.CanvasTexture(canvas);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = 4;
        return t;
    }

    private pair(w: number, h: number, drawColor: (ctx: CanvasRenderingContext2D) => void, drawRough: (ctx: CanvasRenderingContext2D) => void) {
        return { map: this.makeTexture(w, h, drawColor, true), roughnessMap: this.makeTexture(w, h, drawRough, false) };
    }

    private get(name: string, build: () => { map: THREE.CanvasTexture; roughnessMap?: THREE.CanvasTexture }) {
        if (!this.textures.has(name)) this.textures.set(name, build());
        return this.textures.get(name)!;
    }

    apply(material: THREE.Material) {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;
        const name = material.name;
        const kind = name.split(':')[0];
        const textured = new Set(['ground', 'asphalt', 'concrete', 'plaster', 'wood', 'metal', 'container', 'roof']);
        if (!textured.has(kind)) return;
        const t = this.get(name, () => this.build(kind, material.color));
        material.map = t.map;
        material.roughnessMap = t.roughnessMap ?? null;
        material.needsUpdate = true;
    }

    private build(kind: string, color: THREE.Color) {
        switch (kind) {
            case 'ground': return this.pair(256, 256, ctx => {
                ctx.fillStyle = '#c8c6ad'; ctx.fillRect(0, 0, 256, 256);
                this.noise(ctx, 256, 256, 14);
                for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(${80 + Math.random() * 60},${80 + Math.random() * 55},${70 + Math.random() * 45},.25)`; ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 1 + Math.random() * 2); }
                ctx.strokeStyle = 'rgba(60,60,50,.25)'; ctx.lineWidth = 1;
                for (let i = 0; i < 14; i++) { const p = Math.random() * 256; ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p + (Math.random() * 20 - 10), 256); ctx.stroke(); }
            }, ctx => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256); this.noise(ctx, 256, 256, 30); });

            case 'asphalt': return this.pair(256, 256, ctx => {
                ctx.fillStyle = '#879591'; ctx.fillRect(0, 0, 256, 256);
                this.noise(ctx, 256, 256, 22);
                for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(${80 + Math.random() * 70},${80 + Math.random() * 70},${80 + Math.random() * 70},.5)`; ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1); }
            }, ctx => { ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, 256, 256); this.noise(ctx, 256, 256, 28); });

            case 'concrete': return this.pair(256, 256, ctx => {
                ctx.fillStyle = '#879591'; ctx.fillRect(0, 0, 256, 256);
                this.noise(ctx, 256, 256, 12);
                ctx.strokeStyle = 'rgba(70,70,65,.35)'; ctx.lineWidth = 2;
                for (let x = 0; x <= 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
                for (let y = 0; y <= 256; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
            }, ctx => { ctx.fillStyle = '#e0e0e0'; ctx.fillRect(0, 0, 256, 256); this.noise(ctx, 256, 256, 20); });

            case 'plaster': return this.pair(256, 256, ctx => {
                ctx.fillStyle = '#e7e6d2'; ctx.fillRect(0, 0, 256, 256);
                this.noise(ctx, 256, 256, 8);
            }, ctx => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256); this.noise(ctx, 256, 256, 16); });

            case 'wood': return this.pair(256, 256, ctx => {
                ctx.fillStyle = '#b08850'; ctx.fillRect(0, 0, 256, 256);
                for (let y = 0; y < 256; y += 32) { ctx.fillStyle = `rgba(80,55,30,${0.15 + Math.random() * 0.2})`; ctx.fillRect(0, y, 256, 2); }
                for (let i = 0; i < 60; i++) { ctx.strokeStyle = 'rgba(70,48,28,.25)'; ctx.lineWidth = 1; const y = Math.random() * 256; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(80, y + (Math.random() * 12 - 6), 170, y + (Math.random() * 12 - 6), 256, y); ctx.stroke(); }
            }, ctx => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256); this.noise(ctx, 256, 256, 24); });

            case 'metal': return this.pair(256, 256, ctx => {
                ctx.fillStyle = '#527673'; ctx.fillRect(0, 0, 256, 256);
                const g = ctx.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(0.5, 'rgba(0,0,0,.12)'); g.addColorStop(1, 'rgba(255,255,255,.12)');
                ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
                for (let y = 0; y < 256; y += 8) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(0, y, 256, 1); }
            }, ctx => { ctx.fillStyle = '#4a4a4a'; ctx.fillRect(0, 0, 256, 256); this.noise(ctx, 256, 256, 12); });

            case 'container': return this.pair(256, 256, ctx => {
                ctx.fillStyle = `#${color.getHexString()}`; ctx.fillRect(0, 0, 256, 256);
                this.noise(ctx, 256, 256, 12);
                for (let y = 0; y < 256; y += 12) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, y, 256, 2); ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(0, y + 2, 256, 2); }
            }, ctx => { ctx.fillStyle = '#5a5a5a'; ctx.fillRect(0, 0, 256, 256); this.noise(ctx, 256, 256, 16); });

            case 'roof': return this.pair(256, 256, ctx => {
                ctx.fillStyle = '#3e6061'; ctx.fillRect(0, 0, 256, 256);
                this.noise(ctx, 256, 256, 14);
                ctx.strokeStyle = 'rgba(30,45,45,.5)'; ctx.lineWidth = 2;
                for (let y = 0; y <= 256; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
                for (let x = 0; x <= 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
            }, ctx => { ctx.fillStyle = '#d0d0d0'; ctx.fillRect(0, 0, 256, 256); this.noise(ctx, 256, 256, 20); });

            default: return this.pair(128, 128, ctx => {
                ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, 128, 128);
                this.noise(ctx, 128, 128, 14);
            }, ctx => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 128); this.noise(ctx, 128, 128, 18); });
        }
    }

    dispose() {
        for (const t of this.textures.values()) {
            t.map.dispose();
            t.roughnessMap?.dispose();
        }
        this.textures.clear();
    }
}

import * as THREE from 'three';
type Particle = {
    p: THREE.Vector3;
    v: THREE.Vector3;
    life: number;
    size: number;
    color: THREE.Color;
};
/** Bounded instance pools: 160 particles, 64 bullet marks, 32 tracers. */
export class ParticleManager {
    particles: Particle[] = Array.from({ length: 160 }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, size: .08, color: new THREE.Color() }));
    mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 160);
    marks = new THREE.InstancedMesh(new THREE.BoxGeometry(.065, .065, .065), new THREE.MeshBasicMaterial({ color: 0x4b5146 }), 64);
    markData = Array.from({ length: 64 }, () => ({ p: new THREE.Vector3(), life: 0 }));
    tracers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffdf90, transparent: true, opacity: .55 }), 32);
    traceData = Array.from({ length: 32 }, () => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), life: 0 }));
    cursor = 0;
    markCursor = 0;
    traceCursor = 0;
    dummy = new THREE.Object3D();
    constructor(scene: THREE.Scene) { this.mesh.frustumCulled = false; this.marks.frustumCulled = false; this.tracers.frustumCulled = false; scene.add(this.mesh, this.marks, this.tracers); this.update(0); }
    emit(point: THREE.Vector3, color: number, count: number, speed = 2, size = .07) { for (let i = 0; i < count; i++) {
        const p = this.particles[this.cursor++ % 160];
        p.p.copy(point);
        p.v.set((Math.random() - .5) * speed, Math.random() * speed + 1, (Math.random() - .5) * speed);
        p.life = .3 + Math.random() * .5;
        p.size = size;
        p.color.setHex(color);
    } }
    impact(point: THREE.Vector3, direction: THREE.Vector3) { const p = point.clone().addScaledVector(direction, -.045); this.emit(p, 0xd8cba5, 4); const m = this.markData[this.markCursor++ % 64]; m.p.copy(p); m.life = 12; }
    death(point: THREE.Vector3, color: number) { this.emit(point.clone().add(new THREE.Vector3(0, 1, 0)), color, 22, 7, .2); }
    tracer(a: THREE.Vector3, b: THREE.Vector3) { const t = this.traceData[this.traceCursor++ % 32]; t.a.copy(a); t.b.copy(b); t.life = .055; }
    clear() { this.particles.forEach(p => p.life = 0); this.markData.forEach(p => p.life = 0); this.traceData.forEach(p => p.life = 0); this.update(0); }
    update(dt: number) {
        this.particles.forEach((p, i) => { p.life = Math.max(0, p.life - dt); if (p.life > 0) {
            p.v.y -= 8 * dt;
            p.p.addScaledVector(p.v, dt);
        } this.dummy.position.copy(p.p); this.dummy.rotation.set(p.life * 5, p.life * 3, 0); this.dummy.scale.setScalar(p.life > 0 ? p.size * Math.min(1, p.life / .12) : 0); this.dummy.updateMatrix(); this.mesh.setMatrixAt(i, this.dummy.matrix); this.mesh.setColorAt(i, p.color); });
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor)
            this.mesh.instanceColor.needsUpdate = true;
        this.markData.forEach((m, i) => { m.life = Math.max(0, m.life - dt); this.dummy.position.copy(m.p); this.dummy.rotation.set(0, 0, 0); this.dummy.scale.setScalar(m.life > 0 ? 1 : 0); this.dummy.updateMatrix(); this.marks.setMatrixAt(i, this.dummy.matrix); });
        this.marks.instanceMatrix.needsUpdate = true;
        this.traceData.forEach((t, i) => { t.life = Math.max(0, t.life - dt); this.dummy.position.copy(t.a).lerp(t.b, .5); const dir = t.b.clone().sub(t.a); if (dir.lengthSq() > 0)
            this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); this.dummy.scale.set(t.life > 0 ? .016 : 0, t.a.distanceTo(t.b), t.life > 0 ? .016 : 0); this.dummy.updateMatrix(); this.tracers.setMatrixAt(i, this.dummy.matrix); });
        this.tracers.instanceMatrix.needsUpdate = true;
    }
}

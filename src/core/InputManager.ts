export type CaptureResult = 'locked' | 'compatibility' | 'cancelled';
type CaptureMode = 'idle' | 'requesting' | 'locked' | 'compatibility';

export class InputManager {
    keys = new Set<string>();
    pressed = new Set<string>();
    firing = false;
    firePressed = false;
    aiming = false;
    altFiring = false;
    altFirePressed = false;
    dx = 0;
    dy = 0;
    wheel = 0;
    lastLockError = '';
    mode: CaptureMode = 'idle';
    onCaptureLost = () => {};
    private preferCompatibility = false;
    private pointer: { x: number; y: number } | null = null;
    private pending: {
        promise: Promise<CaptureResult>;
        resolve: (result: CaptureResult) => void;
        timeout: number;
        errorTimeout: number;
    } | null = null;

    constructor(public canvas: HTMLCanvasElement) {
        canvas.tabIndex = -1;
        window.addEventListener('keydown', e => {
            if (!this.active || (e.target as HTMLElement)?.matches('input,select,textarea')) return;
            if (['Tab', 'Space', 'ControlLeft', 'ControlRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'Digit1', 'Digit2', 'Digit3', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
            if (!this.keys.has(e.code)) this.pressed.add(e.code);
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', e => {
            this.keys.delete(e.code);
            if (this.active && e.code === 'Tab') e.preventDefault();
        });
        window.addEventListener('mousemove', e => {
            if (this.mode === 'locked' && this.locked) {
                this.dx += e.movementX;
                this.dy += e.movementY;
            } else if (this.mode === 'compatibility' && e.target === canvas) {
                if (this.pointer) {
                    this.dx += e.clientX - this.pointer.x;
                    this.dy += e.clientY - this.pointer.y;
                }
                this.pointer = { x: e.clientX, y: e.clientY };
            }
        });
        canvas.addEventListener('mouseleave', () => { this.pointer = null; });
        window.addEventListener('mouseout', e => {
            if (this.mode === 'compatibility' && !e.relatedTarget) this.onCaptureLost();
        });
        window.addEventListener('mousedown', e => {
            if (!this.active || (!this.locked && e.target !== canvas)) return;
            if (e.button === 0) { this.firing = true; this.firePressed = true; }
            if (e.button === 2) {
                this.aiming = true;
                this.altFiring = true;
                this.altFirePressed = true;
            }
        });
        window.addEventListener('mouseup', e => {
            if (e.button === 0) this.firing = false;
            if (e.button === 2) {
                this.aiming = false;
                this.altFiring = false;
            }
        });
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        window.addEventListener('wheel', e => {
            if (this.active && (this.locked || e.target === canvas)) {
                this.wheel += Math.sign(e.deltaY);
                e.preventDefault();
            }
        }, { passive: false });
        window.addEventListener('blur', () => this.clear());
        document.addEventListener('pointerlockchange', () => {
            if (this.locked) {
                // A grant arriving after ESC/navigation must not restart play or trap the cursor.
                if (this.mode === 'idle') { document.exitPointerLock(); return; }
                this.mode = 'locked';
                this.preferCompatibility = false;
                this.lastLockError = '';
                this.finish('locked');
            } else if (this.mode === 'locked') {
                this.mode = 'idle';
                this.clear();
                this.onCaptureLost();
            }
        });
        document.addEventListener('pointerlockerror', () => {
            const request = this.pending;
            if (!request) return;
            // Promise-based browsers provide a useful rejection; legacy browsers only emit this event.
            request.errorTimeout = window.setTimeout(() => {
                if (this.pending === request) this.fallback('This browser did not grant mouse capture.');
            }, 0);
        });
    }

    get locked() { return document.pointerLockElement === this.canvas; }
    get active() { return this.mode === 'locked' || this.mode === 'compatibility'; }

    lock(): Promise<CaptureResult> {
        if (this.pending) return this.pending.promise;
        this.clear();
        this.canvas.focus({ preventScroll: true });
        if (this.locked) { this.mode = 'locked'; return Promise.resolve('locked'); }
        if (this.preferCompatibility) {
            this.mode = 'compatibility';
            return Promise.resolve('compatibility');
        }
        this.mode = 'requesting';
        let resolve!: (result: CaptureResult) => void;
        const promise = new Promise<CaptureResult>(done => { resolve = done; });
        const request = { promise, resolve, timeout: 0, errorTimeout: 0 };
        this.pending = request;
        request.timeout = window.setTimeout(() => {
            if (this.pending === request) this.fallback('Mouse capture did not respond.');
        }, 1500);
        try {
            // Called synchronously from the user's click; never retry without a fresh gesture.
            const result = this.canvas.requestPointerLock();
            result?.then(() => {
                if (this.pending === request && this.locked) {
                    this.mode = 'locked';
                    this.finish('locked');
                }
            }).catch(error => {
                if (this.pending === request) this.fallback(String(error));
            });
        } catch (error) {
            this.fallback(String(error));
        }
        return promise;
    }

    private fallback(reason: string) {
        this.lastLockError = reason;
        this.preferCompatibility = true;
        this.mode = 'compatibility';
        this.clear();
        if (import.meta.env.DEV) console.info('[input:pointer-lock] Compatibility controls enabled:', reason);
        this.finish('compatibility');
    }

    private finish(result: CaptureResult) {
        const request = this.pending;
        this.pending = null;
        if (!request) return;
        clearTimeout(request.timeout);
        clearTimeout(request.errorTimeout);
        request.resolve(result);
    }

    suspend() {
        this.mode = 'idle';
        this.finish('cancelled');
        this.clear();
        if (this.locked) document.exitPointerLock();
    }

    update(dt: number) {
        if (this.mode !== 'compatibility') return;
        // Free pointers cannot wrap around the viewport. Edge turning and arrow keys allow full rotation.
        const edge = (position: number, size: number) => {
            const margin = Math.min(42, size * .08);
            return position < margin ? -(1 - position / margin) : position > size - margin ? (position - size + margin) / margin : 0;
        };
        if (this.pointer) {
            const bounds = this.canvas.getBoundingClientRect();
            this.dx += edge(this.pointer.x - bounds.left, bounds.width) * 850 * dt;
            this.dy += edge(this.pointer.y - bounds.top, bounds.height) * 650 * dt;
        }
        this.dx += (Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft'))) * 700 * dt;
        this.dy += (Number(this.keys.has('ArrowDown')) - Number(this.keys.has('ArrowUp'))) * 500 * dt;
    }

    clear() {
        this.keys.clear(); this.pressed.clear(); this.firing = false; this.aiming = false;
        this.firePressed = false; this.altFiring = false; this.altFirePressed = false; this.dx = 0; this.dy = 0; this.wheel = 0; this.pointer = null;
    }
    endFrame() { this.pressed.clear(); this.firePressed = false; this.altFirePressed = false; this.dx = 0; this.dy = 0; this.wheel = 0; }
}

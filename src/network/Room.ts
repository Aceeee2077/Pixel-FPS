import Peer, { type DataConnection, type PeerOptions } from 'peerjs';

export const PROTOCOL = 1;
export const cleanName = (value: unknown) => (typeof value === 'string' ? value.replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16) : '') || 'PLAYER';
export const roomCode = (value: string) => value.trim().toUpperCase();
const peerId = (code: string) => `blockstrike-v${PROTOCOL}-${code}`;

/** Signalling establishes WebRTC; gameplay packets go directly to the room host. */
export class Room {
    peer?: Peer;
    connections = new Map<string, DataConnection>();
    host = false;
    code = '';
    onData: (peer: string, data: unknown) => void = () => {};
    onLeave: (peer: string) => void = () => {};
    onError: (message: string) => void = () => {};
    private timer?: ReturnType<typeof setTimeout>;
    private retry?: ReturnType<typeof setTimeout>;
    private cancelOpen?: () => void;
    async open(host: boolean, code = '') {
        this.close(); this.host = host;
        this.code = host ? Array.from(crypto.getRandomValues(new Uint8Array(8)), v => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v % 32]).join('') : roomCode(code);
        if (!/^[A-Z2-9]{8}$/.test(this.code)) throw new Error('code');
        const options: PeerOptions = { debug: 0 };
        // Optional private PeerServer and TURN configuration, supplied at build time.
        if (import.meta.env.VITE_PEER_HOST) Object.assign(options, {
            host: import.meta.env.VITE_PEER_HOST,
            port: Number(import.meta.env.VITE_PEER_PORT || 443),
            path: import.meta.env.VITE_PEER_PATH || '/', secure: import.meta.env.VITE_PEER_SECURE !== 'false',
        });
        if (import.meta.env.VITE_ICE_SERVERS) options.config = { iceServers: JSON.parse(import.meta.env.VITE_ICE_SERVERS) };
        const peer = this.peer = host ? new Peer(peerId(this.code), options) : new Peer(options);
        await new Promise<void>((resolve, reject) => {
            let done = false;
            this.cancelOpen = () => reject(new Error('cancelled'));
            const fail = (message: string) => {
                if (this.peer !== peer) return;
                if (!done) { done = true; this.cancelOpen = undefined; clearTimeout(this.timer); reject(new Error(message)); }
                else this.onError(message);
            };
            const ready = () => { if (!done) { done = true; this.cancelOpen = undefined; clearTimeout(this.timer); resolve(); } };
            this.timer = setTimeout(() => fail('timeout'), 18000);
            peer.on('error', error => fail(error.type));
            peer.on('disconnected', () => {
                if (this.peer === peer && !peer.destroyed) this.retry = setTimeout(() => { if (this.peer === peer && peer.disconnected) peer.reconnect(); }, 1500);
            });
            peer.on('connection', connection => {
                if (!host || this.connections.size >= 7 || this.connections.has(connection.peer)) { connection.close(); return; }
                this.bind(connection);
            });
            peer.on('open', () => {
                if (host) ready();
                else { const connection = peer.connect(peerId(this.code), { reliable: true, serialization: 'json' }); this.bind(connection); connection.on('open', ready); }
            });
        }).catch(error => { if (this.peer === peer) this.close(); throw error; });
    }
    private bind(connection: DataConnection) {
        this.connections.set(connection.peer, connection);
        const handshake = setTimeout(() => connection.close(), 8000);
        connection.once('data', () => clearTimeout(handshake));
        connection.once('close', () => clearTimeout(handshake));
        connection.on('data', data => { if (this.connections.get(connection.peer) === connection) this.onData(connection.peer, data); });
        connection.on('close', () => { if (this.connections.get(connection.peer) === connection) { this.connections.delete(connection.peer); this.onLeave(connection.peer); } });
        connection.on('error', () => connection.close());
    }
    send(data: unknown, target?: string) {
        for (const [id, connection] of this.connections) {
            if (target && id !== target) continue;
            const lossy = typeof data === 'object' && data !== null && ['pose', 'state'].includes((data as { type: string }).type);
            if (connection.open && (!lossy || connection.dataChannel?.bufferedAmount < 65536)) connection.send(data);
        }
    }
    close() {
        clearTimeout(this.timer); clearTimeout(this.retry);
        this.cancelOpen?.(); this.cancelOpen = undefined;
        const peer = this.peer; this.peer = undefined;
        const connections = [...this.connections.values()]; this.connections.clear();
        connections.forEach(c => c.close()); peer?.destroy();
    }
}

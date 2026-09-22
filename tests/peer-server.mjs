import { parentPort } from 'node:worker_threads';
import { PeerServer } from 'peer';

// PeerServer keeps private maintenance timers. A worker gives tests a clean shutdown boundary.
PeerServer({ port: 9001, path: '/', host: '127.0.0.1' }, () => parentPort.postMessage('ready'));

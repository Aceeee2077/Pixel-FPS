/**
 * Minimal reader for Valve Pak (VPK v1/v2) directories.
 *
 * CS2 ships its content as `pak01_dir.vpk` plus ~500 numbered data packs. The
 * directory file holds the full path index; the payload lives either inline
 * (`archiveIndex === 0x7fff`) or in `pak01_<nnn>.vpk`.
 *
 * This reads the index and pulls single entries out of the read-only install.
 * It never writes to the game directory. Converting the extracted Source 2
 * resources is Source 2 Viewer's job (see `source2viewer.mjs`).
 */
import fs from 'node:fs';
import path from 'node:path';

const SIGNATURE = 0x55aa1234;
const INLINE_ARCHIVE = 0x7fff;

/** Directory headers are 12 bytes in v1 and 28 in v2. */
function readHeader(buffer) {
    if (buffer.length < 12) throw new Error('VPK is truncated');
    const signature = buffer.readUInt32LE(0);
    if (signature !== SIGNATURE) throw new Error(`not a VPK (signature 0x${signature.toString(16)})`);
    const version = buffer.readUInt32LE(4);
    const treeSize = buffer.readUInt32LE(8);
    const headerSize = version === 2 ? 28 : 12;
    return { version, treeSize, headerSize };
}

/** NUL-terminated UTF-8 string, advancing the cursor. */
function readCString(buffer, cursor) {
    const end = buffer.indexOf(0, cursor.offset);
    if (end < 0) throw new Error('unterminated string in VPK tree');
    const value = buffer.toString('utf8', cursor.offset, end);
    cursor.offset = end + 1;
    return value;
}

/**
 * Parse the directory tree into one flat entry per file.
 *
 * The tree is nested extension -> path -> filename; each leaf carries the
 * archive location. Preload bytes sit inline immediately after the leaf.
 */
export function readVpkIndex(dirFile) {
    const buffer = fs.readFileSync(dirFile);
    const { version, treeSize, headerSize } = readHeader(buffer);
    const treeEnd = headerSize + treeSize;
    if (treeEnd > buffer.length) throw new Error('VPK directory tree runs past the end of the file');

    const entries = [];
    const cursor = { offset: headerSize };
    while (cursor.offset < treeEnd) {
        const extension = readCString(buffer, cursor);
        if (extension === '') break;
        while (cursor.offset < treeEnd) {
            const folder = readCString(buffer, cursor);
            if (folder === '') break;
            while (cursor.offset < treeEnd) {
                const name = readCString(buffer, cursor);
                if (name === '') break;
                const crc = buffer.readUInt32LE(cursor.offset);
                const preloadBytes = buffer.readUInt16LE(cursor.offset + 4);
                const archiveIndex = buffer.readUInt16LE(cursor.offset + 6);
                const entryOffset = buffer.readUInt32LE(cursor.offset + 8);
                const entryLength = buffer.readUInt32LE(cursor.offset + 12);
                const terminator = buffer.readUInt16LE(cursor.offset + 16);
                cursor.offset += 18;
                if (terminator !== 0xffff) throw new Error(`bad VPK entry terminator for ${name}.${extension}`);
                let preload = null;
                if (preloadBytes > 0) { preload = buffer.subarray(cursor.offset, cursor.offset + preloadBytes); cursor.offset += preloadBytes; }
                const entryPath = `${folder === ' ' ? '' : `${folder}/`}${name}.${extension}`;
                entries.push({ path: entryPath, crc, archiveIndex, offset: entryOffset, length: entryLength, preload });
            }
        }
    }
    return { version, entries, dataStart: treeEnd, dirFile };
}

/** Data pack that holds an entry's payload; `null` when it is inline. */
function archivePath(dirFile, archiveIndex) {
    const suffix = `_${String(archiveIndex).padStart(3, '0')}.vpk`;
    return dirFile.replace(/_dir\.vpk$/i, suffix);
}

/** Read one indexed entry's bytes. Inline entries come from the directory file. */
export function readVpkEntry(index, entry) {
    const inline = entry.archiveIndex === INLINE_ARCHIVE;
    const source = inline ? index.dirFile : archivePath(index.dirFile, entry.archiveIndex);
    if (!inline && !fs.existsSync(source)) throw new Error(`missing data pack ${path.basename(source)} for ${entry.path}`);
    const chunks = [];
    if (entry.preload?.length) chunks.push(entry.preload);
    if (entry.length > 0) {
        const handle = fs.openSync(source, 'r');
        try {
            const payload = Buffer.alloc(entry.length);
            const base = inline ? index.dataStart : 0;
            fs.readSync(handle, payload, 0, entry.length, base + entry.offset);
            chunks.push(payload);
        } finally { fs.closeSync(handle); }
    }
    return Buffer.concat(chunks);
}

/** Case-insensitive substring search over the index. */
export function findEntries(index, needle) {
    const lowered = needle.toLowerCase();
    return index.entries.filter(entry => entry.path.toLowerCase().includes(lowered));
}

export function entriesWithExtension(index, extension) {
    const suffix = `.${extension.replace(/^\./, '').toLowerCase()}`;
    return index.entries.filter(entry => entry.path.toLowerCase().endsWith(suffix));
}

/** Open the game's directory pack once and reuse the parsed index. */
export function openVpk(vpkPath) {
    const started = Date.now();
    const index = readVpkIndex(vpkPath);
    return { ...index, ms: Date.now() - started };
}

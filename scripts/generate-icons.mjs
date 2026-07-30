/**
 * Genera los íconos PWA para MobilHospital Panel Técnico.
 * Usa solo APIs nativas de Node.js (zlib, fs) — sin dependencias externas.
 *
 * Diseño: fondo #0f172a (slate-900), letras "MH" en blanco.
 *
 * Corre: node scripts/generate-icons.mjs
 */

import { createDeflateRaw } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { promisify } from 'util'

const deflateRaw = promisify(createDeflateRaw)

// ─── Utilidades PNG ────────────────────────────────────────────────────────────

function crc32(buf) {
    const table = crc32.table || (crc32.table = (() => {
        const t = new Uint32Array(256)
        for (let n = 0; n < 256; n++) {
            let c = n
            for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
            t[n] = c
        }
        return t
    })())
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const crcInput = Buffer.concat([typeBytes, data])
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(crcInput), 0)
    return Buffer.concat([len, typeBytes, data, crcBuf])
}

async function buildPNG(size, bgR, bgG, bgB, drawFn) {
    // RGBA row por row con filter byte 0 (None)
    const rawRows = []
    for (let y = 0; y < size; y++) {
        const row = Buffer.alloc(1 + size * 4)
        row[0] = 0 // filter None
        for (let x = 0; x < size; x++) {
            const [r, g, b, a] = drawFn(x, y, size)
            const off = 1 + x * 4
            row[off]     = r
            row[off + 1] = g
            row[off + 2] = b
            row[off + 3] = a
        }
        rawRows.push(row)
    }
    const raw = Buffer.concat(rawRows)

    // Comprimir con deflate-raw (zlib sin header — PNG usa zlib wrapper pero Node deflateRaw lo añade al nivel PNG)
    // Usamos zlib.deflate (con header zlib) que es lo que PNG espera
    const { deflate } = await import('zlib')
    const compressed = await new Promise((resolve, reject) => {
        deflate(raw, { level: 6 }, (err, buf) => err ? reject(err) : resolve(buf))
    })

    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(size, 0)
    ihdr.writeUInt32BE(size, 4)
    ihdr[8]  = 8  // bit depth
    ihdr[9]  = 6  // color type RGBA
    ihdr[10] = 0  // compression
    ihdr[11] = 0  // filter
    ihdr[12] = 0  // interlace

    return Buffer.concat([
        signature,
        chunk('IHDR', ihdr),
        chunk('IDAT', compressed),
        chunk('IEND', Buffer.alloc(0)),
    ])
}

// ─── Función de dibujo: fondo slate-900 + texto "MH" centrado ─────────────────

function makeDrawFn(size) {
    // Parámetros del texto "MH" bitmap — escala según tamaño
    const scale  = Math.floor(size / 32)   // 6x para 192, 16x para 512, 5x para 180
    const margin = Math.floor(size * 0.18)

    // Mapa de bits de "M" y "H" en una cuadrícula 5×7
    const M_BITS = [
        0b10001,
        0b11011,
        0b10101,
        0b10001,
        0b10001,
        0b10001,
        0b10001,
    ]
    const H_BITS = [
        0b10001,
        0b10001,
        0b10001,
        0b11111,
        0b10001,
        0b10001,
        0b10001,
    ]

    const charW = 5 * scale
    const charH = 7 * scale
    const gap   = 2 * scale
    const totalW = charW * 2 + gap
    const startX = Math.floor((size - totalW) / 2)
    const startY = Math.floor((size - charH) / 2)

    function isLetter(px, py) {
        const lx = px - startX
        const ly = py - startY
        if (lx < 0 || ly < 0 || lx >= totalW || ly >= charH) return false
        const row = Math.floor(ly / scale)
        if (lx < charW) {
            // M
            const col = Math.floor(lx / scale)
            return !!(M_BITS[row] & (1 << (4 - col)))
        }
        if (lx >= charW + gap) {
            // H
            const col = Math.floor((lx - charW - gap) / scale)
            return !!(H_BITS[row] & (1 << (4 - col)))
        }
        return false
    }

    // Esquinas redondeadas: radio = 22% del tamaño (para "maskable" icon)
    const r = size * 0.22
    const cx = size / 2, cy = size / 2

    return function drawPixel(x, y, _size) {
        // Rounded rect clip
        const dx = Math.max(Math.abs(x - cx) - (cx - r), 0)
        const dy = Math.max(Math.abs(y - cy) - (cy - r), 0)
        if (dx * dx + dy * dy > r * r) return [0, 0, 0, 0] // transparente

        if (isLetter(x, y)) return [255, 255, 255, 255] // blanco
        return [0x0f, 0x17, 0x2a, 255] // #0f172a slate-900
    }
}

// ─── Generar archivos ─────────────────────────────────────────────────────────

const outDir = new URL('../public/icons', import.meta.url).pathname
    .replace(/^\/([A-Za-z]:)/, '$1') // fix Windows absolute path

mkdirSync(outDir, { recursive: true })

const icons = [
    { name: 'icon-192.png',        size: 192 },
    { name: 'icon-512.png',        size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of icons) {
    const png = await buildPNG(size, 0x0f, 0x17, 0x2a, makeDrawFn(size))
    const dest = `${outDir}/${name}`
    writeFileSync(dest, png)
    console.log(`✓ ${name} (${size}×${size}) → ${dest}`)
}

console.log('\nÍconos generados correctamente.')

// Genera una imagen PNG válida para la comprobación de humo.
// Tiene que ser una imagen decodificable de verdad: el selector de fotos la
// pasa por createImageBitmap para reducirla y corregir su orientación, así que
// unos bytes inventados fallarían al decodificar y no probarían nada.
const zlib = require('node:zlib');
const fs = require('node:fs');

const LADO = 64;

function trozo(tipo, datos) {
  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(cuerpo));
  return Buffer.concat([longitud, cuerpo, crc]);
}

// Cabecera: ancho, alto, 8 bits por canal, color tipo 2 (RGB), sin interlazado
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(LADO, 0);
ihdr.writeUInt32BE(LADO, 4);
ihdr[8] = 8;
ihdr[9] = 2;

// Píxeles: un degradado, para que se distinga de una imagen en blanco.
const filas = [];
for (let y = 0; y < LADO; y++) {
  const fila = Buffer.alloc(1 + LADO * 3); // el primer byte es el filtro (0)
  for (let x = 0; x < LADO; x++) {
    const i = 1 + x * 3;
    fila[i] = (x * 4) % 256;
    fila[i + 1] = (y * 4) % 256;
    fila[i + 2] = 128;
  }
  filas.push(fila);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  trozo('IHDR', ihdr),
  trozo('IDAT', zlib.deflateSync(Buffer.concat(filas))),
  trozo('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync(process.argv[2], png);
console.log(`PNG de ${LADO}x${LADO} escrito en ${process.argv[2]} (${png.length} bytes)`);

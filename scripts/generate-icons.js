const fs = require('fs');
const path = require('path');

// Simple PNG generator - creates solid purple icons with proper headers
// These are minimal valid PNGs that work as PWA icons

function createPNG(size) {
  // PNG file structure
  const width = size;
  const height = size;

  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Create image data - gradient purple background
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      // Create gradient from #8B5CF6 to #6366F1
      const t = (x + y) / (width + height);
      const r = Math.round(139 + (99 - 139) * t);
      const g = Math.round(92 + (102 - 92) * t);
      const b = Math.round(246 + (241 - 246) * t);

      // Add rounded corner mask
      const cx = width / 2;
      const cy = height / 2;
      const cornerRadius = size * 0.1875; // ~18.75% radius

      let inBounds = true;
      // Check corners
      if (x < cornerRadius && y < cornerRadius) {
        const dx = cornerRadius - x;
        const dy = cornerRadius - y;
        inBounds = (dx * dx + dy * dy) <= cornerRadius * cornerRadius;
      } else if (x >= width - cornerRadius && y < cornerRadius) {
        const dx = x - (width - cornerRadius);
        const dy = cornerRadius - y;
        inBounds = (dx * dx + dy * dy) <= cornerRadius * cornerRadius;
      } else if (x < cornerRadius && y >= height - cornerRadius) {
        const dx = cornerRadius - x;
        const dy = y - (height - cornerRadius);
        inBounds = (dx * dx + dy * dy) <= cornerRadius * cornerRadius;
      } else if (x >= width - cornerRadius && y >= height - cornerRadius) {
        const dx = x - (width - cornerRadius);
        const dy = y - (height - cornerRadius);
        inBounds = (dx * dx + dy * dy) <= cornerRadius * cornerRadius;
      }

      if (inBounds) {
        rawData.push(r, g, b);
      } else {
        rawData.push(10, 10, 15); // Background color #0A0A0F
      }
    }
  }

  // Compress with zlib
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });

  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = makeCRCTable();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeCRCTable() {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c >>> 0;
  }
  return table;
}

// Generate icons
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

sizes.forEach(size => {
  const png = createPNG(size);
  const filename = path.join(iconsDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Created ${filename}`);
});

// Create favicon.ico (using 32x32 PNG as base)
const favicon32 = createPNG(32);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.ico'), favicon32);
console.log('Created favicon.ico');

// Create apple-touch-icon
const appleTouchIcon = createPNG(180);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), appleTouchIcon);
console.log('Created apple-touch-icon.png');

console.log('All icons generated successfully!');

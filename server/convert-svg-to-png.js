import { createCanvas, loadImage } from 'canvas';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WIDTH = 720;
const HEIGHT = 720;

async function convertSvgToPng() {
  // Read the SVG file
  const svgPath = path.join(__dirname, '../static/raptor-svg.svg');
  const svgText = await fs.readFile(svgPath, 'utf-8');

  // Colorize to black and white (same as browser)
  const color1 = '#ffffff'; // White
  const color2 = '#000000'; // Black
  const color3 = '#ffffff'; // White

  const colorizedSvg = svgText
    .replaceAll('fill="#ed1c24"', `fill="${color1}"`)
    .replaceAll('fill="#231f20"', `fill="${color2}"`)
    .replaceAll('fill="#fff"', `fill="${color3}"`);

  // Create a canvas and draw the SVG
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Convert SVG to data URL
  const svgDataUrl = 'data:image/svg+xml;base64,' + Buffer.from(colorizedSvg).toString('base64');

  // Load and draw the image
  const img = await loadImage(svgDataUrl);
  ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);

  // Save as PNG
  const outputPath = path.join(__dirname, 'raptor-bw-from-svg.png');
  const buffer = canvas.toBuffer('image/png', { compressionLevel: 0, filters: canvas.PNG_FILTER_NONE });
  await fs.writeFile(outputPath, buffer);

  console.log(`✓ Converted SVG to PNG: ${outputPath}`);
  console.log(`  Resolution: ${WIDTH}x${HEIGHT}`);
  console.log(`  File size: ${(buffer.length / 1024).toFixed(1)}KB`);
}

convertSvgToPng().catch(console.error);

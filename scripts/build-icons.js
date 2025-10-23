const sharp = require('sharp');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const pngToIco = require('png-to-ico');

async function buildIcons() {
  const svgPath = path.join(__dirname, '..', 'assets', 'icon.svg');
  const buildDir = path.join(__dirname, '..', 'assets', 'build');

  // Ensure build directory exists
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const svgBuffer = fs.readFileSync(svgPath);

  // Generate PNG icons in various sizes
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512];

  console.log('Generating PNG icons...');
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(buildDir, `icon_${size}x${size}.png`));
    console.log(`✓ Generated ${size}x${size} PNG`);
  }

  // Generate ICNS for macOS
  console.log('Generating ICNS for macOS...');
  const icnsSizes = [16, 32, 64, 128, 256, 512];
  const iconsetDir = path.join(buildDir, 'icon.iconset');

  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }

  for (const size of icnsSizes) {
    // Regular size
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsetDir, `icon_${size}x${size}.png`));

    // Retina size (@2x)
    if (size <= 256) {
      await sharp(svgBuffer)
        .resize(size * 2, size * 2)
        .png()
        .toFile(path.join(iconsetDir, `icon_${size}x${size}@2x.png`));
    }
  }

  // Convert iconset to ICNS using iconutil (macOS only)
  if (process.platform === 'darwin') {
    const { execSync } = require('child_process');
    try {
      execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(buildDir, 'icon.icns')}"`, { stdio: 'inherit' });
      console.log('✓ Generated ICNS file');
    } catch (error) {
      console.warn('Warning: ICNS generation failed. Make sure iconutil is available on macOS.');
    }
  } else {
    console.log('Skipping ICNS generation (macOS only)');
  }

  // Generate ICO for Windows
  console.log('Generating ICO for Windows...');
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoBuffers = [];

  for (const size of icoSizes) {
    const buffer = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    icoBuffers.push(buffer);
  }

  // Generate ICO file (using png-to-ico default export)
  const icoBuffer = await pngToIco.default(icoBuffers);
  await fsPromises.writeFile(path.join(buildDir, 'icon.ico'), icoBuffer);
  console.log('✓ Generated ICO file');

  console.log('Icon generation complete!');
  console.log(`Output directory: ${buildDir}`);
}

if (require.main === module) {
  buildIcons().catch(console.error);
}

module.exports = { buildIcons };
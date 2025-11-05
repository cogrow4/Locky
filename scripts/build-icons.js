#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

// Ensure the build directory exists
const buildDir = path.join(__dirname, '../assets/build');
fs.ensureDirSync(buildDir);

// Check if the icon source exists
const iconSource = path.join(__dirname, '../assets/icon.svg');
if (!fs.existsSync(iconSource)) {
  console.error('Error: Source icon.svg not found in assets directory');
  process.exit(1);
}

console.log('Generating application icons...');

// Make the function async
async function generateIcons() {
  try {
  // Create macOS .icns file
  console.log('Generating macOS .icns file...');
  const iconsetDir = path.join(buildDir, 'icon.iconset');
  
  // Clean up any existing iconset
  fs.removeSync(iconsetDir);
  fs.ensureDirSync(iconsetDir);
  
  // Generate icons at different sizes
  const sizes = [16, 32, 64, 128, 256, 512, 1024];
  for (const size of sizes) {
    const size2x = size * 2;
    const size2xFile = path.join(iconsetDir, `icon_${size}x${size}@2x.png`);
    const size1xFile = path.join(iconsetDir, `icon_${size}x${size}.png`);
    
    // Generate @2x icon
    await sharp(iconSource).resize(size2x, size2x).toFile(size2xFile);
    
    // Generate @1x icon (only if not the same as @2x)
    if (size !== size2x) {
      await sharp(iconSource).resize(size, size).toFile(size1xFile);
    }
  }
  
  // Convert to .icns
  execSync(`iconutil -c icns ${iconsetDir} -o ${path.join(buildDir, 'icon.icns')}`);
  
  // Create Windows .ico file
  console.log('Generating Windows .ico file...');
  await sharp(iconSource).resize(256, 256).toFile(path.join(buildDir, 'icon.ico'));
  
  // Create Linux .png icon
  console.log('Generating Linux .png icon...');
  await sharp(iconSource).resize(512, 512).toFile(path.join(buildDir, 'icon.png'));
  
    console.log('Icon generation complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error generating icons:', error.message);
    process.exit(1);
  }
}

// Run the async function
generateIcons();

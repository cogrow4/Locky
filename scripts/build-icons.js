#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
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
    execSync(`npx sharp -i ${iconSource} -o ${size2xFile} resize ${size2x} png`);
    
    // Generate @1x icon (only if not the same as @2x)
    if (size !== size2x) {
      execSync(`npx sharp -i ${iconSource} -o ${size1xFile} resize ${size} png`);
    }
  }
  
  // Convert to .icns
  execSync(`iconutil -c icns ${iconsetDir} -o ${path.join(buildDir, 'icon.icns')}`);
  
  // Create Windows .ico file
  console.log('Generating Windows .ico file...');
  execSync(`npx sharp -i ${iconSource} -o ${path.join(buildDir, 'icon.ico')} resize 256 ico`);
  
  // Create Linux .png icon
  console.log('Generating Linux .png icon...');
  execSync(`npx sharp -i ${iconSource} -o ${path.join(buildDir, 'icon.png')} resize 512 png`);
  
  console.log('Icon generation complete!');
  process.exit(0);
} catch (error) {
  console.error('Error generating icons:', error.message);
  process.exit(1);
}

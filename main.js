const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const { access, constants, readdir, readFile, writeFile, unlink, stat, mkdir } = require('fs').promises;
const { join, dirname, basename } = require('path');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const CryptoJS = require('crypto-js');

let mainWindow;

// Initialize IPC Handlers
function initializeIpcHandlers() {
    // File System IPC Handlers
    ipcMain.handle('fs-access', async (event, { path, mode = constants.F_OK }) => {
        try {
            // Convert string modes to numeric constants for backward compatibility
            let numericMode = constants.F_OK;
            if (typeof mode === 'string') {
                switch (mode.toLowerCase()) {
                    case 'read':
                        numericMode = constants.R_OK;
                        break;
                    case 'write':
                        numericMode = constants.W_OK;
                        break;
                    case 'execute':
                        numericMode = constants.X_OK;
                        break;
                    default:
                        numericMode = constants.F_OK;
                }
            } else {
                numericMode = mode;
            }

            await access(path, numericMode);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') return false;
            console.error('fs-access error:', error);
            throw error;
        }
    });

    ipcMain.handle('fs-read-json', async (event, filePath) => {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading JSON file ${filePath}:`, error);
            throw error;
        }
    });

    ipcMain.handle('fs-write-json', async (event, filePath, data) => {
        try {
            await fs.ensureDir(dirname(filePath));
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error(`Error writing JSON file ${filePath}:`, error);
            throw error;
        }
    });

    ipcMain.handle('fs-unlink', async (event, filePath) => {
        try {
            await unlink(filePath);
            return true;
        } catch (error) {
            console.error(`Error deleting file ${filePath}:`, error);
            throw error;
        }
    });

    ipcMain.handle('fs-remove', async (event, { path: dirPath }) => {
        try {
            await fs.remove(dirPath);
            return true;
        } catch (error) {
            console.error(`Error removing directory ${dirPath}:`, error);
            throw error;
        }
    });

    ipcMain.handle('fs-readdir', async (event, dirPath) => {
        try {
            return await fs.readdir(dirPath);
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
            throw error;
        }
    });

    ipcMain.handle('fs-stat', async (event, filePath) => {
        try {
            return await fs.stat(filePath);
        } catch (error) {
            console.error(`Error getting stats for ${filePath}:`, error);
            throw error;
        }
    });

    ipcMain.handle('select-directory', async (event) => {
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openDirectory', 'createDirectory'],
                title: 'Select or Create Vault Directory',
                buttonLabel: 'Select',
                defaultPath: app.getPath('documents')
            });
            return result.canceled ? null : result.filePaths[0];
        } catch (error) {
            console.error('Error in select-directory:', error);
            throw error;
        }
    });

    // Vault related handlers
    ipcMain.handle('create-vault', async (event, { path: vaultsDir, password, name }) => {
        try {
            // Ensure the vaults directory exists
            await fs.ensureDir(vaultsDir);
            console.log('Ensured vaults directory exists:', vaultsDir);

            // Create a unique vault directory name (use vault name with timestamp)
            const vaultDirName = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
            const vaultPath = join(vaultsDir, vaultDirName);

            console.log('Creating vault at:', vaultPath);

            // Check if vault already exists
            if (await fs.pathExists(vaultPath)) {
                return { success: false, error: 'A vault with this name already exists.' };
            }

            // Create vault directory
            await fs.ensureDir(vaultPath);

            // Generate a salt for key derivation
            const salt = CryptoJS.lib.WordArray.random(128/8);

            // Derive the encryption key from password and salt
            const key = CryptoJS.PBKDF2(password, salt, {
                keySize: 512/32,
                iterations: 1000
            });

            // Create vault configuration
            const config = {
                name: name,
                createdAt: new Date().toISOString(),
                version: '1.0',
                salt: salt.toString(),
                key: key.toString()
            };

            // Write vault configuration
            const configPath = join(vaultPath, '.vaultconfig');
            await fs.writeJson(configPath, config);

            // Create vault index (empty initially)
            const indexPath = join(vaultPath, '.vaultindex');
            await fs.writeJson(indexPath, []);

            console.log('Vault created successfully');

            return { success: true, vaultPath };
        } catch (error) {
            console.error('Error in create-vault handler:', error);
            return { success: false, error: error.message || 'Failed to create vault' };
        }
    });

    ipcMain.handle('load-vault', async (event, { vaultPath, password }) => {
        try {
            console.log('=== DEBUG: Load Vault Handler ===');
            console.log('Vault path:', vaultPath);
            console.log('Password provided:', password ? '[HIDDEN]' : 'null');
            const configPath = join(vaultPath, '.vaultconfig');

            // Check if vault exists
            if (!await fs.pathExists(vaultPath)) {
                console.log('❌ Vault directory does not exist');
                return {
                    success: false,
                    error: 'Vault directory does not exist.'
                };
            }

            // Check if config exists
            if (!await fs.pathExists(configPath)) {
                console.log('❌ Vault configuration not found');
                return {
                    success: false,
                    error: 'Vault configuration not found. This may not be a valid vault.'
                };
            }

            // Read vault config
            const config = await fs.readJson(configPath);
            console.log('✅ Config loaded:', { name: config.name, version: config.version });

            try {
                // Verify password by deriving key and comparing
                console.log('🔐 Verifying password...');
                const salt = CryptoJS.enc.Hex.parse(config.salt);
                const key = CryptoJS.PBKDF2(password, salt, {
                    keySize: 512/32,
                    iterations: 1000
                });

                console.log('Generated key length:', key.toString().length);
                console.log('Stored key length:', config.key.length);
                console.log('Keys match:', key.toString() === config.key);

                if (key.toString() !== config.key) {
                    console.log('❌ Password verification failed - keys do not match');
                    return {
                        success: false,
                        error: 'Incorrect password.'
                    };
                }

                // Read vault index
                const indexPath = join(vaultPath, '.vaultindex');
                let index = [];
                if (await fs.pathExists(indexPath)) {
                    index = await fs.readJson(indexPath);
                }

                console.log('✅ Vault loaded successfully');
                return {
                    success: true,
                    vault: {
                        name: config.name,
                        path: vaultPath,
                        createdAt: config.createdAt,
                        version: config.version,
                        fileCount: index.length
                    },
                    files: index
                };

            } catch (error) {
                console.error('❌ Error verifying vault password:', error);
                return {
                    success: false,
                    error: 'Failed to verify vault password.'
                };
            }

        } catch (error) {
            console.error('❌ Error in load-vault handler:', error);
            return {
                success: false,
                error: error.message || 'Failed to load vault'
            };
        }
    });

    // Add delete-vault handler
    ipcMain.handle('delete-vault', async (event, { vaultPath, password }) => {
        try {
            console.log('Attempting to delete vault...');

            // First verify the vault exists and password is correct by calling load-vault directly
            const configPath = join(vaultPath, '.vaultconfig');

            if (!await fs.pathExists(vaultPath)) {
                return { success: false, error: 'Vault directory does not exist.' };
            }

            if (!await fs.pathExists(configPath)) {
                return { success: false, error: 'Vault configuration not found. This may not be a valid vault.' };
            }

            const config = await fs.readJson(configPath);

            try {
                const salt = CryptoJS.enc.Hex.parse(config.salt);
                const key = CryptoJS.PBKDF2(password, salt, {
                    keySize: 512/32,
                    iterations: 1000
                });

                if (key.toString() !== config.key) {
                    return { success: false, error: 'Incorrect password.' };
                }

                // Password verified, delete the vault directory
                await fs.remove(vaultPath);
                console.log('Vault deleted successfully:', vaultPath);

                return { success: true };
            } catch (error) {
                console.error('Error verifying vault password:', error);
                return { success: false, error: 'Failed to verify vault password.' };
            }

        } catch (error) {
            console.error('Error deleting vault:', error);
            return { success: false, error: error.message || 'Failed to delete vault' };
        }
    });

    ipcMain.handle('list-vaults', async (event, searchPath) => {
        try {
            console.log('Searching for vaults...');
            const vaults = [];

            if (!await fs.pathExists(searchPath)) {
                return { success: true, vaults: [] };
            }

            const items = await fs.readdir(searchPath, { withFileTypes: true });

            for (const item of items) {
                if (item.isDirectory()) {
                    const vaultPath = join(searchPath, item.name);
                    const configPath = join(vaultPath, '.vaultconfig');

                    if (await fs.pathExists(configPath)) {
                        try {
                            const config = await fs.readJson(configPath);
                            const indexPath = join(vaultPath, '.vaultindex');
                            let fileCount = 0;

                            if (await fs.pathExists(indexPath)) {
                                const index = await fs.readJson(indexPath);
                                fileCount = index.length;
                            }

                            vaults.push({
                                name: config.name,
                                path: vaultPath,
                                createdAt: config.createdAt,
                                version: config.version,
                                fileCount: fileCount
                            });
                        } catch (error) {
                            console.warn(`Error reading vault config for ${item.name}:`, error);
                        }
                    }
                }
            }

            return { success: true, vaults };

        } catch (error) {
            console.error('Error in list-vaults handler:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('encrypt-file', async (event, { vaultPath, filePath, password }) => {
        try {
            // Read the vault config to get the salt
            const config = await fs.readJson(join(vaultPath, '.vaultconfig'));

            // Derive the same key
            const salt = CryptoJS.enc.Hex.parse(config.salt);
            const key = CryptoJS.PBKDF2(password, salt, {
                keySize: 512/32,
                iterations: 1000
            });

            // Read the file
            const fileData = await fs.readFile(filePath);

            // Encrypt the file data
            const encrypted = CryptoJS.AES.encrypt(
                fileData.toString('base64'),
                key.toString()
            ).toString();

            // Generate a unique filename
            const fileId = uuidv4();
            const fileName = basename(filePath);
            const encryptedFilePath = join(vaultPath, `${fileId}.enc`);

            // Save the encrypted file
            await fs.writeFile(encryptedFilePath, encrypted);

            // Update the vault index
            const indexFile = join(vaultPath, '.vaultindex');
            let index = [];

            if (await fs.pathExists(indexFile)) {
                index = await fs.readJson(indexFile);
            }

            index.push({
                id: fileId,
                name: fileName,
                originalPath: filePath,
                encryptedPath: encryptedFilePath,
                addedAt: new Date().toISOString()
            });

            await fs.writeJson(indexFile, index);

            return { success: true, fileId };
        } catch (error) {
            console.error('Error encrypting file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('decrypt-file', async (event, { vaultPath, fileId, password, outputPath }) => {
        try {
            // Read the vault config to get the salt
            const config = await fs.readJson(join(vaultPath, '.vaultconfig'));

            // Derive the same key
            const salt = CryptoJS.enc.Hex.parse(config.salt);
            const key = CryptoJS.PBKDF2(password, salt, {
                keySize: 512/32,
                iterations: 1000
            });

            // Read the vault index
            const indexFile = join(vaultPath, '.vaultindex');
            if (!await fs.pathExists(indexFile)) {
                throw new Error('Vault index not found');
            }

            const index = await fs.readJson(indexFile);
            const fileInfo = index.find(f => f.id === fileId);

            if (!fileInfo) {
                throw new Error('File not found in vault');
            }

            // Read the encrypted file
            const encryptedData = await fs.readFile(fileInfo.encryptedPath, 'utf8');

            // Decrypt the file data
            const decrypted = CryptoJS.AES.decrypt(encryptedData, key.toString());
            const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
            const fileData = Buffer.from(decryptedStr, 'base64');

            // Save the decrypted file
            await fs.ensureDir(dirname(outputPath));
            await fs.writeFile(outputPath, fileData);

            return { success: true, outputPath };
        } catch (error) {
            console.error('Error decrypting file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-file', async (event, { vaultPath, fileId, password, fileName }) => {
        try {
            // Show save dialog
            const result = await dialog.showSaveDialog(mainWindow, {
                title: `Save ${fileName}`,
                defaultPath: fileName,
                properties: ['createDirectory']
            });

            if (result.canceled || !result.filePath) {
                return { success: false, error: 'Save cancelled' };
            }

            const outputPath = result.filePath;

            // Now decrypt to the selected path
            const config = await fs.readJson(join(vaultPath, '.vaultconfig'));

            const salt = CryptoJS.enc.Hex.parse(config.salt);
            const key = CryptoJS.PBKDF2(password, salt, {
                keySize: 512/32,
                iterations: 1000
            });

            const index = await fs.readJson(join(vaultPath, '.vaultindex'));
            const fileInfo = index.find(f => f.id === fileId);

            if (!fileInfo) {
                throw new Error('File not found in vault');
            }

            const encryptedData = await fs.readFile(fileInfo.encryptedPath, 'utf8');

            const decrypted = CryptoJS.AES.decrypt(encryptedData, key.toString());
            const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
            const fileData = Buffer.from(decryptedStr, 'base64');

            await fs.ensureDir(dirname(outputPath));
            await fs.writeFile(outputPath, fileData);

            return { success: true };
        } catch (error) {
            console.error('Error saving file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-file-content', async (event, { vaultPath, fileId, password }) => {
        try {
            const config = await fs.readJson(join(vaultPath, '.vaultconfig'));

            const salt = CryptoJS.enc.Hex.parse(config.salt);
            const key = CryptoJS.PBKDF2(password, salt, {
                keySize: 512/32,
                iterations: 1000
            });

            const index = await fs.readJson(join(vaultPath, '.vaultindex'));
            const fileInfo = index.find(f => f.id === fileId);

            if (!fileInfo) {
                throw new Error('File not found in vault');
            }

            const encryptedData = await fs.readFile(fileInfo.encryptedPath, 'utf8');

            const decrypted = CryptoJS.AES.decrypt(encryptedData, key.toString());
            const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
            const content = Buffer.from(decryptedStr, 'base64').toString('base64');

            return content;
        } catch (error) {
            console.error('Error getting file content:', error);
            return null;
        }
    });

    ipcMain.handle('recover-vault', async (event, { recoveryPhrase, newPassword }) => {
        try {
            const parts = recoveryPhrase.split(':');
            if (parts.length !== 4 || parts[0] !== 'VAULT_RECOVERY') {
                return { success: false, error: 'Invalid recovery phrase format' };
            }

            const vaultPath = parts[1];
            const name = parts[2];

            if (!await fs.pathExists(vaultPath)) {
                return { success: false, error: 'Vault not found' };
            }

            const configPath = join(vaultPath, '.vaultconfig');

            if (!await fs.pathExists(configPath)) {
                return { success: false, error: 'Vault configuration not found' };
            }

            const config = await fs.readJson(configPath);

            if (config.name !== name) {
                return { success: false, error: 'Recovery phrase does not match vault' };
            }

            // Generate new salt and key
            const salt = CryptoJS.lib.WordArray.random(128/8);
            const key = CryptoJS.PBKDF2(newPassword, salt, {
                keySize: 512/32,
                iterations: 1000
            });

            // Update config
            config.salt = salt.toString();
            config.key = key.toString();

            await fs.writeJson(configPath, config);

            return { success: true };
        } catch (error) {
            console.error('Error recovering vault:', error);
            return { success: false, error: error.message };
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
    });

    // Load the index.html file
    mainWindow.loadFile('index.html');

    // Create menu
    const menuTemplate = [
        {
            label: 'Vault',
            submenu: [
                {
                    label: 'New Vault',
                    click: () => {
                        // Trigger create vault
                        mainWindow.webContents.send('menu-action', { action: 'new-vault' });
                    }
                },
                {
                    label: 'List Vaults',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'list-vaults' });
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Lock Vault',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'lock-vault' });
                    }
                },
                {
                    label: 'Delete Vault',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'delete-vault' });
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'toggleFullscreen' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About Locky',
                    click: () => {
                        const { dialog } = require('electron');
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About Locky',
                            message: 'Locky - Secure File Vault',
                            detail: 'An encrypted file storage application with built-in preview and secure password protection.\n\nVersion: 1.0.0\n\nCopyright Coen Greenleaf 2025'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    // Open the DevTools in development mode
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

// Initialize the application
function initializeApp() {
    // Initialize IPC handlers
    initializeIpcHandlers();

    // Create the browser window
    createWindow();

    // Handle window controls
    ipcMain.on('minimize-window', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.on('maximize-window', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.on('close-window', () => {
        if (mainWindow) mainWindow.close();
    });
}

// Start the application
app.whenReady().then(initializeApp);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

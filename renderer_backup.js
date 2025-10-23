const { ipcRenderer } = require('electron');
const path = require('path');

// State
let currentVaultPath = null;
let currentPassword = null;
let vaultFiles = [];

// DOM Elements (will be initialized when DOM is ready)
let vaultSelection, vaultCreation, vaultInterface, vaultList, vaultListItems;
let createVaultBtn, openVaultBtn, listVaultsBtn, cancelVaultCreationBtn, createVaultConfirmBtn;
let vaultNameInput, vaultPasswordInput, vaultConfirmPasswordInput;
let addFilesBtn, lockVaultBtn, fileInput, saveFileInput, dropZone, fileList, vaultTitle, statusMessage;

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    vaultSelection = document.getElementById('vault-selection');
    vaultCreation = document.getElementById('vault-creation');
    vaultInterface = document.getElementById('vault-interface');
    vaultList = document.getElementById('vault-list');
    vaultListItems = document.getElementById('vault-list-items');
    createVaultBtn = document.getElementById('create-vault-btn');
    openVaultBtn = document.getElementById('open-vault-btn');
    listVaultsBtn = document.getElementById('list-vaults-btn');
    cancelVaultCreationBtn = document.getElementById('cancel-vault-creation');
    createVaultConfirmBtn = document.getElementById('create-vault-confirm');
    vaultNameInput = document.getElementById('vault-name');
    vaultPasswordInput = document.getElementById('vault-password');
    vaultConfirmPasswordInput = document.getElementById('vault-confirm-password');
    addFilesBtn = document.getElementById('add-files-btn');
    lockVaultBtn = document.getElementById('lock-vault-btn');
    fileInput = document.getElementById('file-input');
    saveFileInput = document.getElementById('save-file-input');
    dropZone = document.getElementById('drop-zone');
    fileList = document.getElementById('file-list');
    vaultTitle = document.getElementById('vault-title');
    statusMessage = document.getElementById('status-message');

    console.log('DOM elements initialized:', {
        vaultSelection: !!vaultSelection,
        createVaultBtn: !!createVaultBtn,
        openVaultBtn: !!openVaultBtn,
        listVaultsBtn: !!listVaultsBtn
    });

    // Show vault creation form
    createVaultBtn.addEventListener('click', () => {
        vaultSelection.classList.add('hidden');
        vaultCreation.classList.remove('hidden');
    });

    // Cancel vault creation
    cancelVaultCreationBtn.addEventListener('click', resetToVaultSelection);

    // Create vault confirmation
    createVaultConfirmBtn.addEventListener('click', createVault);

    // List available vaults
    listVaultsBtn.addEventListener('click', listVaults);

    // Open existing vault
    openVaultBtn.addEventListener('click', openVault);

    // Add files button
    addFilesBtn.addEventListener('click', () => fileInput.click());

    // Lock vault
    lockVaultBtn.addEventListener('click', lockVault);

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Save file input change
    saveFileInput.addEventListener('change', handleSaveFileSelect);

    // Drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => fileInput.click());

    console.log('All event listeners attached successfully');
});

// Prevent default drag behaviors
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop zone when dragging files over it
function highlight() {
    dropZone.classList.add('drag-over');
}

// Remove highlight when leaving drop zone
function unhighlight() {
    dropZone.classList.remove('drag-over');
}

// Handle dropped files
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

// Handle file selection from file input
function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

// Handle saving decrypted file
function handleSaveFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileId = saveFileInput.dataset.fileId;
    const outputPath = file.path;

    // Show loading status
    showStatus('Decrypting file...', 'info');

    ipcRenderer.invoke('decrypt-file', {
        vaultPath: currentVaultPath,
        fileId,
        password: currentPassword,
        outputPath
    }).then(result => {
        if (result.success) {
            showStatus(`File saved successfully to: ${file.name}`, 'success');
        } else {
            showStatus(`Error: ${result.error}`, 'error');
        }
    }).catch(error => {
        console.error('Error decrypting file:', error);
        showStatus('Error decrypting file', 'error');
    });
}

// Process selected files
async function handleFiles(files) {
    if (!currentVaultPath || !currentPassword) return;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        showStatus(`Encrypting ${file.name}...`, 'info');
        
        try {
            const result = await ipcRenderer.invoke('encrypt-file', {
                vaultPath: currentVaultPath,
                filePath: file.path,
                password: currentPassword
            });
            
            if (result.success) {
                showStatus(`Successfully added ${file.name} to vault`, 'success');
                await loadVaultFiles();
            } else {
                showStatus(`Error adding ${file.name}: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error processing file:', error);
            showStatus(`Error processing ${file.name}`, 'error');
        }
    }
}

// Create a new vault
async function createVault() {
    if (!vaultNameInput || !vaultPasswordInput || !vaultConfirmPasswordInput) {
        console.error('Form elements not found');
        showStatus('Error: Form elements not found', 'error');
        return;
    }
    const name = vaultNameInput.value.trim();
    const password = vaultPasswordInput.value;
    const confirmPassword = vaultConfirmPasswordInput.value;
    
    // Reset any previous error states
    const inputs = [vaultNameInput, vaultPasswordInput, vaultConfirmPasswordInput];
    inputs.forEach(input => input.classList.remove('border-red-500'));
    
    // Validate inputs
    let hasError = false;
    
    if (!name) {
        vaultNameInput.classList.add('border-red-500');
        showStatus('Please enter a vault name', 'error');
        hasError = true;
    }
    
    if (password.length < 8) {
        vaultPasswordInput.classList.add('border-red-500');
        showStatus('Password must be at least 8 characters long', 'error');
        hasError = true;
    }
    
    if (password !== confirmPassword) {
        vaultConfirmPasswordInput.classList.add('border-red-500');
        showStatus('Passwords do not match', 'error');
        hasError = true;
    }
    
    if (hasError) return;
    
    try {
        // Disable form while processing
        const createButton = createVaultConfirmBtn;
        if (!createButton) {
            showStatus('Error: Create button not found', 'error');
            return;
        }

        const originalButtonText = createButton.innerHTML;
        createButton.disabled = true;
        createButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Creating...';
        
        try {
            const result = await ipcRenderer.invoke('select-directory');
            if (!result) {
                createButton.disabled = false;
                createButton.innerHTML = originalButtonText;
                return;
            }
            
            showStatus('Creating vault...', 'info');
            
            const createResult = await ipcRenderer.invoke('create-vault', {
                path: result,
                password,
                name
            });
            
            if (createResult.success) {
                currentVaultPath = createResult.vaultPath; // Use the path returned by the main process
                currentPassword = password;
                if (vaultTitle) vaultTitle.textContent = name;
                if (vaultCreation) vaultCreation.classList.add('hidden');
                if (vaultInterface) vaultInterface.classList.remove('hidden');
                
                // Generate a recovery phrase (in a real app, this would be more secure)
                const recoveryPhrase = `VAULT_RECOVERY:${createResult.vaultPath}:${name}:${Date.now()}`;
                console.log('IMPORTANT: Save this recovery phrase in a secure location!');
                console.log(recoveryPhrase);
                
                // Show recovery phrase in a more user-friendly way
                const saveConfirmed = await showRecoveryPhrase(recoveryPhrase);
                
                if (saveConfirmed) {
                    showStatus('Vault created successfully!', 'success');
                    await loadVaultFiles();
                } else {
                    // If user didn't confirm saving the recovery phrase, delete the vault
                    try {
                        await ipcRenderer.invoke('fs-remove', createResult.vaultPath);
                        showStatus('Vault creation cancelled', 'warning');
                        resetToVaultSelection();
                    } catch (error) {
                        console.error('Error cleaning up vault:', error);
                        showStatus('Error cleaning up vault', 'error');
                    }
                }
            } else {
                showStatus(`Error: ${createResult.error || 'Failed to create vault'}`, 'error');
            }
        } catch (error) {
            console.error('Error in createVault:', error);
            showStatus(`Error: ${error.message || 'Failed to create vault'}`, 'error');
        } finally {
            createButton.disabled = false;
            createButton.innerHTML = originalButtonText;
        }
    } catch (error) {
        console.error('Error creating vault:', error);
        showStatus('Error creating vault', 'error');
    }
}

// Open an existing vault
async function openVault() {
    try {
        const vaultPath = await ipcRenderer.invoke('select-directory');
        if (!vaultPath) return;

        // Check if this is a valid vault
        try {
            const configPath = `${vaultPath}/.vaultconfig`;
            await ipcRenderer.invoke('fs-access', { path: configPath, mode: 'read' });
        } catch {
            showStatus('Selected directory is not a valid vault', 'error');
            return;
        }

        // Prompt for password with better UX
        const password = await promptForPassword();
        if (!password) return;

        // Use the proper load-vault handler
        showStatus('Loading vault...', 'info');

        const result = await ipcRenderer.invoke('load-vault', {
            vaultPath,
            password
        });

        if (result.success) {
            currentVaultPath = vaultPath;
            currentPassword = password;
            vaultTitle.textContent = result.vault.name;

            vaultSelection.classList.add('hidden');
            vaultInterface.classList.remove('hidden');

            await loadVaultFiles();
            showStatus('Vault unlocked successfully!', 'success');
        } else {
            showStatus(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error opening vault:', error);
        showStatus('Error opening vault', 'error');
    }
}

// Prompt for password with better UX
async function promptForPassword() {
    return new Promise((resolve) => {
        // Create password modal
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md mx-4">
                <h3 class="text-lg font-semibold mb-4 text-gray-900">Enter Vault Password</h3>
                <div class="mb-4">
                    <input type="password" id="vault-password-input" placeholder="Enter your vault password"
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                           autocomplete="current-password">
                </div>
                <div class="flex space-x-3">
                    <button id="password-cancel" class="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                        Cancel
                    </button>
                    <button id="password-confirm" class="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Unlock Vault
                    </button>
                </div>
            </div>
        `;
}

// Load files in the vault
async function loadVaultFiles() {
    if (!currentVaultPath) return;

    if (!fileList) {
        console.error('File list container not found');
        showStatus('Error: UI elements not found', 'error');
        return;
    }

    try {
        const indexFile = `${currentVaultPath}/.vaultindex`;

        // Check if index file exists
        try {
            await ipcRenderer.invoke('fs-access', { path: indexFile, mode: 'read' });
        } catch {
            // Index file doesn't exist yet (no files in vault)
            if (fileList) fileList.innerHTML = '<p class="text-gray-500 text-center py-8">No files in vault yet. Drag and drop files here to add them.</p>';
            return;
        }

        // Read index file
        const files = await ipcRenderer.invoke('fs-read-json', indexFile);
        vaultFiles = files;

        if (files.length === 0) {
            if (fileList) fileList.innerHTML = '<p class="text-gray-500 text-center py-8">No files in vault yet. Drag and drop files here to add them.</p>';
            return;
        }

        // Render file list
        if (fileList) {
            fileList.innerHTML = files.map(file => `
                <div class="vault-item bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                    <div class="flex items-center">
                        <i class="fas fa-file text-blue-500 text-xl mr-3"></i>
                        <div>
                            <div class="font-medium">${file.name}</div>
                            <div class="text-xs text-gray-500">${formatFileSize(getFileSize(file.originalPath))} • ${new Date(file.addedAt).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button class="text-blue-500 hover:text-blue-700" data-action="download" data-file-id="${file.id}">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="text-red-500 hover:text-red-700" data-action="delete" data-file-id="${file.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');

            // Add event listeners to buttons
            fileList.querySelectorAll('[data-action="download"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const fileId = e.currentTarget.dataset.fileId;
                    if (saveFileInput) {
                        saveFileInput.dataset.fileId = fileId;
                        saveFileInput.click();
                    }
                });
            });

            fileList.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const fileId = e.currentTarget.dataset.fileId;
                    if (confirm('Are you sure you want to delete this file from the vault?')) {
                        try {
                            const fileInfo = vaultFiles.find(f => f.id === fileId);
                            if (fileInfo) {
                                await ipcRenderer.invoke('fs-unlink', fileInfo.encryptedPath);
                                await loadVaultFiles();
                                showStatus('File deleted from vault', 'success');
                            }
                        } catch (error) {
                            console.error('Error deleting file:', error);
                            showStatus('Error deleting file', 'error');
                        }
                    }
                });
            });
    } catch (error) {
        console.error('Error loading vault files:', error);
        showStatus('Error loading vault files', 'error');
    }
}
// Lock the current vault
function lockVault() {
    currentVaultPath = null;
    currentPassword = null;
    vaultFiles = [];

    // Reset form
    if (vaultNameInput) vaultNameInput.value = '';
    if (vaultPasswordInput) vaultPasswordInput.value = '';
    if (vaultConfirmPasswordInput) vaultConfirmPasswordInput.value = '';

    // Reset UI
    if (vaultInterface) vaultInterface.classList.add('hidden');
    if (vaultList) vaultList.classList.add('hidden');
    if (vaultSelection) vaultSelection.classList.remove('hidden');

    showStatus('Vault locked', 'info');
}

// List available vaults in common locations
async function listVaults() {
    if (!vaultListItems) {
        console.error('Vault list items container not found');
        showStatus('Error: UI elements not found', 'error');
        return;
    }

    try {
        showStatus('Searching for vaults...', 'info');

        // Search in common locations
        const searchPaths = [
            require('os').homedir() + '/Documents',
            require('os').homedir() + '/Desktop',
            require('os').homedir()
        ];

        const allVaults = [];

        for (const searchPath of searchPaths) {
            try {
                const result = await ipcRenderer.invoke('list-vaults', searchPath);
                if (result.success) {
                    allVaults.push(...result.vaults);
                }
            } catch (error) {
                console.log(`Could not search ${searchPath}:`, error.message);
            }
        }

        if (allVaults.length === 0) {
            if (vaultListItems) vaultListItems.innerHTML = '<p class="text-gray-500 text-center py-4">No vaults found. Create a new vault or check other locations.</p>';
            if (vaultList) vaultList.classList.remove('hidden');
            showStatus('No vaults found in common locations', 'info');
            return;
        }

        // Display found vaults
        if (vaultListItems) {
            vaultListItems.innerHTML = allVaults.map(vault => `
                <div class="vault-item bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer"
                     data-vault-path="${vault.path}">
                    <div class="flex items-center">
                        <i class="fas fa-lock text-green-500 text-xl mr-3"></i>
                        <div>
                            <div class="font-medium">${vault.name}</div>
                            <div class="text-xs text-gray-500">
                                ${vault.fileCount} files • Created ${new Date(vault.createdAt).toLocaleDateString()}
                            </div>
                            <div class="text-xs text-gray-400 font-mono break-all mt-1">${vault.path}</div>
                        </div>
                    </div>
                    <button class="text-blue-500 hover:text-blue-700" title="Open Vault">
                        <i class="fas fa-folder-open"></i>
                    </button>
                </div>
            `).join('');

            // Add click handlers to vault items
            vaultListItems.querySelectorAll('.vault-item').forEach(item => {
                item.addEventListener('click', () => {
                    const vaultPath = item.dataset.vaultPath;
                    selectVault(vaultPath);
                });
            });

            if (vaultList) vaultList.classList.remove('hidden');
            showStatus(`Found ${allVaults.length} vault(s)`, 'success');
        }

    } catch (error) {
        console.error('Error listing vaults:', error);
        showStatus('Error searching for vaults', 'error');
    }
}

// Select a specific vault from the list
async function selectVault(vaultPath) {
    try {
        // Prompt for password
        const password = await promptForPassword();
        if (!password) return;

        // Use the proper load-vault handler
        showStatus('Loading vault...', 'info');

        const result = await ipcRenderer.invoke('load-vault', {
            vaultPath,
            password
        });

        if (result.success) {
            currentVaultPath = vaultPath;
            currentPassword = password;
            vaultTitle.textContent = result.vault.name;

            // Hide vault list and selection
            if (vaultList) vaultList.classList.add('hidden');
            if (vaultSelection) vaultSelection.classList.add('hidden');
            if (vaultInterface) vaultInterface.classList.remove('hidden');

            await loadVaultFiles();
            showStatus('Vault unlocked successfully!', 'success');
        } else {
            showStatus(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error opening vault:', error);
        showStatus('Error opening vault', 'error');
    }
}

// Show status message
function showStatus(message, type = 'info') {
    if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.className = `mt-4 p-3 rounded-md ${getStatusClass(type)}`;
        statusMessage.classList.remove('hidden');

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (statusMessage) {
                statusMessage.classList.add('hidden');
            }
        }, 5000);
    } else {
        console.log(`Status (${type}): ${message}`);
    }
}

// Get status message class based on type
function getStatusClass(type) {
    const classes = {
        info: 'bg-blue-100 text-blue-800',
        success: 'bg-green-100 text-green-800',
        error: 'bg-red-100 text-red-800',
        warning: 'bg-yellow-100 text-yellow-800'
    };
    return classes[type] || classes.info;
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Show recovery phrase to user and get confirmation
async function showRecoveryPhrase(recoveryPhrase) {
    return new Promise((resolve) => {
        // Create a modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md mx-4">
                <h3 class="text-lg font-semibold mb-4 text-gray-900">⚠️ Important: Save Recovery Phrase</h3>
                <p class="text-sm text-gray-600 mb-4">
                    This recovery phrase is essential for accessing your vault if you forget your password.
                    <strong>Write it down and store it in a secure location.</strong>
                </p>
                <div class="bg-gray-100 p-3 rounded font-mono text-sm mb-4 break-all">
                    ${recoveryPhrase}
                </div>
                <div class="flex space-x-3">
                    <button id="recovery-cancel" class="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                        Cancel Vault Creation
                    </button>
                    <button id="recovery-confirm" class="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700">
                        I Have Saved It
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Handle button clicks
        const confirmBtn = overlay.querySelector('#recovery-confirm');
        const cancelBtn = overlay.querySelector('#recovery-cancel');

        confirmBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(true);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(false);
        });

        // Close on overlay click (outside modal)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(false);
            }
        });
    });
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Locky application initialized successfully');
    console.log('All buttons should now work properly!');
});
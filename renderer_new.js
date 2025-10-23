const { ipcRenderer } = require('electron');
const path = require('path');
const os = require('os');

console.log('=== Locky Renderer Script Starting ===');

// Hardcoded vault directory
const VAULTS_DIR = path.join(os.homedir(), 'Documents', 'LockyVaults');
console.log('Vaults will be stored in:', VAULTS_DIR);

// State
let currentVaultPath = null;
let currentPassword = null;
let vaultFiles = [];

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired!');
    
    // Get all DOM elements
    const elements = {
        vaultSelection: document.getElementById('vault-selection'),
        vaultCreation: document.getElementById('vault-creation'),
        vaultInterface: document.getElementById('vault-interface'),
        vaultList: document.getElementById('vault-list'),
        vaultListItems: document.getElementById('vault-list-items'),
        createVaultBtn: document.getElementById('create-vault-btn'),
        listVaultsBtn: document.getElementById('list-vaults-btn'),
        cancelVaultCreationBtn: document.getElementById('cancel-vault-creation'),
        createVaultConfirmBtn: document.getElementById('create-vault-confirm'),
        vaultNameInput: document.getElementById('vault-name'),
        vaultPasswordInput: document.getElementById('vault-password'),
        vaultConfirmPasswordInput: document.getElementById('vault-confirm-password'),
        addFilesBtn: document.getElementById('add-files-btn'),
        lockVaultBtn: document.getElementById('lock-vault-btn'),
        fileInput: document.getElementById('file-input'),
        saveFileInput: document.getElementById('save-file-input'),
        dropZone: document.getElementById('drop-zone'),
        fileList: document.getElementById('file-list'),
        vaultTitle: document.getElementById('vault-title'),
        statusMessage: document.getElementById('status-message')
    };

    console.log('Found DOM elements:', Object.fromEntries(
        Object.entries(elements).map(([key, value]) => [key, !!value])
    ));
    
    // Check which elements are null
    const nullElements = Object.entries(elements)
        .filter(([key, value]) => !value)
        .map(([key, value]) => key);
    
    if (nullElements.length > 0) {
        console.error('Missing DOM elements:', nullElements);
        alert('Error: Some UI elements are missing from the HTML. Check console for details.');
        return;
    }

    console.log('All DOM elements found successfully!');
    
    // Attach event listeners
    elements.createVaultBtn.addEventListener('click', () => {
        console.log('Create vault button clicked');
        elements.vaultSelection.classList.add('hidden');
        elements.vaultCreation.classList.remove('hidden');
    });

    elements.listVaultsBtn.addEventListener('click', async () => {
        console.log('List vaults button clicked');
        await listVaults(elements);
    });

    elements.cancelVaultCreationBtn.addEventListener('click', () => {
        console.log('Cancel vault creation clicked');
        resetToVaultSelection(elements);
    });

    elements.createVaultConfirmBtn.addEventListener('click', async () => {
        console.log('Create vault confirm clicked');
        await createVault(elements);
    });

    elements.lockVaultBtn.addEventListener('click', () => {
        console.log('Lock vault clicked');
        lockVault(elements);
    });

    elements.addFilesBtn.addEventListener('click', () => {
        console.log('Add files clicked');
        elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', (e) => {
        console.log('File input changed');
        handleFiles(e.target.files, elements);
    });

    elements.dropZone.addEventListener('click', () => {
        console.log('Drop zone clicked');
        elements.fileInput.click();
    });

    // Drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        elements.dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        elements.dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        elements.dropZone.addEventListener(eventName, unhighlight, false);
    });

    elements.dropZone.addEventListener('drop', (e) => {
        console.log('File dropped');
        handleFiles(e.dataTransfer.files, elements);
    });

    console.log('✅ All event listeners attached successfully!');
});

// Create a new vault
async function createVault(elements) {
    const name = elements.vaultNameInput.value.trim();
    const password = elements.vaultPasswordInput.value;
    const confirmPassword = elements.vaultConfirmPasswordInput.value;
    
    // Reset any previous error states
    const inputs = [elements.vaultNameInput, elements.vaultPasswordInput, elements.vaultConfirmPasswordInput];
    inputs.forEach(input => input.classList.remove('border-red-500'));
    
    // Validate inputs
    let hasError = false;
    
    if (!name) {
        elements.vaultNameInput.classList.add('border-red-500');
        showStatus('Please enter a vault name', 'error');
        hasError = true;
    }
    
    if (password.length < 8) {
        elements.vaultPasswordInput.classList.add('border-red-500');
        showStatus('Password must be at least 8 characters long', 'error');
        hasError = true;
    }
    
    if (password !== confirmPassword) {
        elements.vaultConfirmPasswordInput.classList.add('border-red-500');
        showStatus('Passwords do not match', 'error');
        hasError = true;
    }
    
    if (hasError) return;
    
    try {
        // Disable form while processing
        const createButton = elements.createVaultConfirmBtn;
        if (!createButton) {
            showStatus('❌ Error: Create button not found', 'error');
            return;
        }

        const originalButtonText = createButton.innerHTML;
        createButton.disabled = true;
        createButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Creating...';
        
        try {
            showStatus('🔐 Creating vault...', 'info');
            
            const createResult = await ipcRenderer.invoke('create-vault', {
                path: VAULTS_DIR,
                password,
                name
            });
            
            if (createResult.success) {
                currentVaultPath = createResult.vaultPath;
                currentPassword = password;
                elements.vaultTitle.textContent = name;
                elements.vaultCreation.classList.add('hidden');
                elements.vaultInterface.classList.remove('hidden');
                
                // Generate a recovery phrase
                const recoveryPhrase = `VAULT_RECOVERY:${createResult.vaultPath}:${name}:${Date.now()}`;
                console.log('IMPORTANT: Save this recovery phrase in a secure location!');
                console.log(recoveryPhrase);
                
                // Show recovery phrase
                const saveConfirmed = await showRecoveryPhrase(recoveryPhrase);
                
                if (saveConfirmed) {
                    showStatus('✅ Vault created successfully!', 'success');
                    await loadVaultFiles(elements);
                } else {
                    // If user didn't confirm saving the recovery phrase, delete the vault
                    try {
                        await ipcRenderer.invoke('fs-remove', { path: createResult.vaultPath });
                        showStatus('Vault creation cancelled', 'warning');
                        resetToVaultSelection(elements);
                    } catch (error) {
                        console.error('Error cleaning up vault:', error);
                        showStatus('❌ Error cleaning up vault', 'error');
                    }
                }
            } else {
                showStatus(`❌ Error: ${createResult.error || 'Failed to create vault'}`, 'error');
            }
        } catch (error) {
            console.error('Error in createVault:', error);
            showStatus(`❌ Error: ${error.message || 'Failed to create vault'}`, 'error');
        } finally {
            createButton.disabled = false;
            createButton.innerHTML = originalButtonText;
        }
    } catch (error) {
        console.error('Error creating vault:', error);
        showStatus('❌ Error creating vault', 'error');
    }
}

// List available vaults
async function listVaults(elements) {
    if (!elements.vaultListItems) {
        console.error('Vault list items container not found');
        showStatus('❌ Error: UI elements not found', 'error');
        return;
    }

    try {
        showStatus('🔍 Searching for vaults...', 'info');
        console.log('Searching in:', VAULTS_DIR);

        const result = await ipcRenderer.invoke('list-vaults', VAULTS_DIR);
        
        if (result.success) {
            const vaults = result.vaults;
            console.log('Found vaults:', vaults);

            if (vaults.length === 0) {
                elements.vaultListItems.innerHTML = '<p class="text-gray-500 text-center py-4">📁 No vaults found. Create your first vault!</p>';
                elements.vaultList.classList.remove('hidden');
                showStatus('📁 No vaults found. Create your first vault!', 'info');
                return;
            }

            // Display found vaults - make entire item clickable with delete button
            elements.vaultListItems.innerHTML = vaults.map(vault => `
                <div class="vault-item group bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer"
                     data-vault-path="${vault.path}">
                    <div class="flex items-center flex-1" style="cursor: pointer;">
                        <div class="text-green-500 text-2xl mr-3">
                            <i class="fas fa-lock"></i>
                        </div>
                        <div class="flex-1">
                            <div class="font-medium text-lg">${vault.name}</div>
                            <div class="text-sm text-gray-500">
                                ${vault.fileCount} files • Created ${new Date(vault.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button class="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200" 
                                data-action="delete" data-vault-path="${vault.path}" title="Delete Vault">
                            <i class="fas fa-trash text-sm"></i>
                        </button>
                        <div class="text-gray-400">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                </div>
            `).join('');

            // Add click handlers to vault items (entire item is clickable)
            elements.vaultListItems.querySelectorAll('.vault-item').forEach(item => {
                item.addEventListener('click', async (e) => {
                    // Only open if clicking on the item itself, not the delete button
                    if (e.target.closest('[data-action="delete"]')) return;
                    const vaultPath = item.dataset.vaultPath;
                    console.log('Opening vault at:', vaultPath);
                    await selectVault(vaultPath, elements);
                });
            });

            // Add delete button handlers
            elements.vaultListItems.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const vaultPath = e.currentTarget.dataset.vaultPath;
                    console.log('Delete vault at:', vaultPath);
                    await deleteVault(vaultPath, elements);
                });
            });

            elements.vaultList.classList.remove('hidden');
            showStatus(`✅ Found ${vaults.length} vault(s)`, 'success');
        } else {
            showStatus(`❌ Error: ${result.error}`, 'error');
        }

    } catch (error) {
        console.error('Error listing vaults:', error);
        showStatus('❌ Error searching for vaults', 'error');
    }
}

// Select a specific vault from the list
async function selectVault(vaultPath, elements) {
    try {
        console.log('Attempting to open vault:', vaultPath);
        
        // Prompt for password with better feedback
        const password = await promptForPassword('🔐 Enter vault password to unlock:');
        if (!password) {
            console.log('Password prompt cancelled');
            return;
        }

        console.log('Password entered, validating...');
        
        // Use the proper load-vault handler
        showStatus('🔓 Loading vault...', 'info');

        const result = await ipcRenderer.invoke('load-vault', {
            vaultPath,
            password
        });

        console.log('Load vault result:', result);

        if (result.success) {
            console.log('✅ Vault loaded successfully:', result.vault);
            currentVaultPath = vaultPath;
            currentPassword = password;
            elements.vaultTitle.textContent = result.vault.name;

            // Hide vault list and selection, show vault interface
            elements.vaultList.classList.add('hidden');
            elements.vaultSelection.classList.add('hidden');
            elements.vaultInterface.classList.remove('hidden');

            await loadVaultFiles(elements);
            showStatus('✅ Vault unlocked successfully!', 'success');
        } else {
            console.log('❌ Password validation failed:', result.error);
            showStatus(`❌ Incorrect password: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('❌ Error opening vault:', error);
        showStatus('❌ Error opening vault', 'error');
    }
}

// Delete a vault with password confirmation
async function deleteVault(vaultPath, elements) {
    if (!confirm('🗑️ Are you sure you want to delete this vault? This action cannot be undone.')) {
        return;
    }

    try {
        // Prompt for password
        const password = await promptForPassword('🔐 Enter vault password to confirm deletion:');
        if (!password) return;

        showStatus('🗑️ Deleting vault...', 'info');

        const result = await ipcRenderer.invoke('delete-vault', {
            vaultPath,
            password
        });

        if (result.success) {
            showStatus('✅ Vault deleted successfully!', 'success');
            // Refresh the vault list
            await listVaults(elements);
        } else {
            showStatus(`❌ ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting vault:', error);
        showStatus('❌ Error deleting vault', 'error');
    }
}

// Load files in the vault
async function loadVaultFiles(elements) {
    if (!currentVaultPath) return;

    if (!elements.fileList) {
        console.error('File list container not found');
        showStatus('❌ Error: UI elements not found', 'error');
        return;
    }

    try {
        const indexFile = `${currentVaultPath}/.vaultindex`;
        console.log('Loading files from:', indexFile);
        
        // Check if index file exists
        try {
            await ipcRenderer.invoke('fs-access', { path: indexFile, mode: 'read' });
        } catch {
            // Index file doesn't exist yet (no files in vault)
            elements.fileList.innerHTML = '<p class="text-gray-500 text-center py-8">📁 No files in vault yet. Drag and drop files here to add them.</p>';
            return;
        }
        
        // Read index file
        const files = await ipcRenderer.invoke('fs-read-json', indexFile);
        vaultFiles = files;
        console.log('Loaded files:', files);
        
        if (files.length === 0) {
            elements.fileList.innerHTML = '<p class="text-gray-500 text-center py-8">�� No files in vault yet. Drag and drop files here to add them.</p>';
            return;
        }
        
        // Render file list
        elements.fileList.innerHTML = files.map(file => `
            <div class="vault-item bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                <div class="flex items-center">
                    <div class="text-blue-500 text-xl mr-3">
                        <i class="fas fa-file"></i>
                    </div>
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
        elements.fileList.querySelectorAll('[data-action="download"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileId = e.currentTarget.dataset.fileId;
                elements.saveFileInput.dataset.fileId = fileId;
                elements.saveFileInput.click();
            });
        });
        
        elements.fileList.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const fileId = e.currentTarget.dataset.fileId;
                if (confirm('��️ Are you sure you want to delete this file from the vault?')) {
                    try {
                        const fileInfo = vaultFiles.find(f => f.id === fileId);
                        if (fileInfo) {
                            await ipcRenderer.invoke('fs-unlink', fileInfo.encryptedPath);
                            await loadVaultFiles(elements);
                            showStatus('✅ File deleted from vault', 'success');
                        }
                    } catch (error) {
                        console.error('Error deleting file:', error);
                        showStatus('❌ Error deleting file', 'error');
                    }
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading vault files:', error);
        showStatus('❌ Error loading vault files', 'error');
    }
}

// Lock the current vault
function lockVault(elements) {
    currentVaultPath = null;
    currentPassword = null;
    vaultFiles = [];

    // Reset form
    if (elements.vaultNameInput) elements.vaultNameInput.value = '';
    if (elements.vaultPasswordInput) elements.vaultPasswordInput.value = '';
    if (elements.vaultConfirmPasswordInput) elements.vaultConfirmPasswordInput.value = '';

    // Reset UI
    if (elements.vaultInterface) elements.vaultInterface.classList.add('hidden');
    if (elements.vaultList) elements.vaultList.classList.add('hidden');
    if (elements.vaultSelection) elements.vaultSelection.classList.remove('hidden');

    showStatus('🔒 Vault locked', 'info');
}

// Reset to vault selection screen
function resetToVaultSelection(elements) {
    if (elements.vaultCreation) elements.vaultCreation.classList.add('hidden');
    if (elements.vaultList) elements.vaultList.classList.add('hidden');
    if (elements.vaultSelection) elements.vaultSelection.classList.remove('hidden');
    
    // Reset form
    if (elements.vaultNameInput) elements.vaultNameInput.value = '';
    if (elements.vaultPasswordInput) elements.vaultPasswordInput.value = '';
    if (elements.vaultConfirmPasswordInput) elements.vaultConfirmPasswordInput.value = '';
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

// Prompt for password with better UX
async function promptForPassword(message = '🔐 Enter vault password:') {
    return new Promise((resolve) => {
        // Create password modal
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md mx-4">
                <h3 class="text-lg font-semibold mb-4 text-gray-900">${message}</h3>
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
                        Unlock
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const passwordInput = overlay.querySelector('#vault-password-input');
        const confirmBtn = overlay.querySelector('#password-confirm');
        const cancelBtn = overlay.querySelector('#password-cancel');

        // Focus password input
        passwordInput.focus();

        // Handle Enter key in password field
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            }
        });

        confirmBtn.addEventListener('click', () => {
            const password = passwordInput.value.trim();
            document.body.removeChild(overlay);
            resolve(password || null);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(null);
        });

        // Close on overlay click (outside modal)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(null);
            }
        });
    });
}

// Process selected files
async function handleFiles(files, elements) {
    if (!currentVaultPath || !currentPassword) return;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        showStatus(`🔐 Encrypting ${file.name}...`, 'info');
        
        try {
            const result = await ipcRenderer.invoke('encrypt-file', {
                vaultPath: currentVaultPath,
                filePath: file.path,
                password: currentPassword
            });
            
            if (result.success) {
                showStatus(`✅ Successfully added ${file.name} to vault`, 'success');
                await loadVaultFiles(elements);
            } else {
                showStatus(`❌ Error adding ${file.name}: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error processing file:', error);
            showStatus(`❌ Error processing ${file.name}`, 'error');
        }
    }
}

// Handle saving decrypted file
function handleSaveFileSelect(e, elements) {
    const file = e.target.files[0];
    if (!file) return;

    const fileId = elements.saveFileInput.dataset.fileId;
    const outputPath = file.path;

    // Show loading status
    showStatus('🔓 Decrypting file...', 'info');

    ipcRenderer.invoke('decrypt-file', {
        vaultPath: currentVaultPath,
        fileId,
        password: currentPassword,
        outputPath
    }).then(result => {
        if (result.success) {
            showStatus(`✅ File saved successfully to: ${file.name}`, 'success');
        } else {
            showStatus(`❌ Error: ${result.error}`, 'error');
        }
    }).catch(error => {
        console.error('Error decrypting file:', error);
        showStatus('❌ Error decrypting file', 'error');
    });
}

// Prevent default drag behaviors
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop zone when dragging files over it
function highlight(e) {
    e.currentTarget.classList.add('drag-over');
}

// Remove highlight when leaving drop zone
function unhighlight(e) {
    e.currentTarget.classList.remove('drag-over');
}

// Show status message
function showStatus(message, type = 'info') {
    console.log(`Status (${type}): ${message}`);
    // You could implement a proper status display here
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get file size (placeholder)
function getFileSize(filePath) {
    return 1024; // 1KB placeholder
}

console.log('Locky renderer script loaded successfully!');

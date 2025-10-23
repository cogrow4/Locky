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
let currentTheme = 'light';

// Theme management
function applyTheme() {
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
    currentTheme = prefersDarkScheme.matches ? 'dark' : 'light';

    document.documentElement.classList.toggle('dark', currentTheme === 'dark');

    // Apply theme-specific classes to body and main elements
    const body = document.body;
    const mainElements = [
        document.getElementById('vault-selection'),
        document.getElementById('vault-creation'),
        document.getElementById('vault-interface'),
        document.getElementById('vault-list')
    ].filter(el => el);

    if (currentTheme === 'dark') {
        // Dark mode: deep background, light text
        body.classList.remove('bg-white');
        body.classList.add('bg-black', 'text-gray-100');
        body.style.background = 'radial-gradient(#404040 1px, transparent 1px)';
        body.style.backgroundSize = '20px 20px';

        // Style main container instead of individual elements
        const container = document.getElementById('container') || document.body;
        container.style.backgroundColor = 'rgb(17 24 39 / 0.95)'; // gray-900 with opacity
        container.style.backdropFilter = 'blur(10px)';

        mainElements.forEach(el => {
            if (el) {
                el.classList.remove('bg-white', 'border-gray-200');
                el.classList.add('bg-gray-900', 'bg-opacity-95', 'text-gray-100', 'border-gray-700');
                el.style.backgroundColor = 'rgb(17 24 39 / 0.95)';
                el.style.backdropFilter = 'blur(10px)';
                el.style.borderColor = '#374151'; // gray-700
            }
        });

        // Fix logo text visibility - make it much lighter for dark mode
        const titleElement = document.querySelector('h1');
        if (titleElement) {
            titleElement.classList.remove('text-gray-900');
            titleElement.classList.add('text-gray-50');
            titleElement.style.color = '#f9fafb'; // text-gray-50
        }

        // Ensure all text elements are visible in dark mode
        const allTextElements = document.querySelectorAll('[class*="text-gray-"], [class*="text-black"]');
        allTextElements.forEach(el => {
            if (el.classList.contains('text-gray-900') || el.classList.contains('text-black')) {
                el.classList.remove('text-gray-900', 'text-black');
                el.classList.add('text-gray-100');
                el.style.color = '#f3f4f6'; // text-gray-100
            }
        });

        // Fix any remaining white backgrounds
        const whiteElements = document.querySelectorAll('[class*="bg-white"]');
        whiteElements.forEach(el => {
            el.classList.remove('bg-white');
            el.classList.add('bg-gray-900');
            el.style.backgroundColor = 'rgb(17 24 39 / 0.95)';
        });

        // Fix input elements in dark mode
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(el => {
            // Force dark input backgrounds and light text
            el.style.backgroundColor = '#374151'; // gray-700 (darker than main bg)
            el.style.borderColor = '#4b5563'; // gray-600
            el.style.color = '#f9fafb'; // text-gray-50 for visibility
            // Force placeholder text color to white
            el.style.setProperty('::-webkit-input-placeholder', 'color: #f3f4f6', 'important');
            el.style.setProperty('::-moz-placeholder', 'color: #f3f4f6', 'important');
            // Override any existing text color classes
            el.classList.remove('text-gray-900', 'text-black');
            if (!el.classList.contains('text-gray-100')) {
                el.classList.add('text-gray-50');
            }
            // Ensure options in select elements are visible
            if (el.tagName === 'SELECT') {
                const options = el.querySelectorAll('option');
                options.forEach(option => {
                    option.style.color = '#f9fafb';
                });
            }
        });

        // Fix buttons in dark mode to ensure visibility
        const buttons = document.querySelectorAll('button');
        buttons.forEach(el => {
            // Handle blue buttons (they should stay white text)
            if (el.classList.contains('bg-blue-500') || el.classList.contains('hover:bg-blue-700')) {
                el.style.color = '#ffffff'; // Ensure white text on blue buttons
                return; // Skip further styling for blue buttons
            }

            // Handle red buttons (they should stay white text)
            if (el.classList.contains('bg-red-500') || el.classList.contains('hover:bg-red-700')) {
                el.style.color = '#ffffff'; // Ensure white text on red buttons
                return; // Skip further styling for red buttons
            }

            // Handle gray buttons (like cancel or secondary buttons)
            if (el.classList.contains('bg-gray-500') || el.classList.contains('hover:bg-gray-600')) {
                el.style.color = '#ffffff'; // White text on gray buttons
                return;
            }

            // Handle green buttons
            if (el.classList.contains('bg-green-500') || el.classList.contains('hover:bg-green-700')) {
                el.style.color = '#ffffff'; // White text on green buttons
                return;
            }

            // Handle lock vault button specifically (gray button that should be visible in dark mode)
            if (el.id === 'lock-vault-btn') {
                el.style.color = '#f3f4f6'; // gray-100 for dark mode text
                el.style.backgroundColor = '#4b5563'; // gray-600 for dark mode background
                el.style.borderColor = '#6b7280'; // gray-500 for border
                return;
            }

            // For any other buttons, use dark mode appropriate text color
            if (!el.classList.contains('text-white') && !el.classList.contains('bg-blue-500')) {
                el.style.color = '#f3f4f6'; // gray-100 for dark mode text on buttons
            }
        });
    } else {
        // Light mode: clean white background
        body.classList.remove('bg-black', 'text-gray-100');
        body.classList.add('bg-white');
        body.style.background = 'radial-gradient(#f5f5f5 1px, transparent 1px)';
        body.style.backgroundSize = '20px 20px';

        // Reset main container
        const container = document.getElementById('container') || document.body;
        container.style.backgroundColor = '';
        container.style.backdropFilter = '';

        mainElements.forEach(el => {
            if (el) {
                el.classList.remove('bg-gray-900', 'bg-opacity-95', 'text-gray-100', 'border-gray-700');
                el.classList.add('bg-white', 'text-gray-900', 'border-gray-200');
                el.style.backgroundColor = '';
                el.style.backdropFilter = '';
                el.style.borderColor = '';
            }
        });

        // Restore logo text for light mode
        const titleElement = document.querySelector('h1');
        if (titleElement) {
            titleElement.classList.remove('text-gray-50');
            titleElement.classList.add('text-gray-900');
            titleElement.style.color = '';
        }

        // Restore all text elements for light mode
        const allTextElements = document.querySelectorAll('[class*="text-gray-"]');
        allTextElements.forEach(el => {
            if (el.classList.contains('text-gray-100')) {
                el.classList.remove('text-gray-100');
                el.classList.add('text-gray-900');
                el.style.color = '';
            }
        });

        // Remove any lingering dark elements
        const darkElements = document.querySelectorAll('[class*="bg-gray-900"]');
        darkElements.forEach(el => {
            el.classList.remove('bg-gray-900');
            el.classList.add('bg-white');
            el.style.backgroundColor = '';
        });

        // Restore input elements for light mode
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(el => {
            // Restore light input backgrounds and dark text
            el.style.backgroundColor = '#ffffff'; // White background
            el.style.borderColor = '#d1d5db'; // gray-300
            el.style.color = '#111827'; // gray-900 for text
            // Restore placeholder text color to dark
            el.style.setProperty('::-webkit-input-placeholder', 'color: #6b7280', 'important'); // gray-500
            el.style.setProperty('::-moz-placeholder', 'color: #6b7280', 'important');
            // Override any existing text color classes
            el.classList.remove('text-gray-50', 'text-gray-100');
            if (!el.classList.contains('text-gray-900')) {
                el.classList.add('text-gray-900');
            }
            // Ensure options in select elements are dark text
            if (el.tagName === 'SELECT') {
                const options = el.querySelectorAll('option');
                options.forEach(option => {
                    option.style.color = '#111827';
                });
            }
        });

        // Restore buttons for light mode
        const buttons = document.querySelectorAll('button');
        buttons.forEach(el => {
            // Reset lock vault button to light mode styling
            if (el.id === 'lock-vault-btn') {
                el.style.color = '';
                el.style.backgroundColor = '';
                el.style.borderColor = '';
                return;
            }

            if (!el.classList.contains('text-white')) {
                el.style.color = '#374151'; // gray-700 for button text
            }
        });
    }

    console.log('Applied theme:', currentTheme);
}

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

    elements.saveFileInput.addEventListener('change', (e) => {
        console.log('Save file input changed');
        handleSaveFileSelect(e, elements);
    });

    // Menu actions
    ipcRenderer.on('menu-action', (event, data) => {
        if (data.action === 'new-vault') {
            elements.vaultSelection.classList.add('hidden');
            elements.vaultCreation.classList.remove('hidden');
        } else if (data.action === 'list-vaults') {
            listVaults(elements);
        } else if (data.action === 'lock-vault') {
            lockVault(elements);
        } else if (data.action === 'delete-vault') {
            deleteVault(elements);
        }
    });

    // Force theme application twice to ensure it sticks
    applyTheme();
    setTimeout(() => applyTheme(), 100); // Give CSS time to load first

    // Listen for system theme changes
    const themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    themeMediaQuery.addEventListener('change', () => {
        applyTheme();
        setTimeout(() => applyTheme(), 100); // Ensure it sticks on change
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
            showStatus('Error: Create button not found', 'error');
            return;
        }

        const originalButtonText = createButton.innerHTML;
        createButton.disabled = true;
        createButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Creating...';
        
        try {
            showStatus('Creating vault...', 'info');
            
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
                const isDark = currentTheme === 'dark';
                const textClass = isDark ? 'text-gray-400' : 'text-gray-500';
                elements.vaultListItems.innerHTML = `<p class="${textClass} text-center py-4">No vaults found. Create your first vault!</p>`;
                elements.vaultList.classList.remove('hidden');
                showStatus('📁 No vaults found. Create your first vault!', 'info');
                return;
            }

            // Display found vaults - make entire item clickable with theme-aware styling
            const isDark = currentTheme === 'dark';
            const bgClass = isDark ? 'bg-gray-800 border-gray-600 hover:bg-gray-700' : 'bg-white border-gray-200 hover:bg-gray-50';
            const textClass = isDark ? 'text-gray-100' : 'text-gray-900';
            const secondaryTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
            const iconTextClass = isDark ? 'text-gray-500' : 'text-gray-400';

            elements.vaultListItems.innerHTML = vaults.map(vault => `
                <div class="vault-item ${bgClass} border rounded-lg p-4 flex justify-between items-center cursor-pointer transition-colors duration-200"
                     data-vault-path="${vault.path}">
                    <div class="flex items-center">
                        <div class="text-green-500 text-2xl mr-3">
                            <i class="fas fa-lock"></i>
                        </div>
                        <div>
                            <div class="font-medium text-lg ${textClass}">${vault.name}</div>
                            <div class="text-sm ${secondaryTextClass}">
                                ${vault.fileCount} files • Created ${new Date(vault.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                    <div class="${iconTextClass}">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `).join('');

            // Add click handlers to vault items (entire item is clickable)
            elements.vaultListItems.querySelectorAll('.vault-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const vaultPath = item.dataset.vaultPath;
                    console.log('Opening vault at:', vaultPath);
                    await selectVault(vaultPath, elements);
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

            // Add delete vault button
            if (!document.getElementById('delete-vault-btn')) {
                const deleteBtn = document.createElement('button');
                deleteBtn.id = 'delete-vault-btn';
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete Vault';
                deleteBtn.className = 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700';
                elements.lockVaultBtn.after(deleteBtn);
                deleteBtn.addEventListener('click', () => deleteVault(elements));
            }

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
            const isDark = currentTheme === 'dark';
            const textClass = isDark ? 'text-gray-400' : 'text-gray-500';
            elements.fileList.innerHTML = `<p class="${textClass} text-center py-8">📁 No files in vault yet. Drag and drop files here to add them.</p>`;
            return;
        }
        
        // Render file list with theme-aware styling
        const isDark = currentTheme === 'dark';
        const bgClass = isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200';
        const textClass = isDark ? 'text-gray-100' : 'text-gray-900';
        const secondaryTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
        const borderClass = isDark ? 'border-gray-600' : 'border-gray-200';

        elements.fileList.innerHTML = files.map(file => `
            <div class="vault-item ${bgClass} border ${borderClass} rounded-lg p-4 flex justify-between items-center">
                <div class="flex items-center">
                    <div class="text-blue-500 text-xl mr-3">
                        <i class="fas fa-file"></i>
                    </div>
                    <div>
                        <div class="font-medium cursor-pointer hover:text-blue-600 ${textClass}" onclick="previewFile('${file.id}')">${file.name}</div>
                        <div class="text-xs ${secondaryTextClass}">${formatFileSize(getFileSize(file.originalPath))} • ${new Date(file.addedAt).toLocaleDateString()}</div>
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
        
        elements.fileList.querySelectorAll('[data-action="download"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const fileId = e.currentTarget.dataset.fileId;
                const file = vaultFiles.find(f => f.id === fileId);
                if (!file) return;

                showStatus(`🏗️ Preparing download for ${file.name}...`, 'info');

                const result = await ipcRenderer.invoke('save-file', {
                    vaultPath: currentVaultPath,
                    fileId,
                    password: currentPassword,
                    fileName: file.name
                });

                if (result.success) {
                    showStatus(`✅ Downloaded ${file.name} successfully!`, 'success');
                } else {
                    showStatus(`❌ Download failed: ${result.error}`, 'error');
                }
            });
        });

        elements.fileList.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const fileId = e.currentTarget.dataset.fileId;
                if (confirm('🗑️ Are you sure you want to delete this file from the vault?')) {
                    try {
                        const fileInfo = vaultFiles.find(f => f.id === fileId);
                        if (fileInfo) {
                            await ipcRenderer.invoke('fs-unlink', fileInfo.encryptedPath);
                            // Update the index
                            vaultFiles = vaultFiles.filter(f => f.id !== fileId);
                            await ipcRenderer.invoke('fs-write-json', `${currentVaultPath}/.vaultindex`, vaultFiles);
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

// Delete the current vault
async function deleteVault(elements) {
    const password = await promptForPassword('Enter vault password to confirm deletion:');
    if (!password) return;

    if (confirm('Are you sure you want to delete this entire vault? This cannot be undone.')) {
        const result = await ipcRenderer.invoke('delete-vault', { vaultPath: currentVaultPath, password });
        if (result.success) {
            lockVault(elements);
            showStatus('Vault deleted.', 'success');
        } else {
            showStatus(`Error: ${result.error}`, 'error');
        }
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
        const isDark = currentTheme === 'dark';
        const bgClass = isDark ? 'bg-gray-800' : 'bg-white';
        const textClass = isDark ? 'text-gray-100' : 'text-gray-900';
        const secondaryTextClass = isDark ? 'text-gray-400' : 'text-gray-600';
        const recoveryBgClass = isDark ? 'bg-gray-700' : 'bg-gray-100';
        const recoveryTextClass = isDark ? 'text-gray-100' : 'text-gray-900';

        overlay.innerHTML = `
            <div class="${bgClass} rounded-lg p-6 max-w-md mx-4">
                <h3 class="text-lg font-semibold mb-4 ${textClass}">⚠️ Important: Save Recovery Phrase</h3>
                <p class="text-sm ${secondaryTextClass} mb-4">
                    This recovery phrase is essential for accessing your vault if you forget your password.
                    <strong>Write it down and store it in a secure location.</strong>
                </p>
                <div class="${recoveryBgClass} p-3 rounded font-mono text-sm mb-4 break-all ${recoveryTextClass}">
                    ${recoveryPhrase}
                </div>
                <div class="flex flex-wrap gap-2 mb-4">
                    <button id="copy-recovery" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
                        📋 Copy to Clipboard
                    </button>
                    <button id="save-recovery" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">
                        💾 Save as File
                    </button>
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
        const copyBtn = overlay.querySelector('#copy-recovery');
        const saveBtn = overlay.querySelector('#save-recovery');

        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(recoveryPhrase);
                showStatus('📋 Recovery phrase copied to clipboard!', 'success');
            } catch (err) {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = recoveryPhrase;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showStatus('📋 Recovery phrase copied to clipboard!', 'success');
            }
        });

        saveBtn.addEventListener('click', () => {
            const blob = new Blob([recoveryPhrase], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'vault_recovery_phrase.txt';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showStatus('💾 Recovery phrase saved as file!', 'success');
        });

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

// Show recovery prompt for password reset
async function showRecoveryPrompt() {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        const isDark = currentTheme === 'dark';
        const bgClass = isDark ? 'bg-gray-800' : 'bg-white';
        const textClass = isDark ? 'text-gray-100' : 'text-gray-900';
        const secondaryTextClass = isDark ? 'text-gray-400' : 'text-gray-600';
        const labelTextClass = isDark ? 'text-gray-300' : 'text-gray-700';
        const borderClass = isDark ? 'border-gray-600' : 'border-gray-300';
        const inputBgClass = isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900';

        overlay.innerHTML = `
            <div class="${bgClass} rounded-lg p-6 max-w-lg mx-4">
                <h3 class="text-lg font-semibold mb-4 ${textClass}">🔑 Recover Vault Password</h3>
                <p class="text-sm ${secondaryTextClass} mb-4">Enter your recovery phrase and set a new password.</p>
                <div class="mb-4">
                    <label class="block text-sm font-medium ${labelTextClass} mb-2">Recovery Phrase</label>
                    <div class="flex gap-2 mb-2">
                        <button id="paste-clipboard" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
                            📋 Paste from Clipboard
                        </button>
                        <button id="load-recovery-file" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm">
                            📂 Load from File
                        </button>
                    </div>
                    <textarea id="recovery-phrase-input" placeholder="Enter recovery phrase (paste or load from file)"
                               class="w-full px-3 py-2 ${borderClass} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${inputBgClass}"
                               rows="3"></textarea>
                </div>
                <input type="file" id="recovery-file-input" accept=".txt" style="display: none;">
                <div class="mb-4">
                    <label class="block text-sm font-medium ${labelTextClass} mb-2">New Password</label>
                    <input type="password" id="new-password-input" placeholder="Enter new password"
                           class="w-full px-3 py-2 ${borderClass} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBgClass}">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium ${labelTextClass} mb-2">Confirm New Password</label>
                    <input type="password" id="confirm-new-password-input" placeholder="Confirm new password"
                           class="w-full px-3 py-2 ${borderClass} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBgClass}">
                </div>
                <div class="flex space-x-3">
                    <button id="recovery-cancel" class="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Cancel</button>
                    <button id="recovery-reset" class="flex-1 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700">Reset Password</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Ensure copy/paste works in all inputs
        const textarea = overlay.querySelector('#recovery-phrase-input');
        const passwordInputs = overlay.querySelectorAll('input[type="password"]');

        // Handle paste explicitly for textarea
        textarea.addEventListener('paste', function(e) {
            // Let the default paste behavior happen
            return;
        });

        [textarea, ...passwordInputs].forEach(input => {
            input.addEventListener('drop', (e) => {
                // Allow drop for paste-like functionality
            });
        });

        // Handle clipboard paste and file loading
        const pasteBtn = overlay.querySelector('#paste-clipboard');
        const loadBtn = overlay.querySelector('#load-recovery-file');
        const fileInput = overlay.querySelector('#recovery-file-input');

        pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                textarea.value = text.trim();
                showStatus('📋 Recovery phrase pasted from clipboard!', 'success');
            } catch (err) {
                console.error('Failed to read clipboard:', err);
                showStatus('❌ Failed to access clipboard', 'error');
                // Fallback: try document.execCommand
                try {
                    textarea.focus();
                    document.execCommand('paste');
                } catch (fallbackErr) {
                    console.error('Fallback paste also failed:', fallbackErr);
                }
            }
        });

        loadBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                textarea.value = event.target.result.trim();
                showStatus('📂 Recovery phrase loaded from file!', 'success');
            };
            reader.readAsText(file);
        });

        const cancelBtn = overlay.querySelector('#recovery-cancel');
        const resetBtn = overlay.querySelector('#recovery-reset');

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(null);
        });

        resetBtn.addEventListener('click', () => {
            const phrase = overlay.querySelector('#recovery-phrase-input').value.trim();
            const newPass = overlay.querySelector('#new-password-input').value;
            const confirmPass = overlay.querySelector('#confirm-new-password-input').value;

            if (!phrase || !newPass || !confirmPass) {
                alert('All fields are required');
                return;
            }

            if (newPass !== confirmPass) {
                alert('Passwords do not match');
                return;
            }

            if (newPass.length < 8) {
                alert('Password must be at least 8 characters long');
                return;
            }

            // Return the result
            document.body.removeChild(overlay);
            resolve({ recoveryPhrase: phrase, newPassword: newPass });
        });
    });
}

// Prompt for password with better UX
async function promptForPassword(message = '🔐 Enter vault password:') {
    return new Promise((resolve) => {
        // Create password modal
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        const isDark = currentTheme === 'dark';
        const bgClass = isDark ? 'bg-gray-800' : 'bg-white';
        const textClass = isDark ? 'text-gray-100' : 'text-gray-900';
        const borderClass = isDark ? 'border-gray-600' : 'border-gray-300';
        const inputBgClass = isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900';
        const placeholderColor = isDark ? '#f3f4f6' : '#6b7280';

        overlay.innerHTML = `
            <div class="${bgClass} rounded-lg p-6 max-w-md mx-4">
                <h3 class="text-lg font-semibold mb-4 ${textClass}">${message}</h3>
                <div class="mb-4">
                    <input type="password" id="vault-password-input" placeholder="Enter your vault password"
                           class="w-full px-3 py-2 ${borderClass} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputBgClass}"
                           autocomplete="current-password" style="--tw-ring-color: rgb(59 130 246); --tw-ring-opacity: 0.5;">
                </div>
                <div class="flex space-x-3">
                    <button id="password-cancel" class="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                        Cancel
                    </button>
                    <button id="password-confirm" class="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Unlock
                    </button>
                </div>
                <div class="text-center mt-2">
                    <button id="forgot-password" class="text-blue-600 hover:text-blue-700 text-sm underline">Forgot Password?</button>
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

        const forgotBtn = overlay.querySelector('#forgot-password');

        forgotBtn.addEventListener('click', async () => {
            document.body.removeChild(overlay);
            const result = await showRecoveryPrompt();
            if (result) {
                try {
                    const recoverResult = await ipcRenderer.invoke('recover-vault', result);
                    if (recoverResult.success) {
                        resolve(result.newPassword);
                    } else {
                        alert('Recovery failed: ' + recoverResult.error);
                        resolve(null);
                    }
                } catch (error) {
                    alert('Recovery error: ' + error.message);
                    resolve(null);
                }
            } else {
                resolve(null);
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
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type}`;  // Add classes for styling
        statusMessage.style.display = 'block';
        // Auto-hide after 5 seconds for success/info
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 5000);
        }
    }
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

// Create modal overlay
function createModal() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
    return overlay;
}

// Preview file
async function previewFile(fileId) {
    const file = vaultFiles.find(f => f.id === fileId);
    if (!file) return;

    const ext = path.extname(file.name).toLowerCase();
    showStatus(`👁 Loading preview for ${file.name}...`, 'info');

    try {
        const content = await ipcRenderer.invoke('get-file-content', {
            vaultPath: currentVaultPath,
            fileId,
            password: currentPassword
        });

        if (!content) {
            showStatus('❌ Failed to load preview', 'error');
            return;
        }

        const overlay = createModal();

        if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg'].includes(ext)) {
            // Image preview
            let mime;
            if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
            else mime = `image/${ext.slice(1)}`;

            overlay.innerHTML = `
                <div class="bg-white p-4 rounded-lg max-w-4xl max-h-screen flex flex-col">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-semibold">${file.name}</h3>
                        <button class="text-red-500 hover:text-red-700 text-xl" id="close-preview">×</button>
                    </div>
                    <div class="flex-1 overflow-auto">
                        <img src="data:${mime};base64,${content}" alt="${file.name}" class="max-w-full max-h-full object-contain">
                    </div>
                </div>
            `;
        } else if (['.txt', '.md', '.json', '.js', '.html', '.css', '.py', '.xml'].includes(ext)) {
            // Text preview
            const text = Buffer.from(content, 'base64').toString('utf8');
            overlay.innerHTML = `
                <div class="bg-white p-4 rounded-lg max-w-4xl max-h-screen flex flex-col">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-semibold">${file.name}</h3>
                        <button class="text-red-500 hover:text-red-700 text-xl" id="close-preview">×</button>
                    </div>
                    <div class="flex-1 overflow-auto bg-gray-100 p-4 rounded">
                        <pre class="whitespace-pre-wrap text-sm font-mono">${text}</pre>
                    </div>
                </div>
            `;
        } else if (ext === '.pdf') {
            // PDF preview
            overlay.innerHTML = `
                <div class="bg-white p-4 rounded-lg max-w-4xl max-h-screen flex flex-col">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-semibold">${file.name}</h3>
                        <button class="text-red-500 hover:text-red-700 text-xl" id="close-preview">×</button>
                    </div>
                    <div class="flex-1 overflow-auto">
                        <iframe src="data:application/pdf;base64,${content}" class="w-full h-full min-h-96"></iframe>
                    </div>
                </div>
            `;
        } else {
            // deberían Not supported
            overlay.innerHTML = `
                <div class="bg-white p-4 rounded-lg max-w-lg">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-semibold">${file.name}</h3>
                        <button class="text-red-500 hover:text-red-700 text-xl" id="close-preview">×</button>
                    </div>
                    <p class="text-gray-600">Preview not supported for this file type.</p>
                    <div class="mt-4 flex justify-end">
                        <button class="bg-blue-500 text-white px-4 py-2 rounded" id="download-instead">Download Instead</button>
                    </div>

                </div>
            `;

            overlay.querySelector('#download-instead').addEventListener('click', () => {
                document.body.removeChild(overlay);
                // Trigger download
                const downloadBtn = document.querySelector(`[data-action="download"][data-file-id="${fileId}"]`);
                if (downloadBtn) downloadBtn.click();
            });
        }

        overlay.querySelector('#close-preview').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        document.body.appendChild(overlay);
        showStatus('', 'info'); // clear status

    } catch (error) {
        console.error('Preview error:', error);
        showStatus('❌ Failed to load preview', 'error');
    }
}

console.log('Locky renderer script loaded successfully!');

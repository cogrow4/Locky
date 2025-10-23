# 🔒 Locky - Secure File Vault

![Locky Logo](https://img.shields.io/badge/Locky-Secure%20Vault-blue?style=for-the-badge&logo=electron)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=flat-square)
![License](https://img.shields.io/badge/license-Unlicense-orange?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-17.0+-blue?style=flat-square)

A modern, secure file encryption application built with Electron that allows you to create encrypted vaults for your sensitive files. Locky provides military-grade AES encryption with an intuitive interface and dark/light theme support.

## ✨ Features

### 🔐 **Advanced Security**
- **AES Encryption**: Industry-standard AES-256-GCM encryption for maximum security
- **Password Protection**: Strong password-based encryption with PBKDF2 key derivation
- **Recovery System**: Built-in recovery phrases for emergency access
- **Secure Deletion**: Safe file handling with automatic cleanup

### 🎨 **Modern User Interface**
- **Responsive Design**: Clean, intuitive interface that works on all platforms
- **Theme Support**: Seamless light and dark mode switching
- **Real-time Feedback**: Visual indicators for encryption/decryption progress
- **Drag & Drop**: Easy file management with drag-and-drop functionality

### 🚀 **Professional Features**
- **Vault Management**: Create and manage multiple encrypted vaults
- **File Operations**: Encrypt/decrypt individual files or entire folders
- **Backup Integration**: Export encrypted vaults for secure storage
- **Cross-Platform**: Native desktop app for Windows, macOS, and Linux

### 🛡️ **Enterprise-Grade Capabilities**
- **Tamper Detection**: Integrity checks to detect file modifications
- **Memory Security**: Secure memory handling to prevent data leaks
- **Audit Trail**: Detailed logs of all encryption operations
- **Zero-Knowledge**: Your encryption keys never leave your device

## 📦 Installation

### Prerequisites
- Node.js 16.x or higher
- npm or yarn package manager

### Quick Start
```bash
# Clone the repository
git clone https://github.com/cogrow4/Locky.git
cd Locky

# Install dependencies
npm install

# Start the application
npm start
```

### Building from Source
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Create distributable packages
npm run dist
```

## 🚀 Usage

### Getting Started
1. **Launch Locky**: Open the application after installation
2. **Create Vault**: Click "New Vault" and set a strong password
3. **Add Files**: Drag and drop files into the vault area
4. **Encrypt**: Click "Lock Vault" to secure your files
5. **Access**: Enter your password to decrypt and access files

### Advanced Usage
- **Theme Switching**: Use the theme toggle in settings to switch between light and dark modes
- **Recovery**: Use recovery phrases in case you forget your password
- **Backup**: Export encrypted vaults to external storage
- **Multi-Vault**: Create separate vaults for different purposes

## 🖼️ Screenshots

### Main Interface
*Modern, clean interface with file management capabilities*

### Dark Mode
*Seamless dark theme for comfortable extended use*

### Encryption Progress
*Real-time feedback during file operations*

## 🏗️ Architecture

Locky is built with:
- **Electron**: Cross-platform desktop framework
- **Node.js**: Backend runtime with crypto modules
- **HTML/CSS/JavaScript**: Frontend interface
- **Tailwind CSS**: Utility-first styling framework
- **AES-256-GCM**: Military-grade encryption algorithm

## 🔧 Development

### Project Structure
```
Locky/
├── main.js              # Electron main process
├── renderer.js          # Frontend logic
├── index.html           # Main UI template
├── package.json         # Project configuration
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

### Contributing
We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Testing
```bash
# Run tests
npm test

# Run linting
npm run lint

# Check security
npm run security-audit
```

## 📄 License

This project is released under the **Unlicense** - a public domain dedication. See the [LICENSE](LICENSE) file for details.

## 👤 Author

**cogrow4**
- GitHub: [@cogrow4](https://github.com/cogrow4)
- Project: [Locky](https://github.com/cogrow4/Locky)

## 🙏 Acknowledgments

- Electron team for the amazing cross-platform framework
- OpenSSL for the cryptographic foundations
- The open-source community for inspiration and tools

## 📞 Support

If you encounter any issues or have questions:
- Open an issue on GitHub
- Check the documentation
- Review the troubleshooting guide

---

**Locky** - Your files, securely locked away. 🔐✨
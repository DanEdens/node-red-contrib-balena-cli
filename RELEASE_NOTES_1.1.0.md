# Release Notes - Version 1.1.0

## 🚀 Major Authentication Upgrade

Version 1.1.0 introduces a comprehensive authentication system that makes Balena CLI integration seamless and secure for Node-RED users.

## ✨ What's New

### Centralized Authentication
- **New `balena-config` Node**: One configuration to rule them all
- **Multiple Login Methods**: Email/Password, API Token, or Browser login
- **Auto-Authentication**: No more manual CLI login required
- **openBalena Support**: Full support for self-hosted instances

### Enhanced Security
- **Encrypted Storage**: Credentials safely stored in Node-RED
- **API Token Support**: Production-ready authentication
- **Session Management**: Automatic re-authentication when needed
- **No Credential Exposure**: Secure handling throughout the system

### New Supervisor Features
- **`balena-supervisor` Node**: Local device operations
- **Direct API Access**: Bypass CLI for on-device operations
- **Container Management**: Restart, update, lock/unlock operations
- **Device Control**: Reboot, shutdown, purge capabilities

### Updated Nodes
- ✅ **balena-device**: Now with auth integration + blink/ping operations
- ✅ **balena-fleet**: Full authentication integration 
- ✅ **balena-ssh**: Secure SSH operations with auth
- 🔜 **balena-variables**: Coming in v1.2.0
- 🔜 **balena-deploy**: Coming in v1.2.0

## 🛠️ How to Upgrade

1. **Install/Update** the package
2. **Create** a `balena-config` node with your credentials
3. **Update** existing nodes to use the config
4. **Deploy** and enjoy seamless authentication!

## 🎯 Why This Matters

- **Production Ready**: API tokens for automation and CI/CD
- **User Friendly**: No more CLI login headaches
- **Secure**: Enterprise-grade credential management
- **Flexible**: Works with Balena Cloud and openBalena

## 📈 What's Next

- **v1.2.0**: Complete auth integration for variables and deploy nodes
- **v1.3.0**: Multi-organization support and advanced features

---

**Ready to upgrade?** Check out the [CHANGELOG.md](CHANGELOG.md) for full details and migration guide! 

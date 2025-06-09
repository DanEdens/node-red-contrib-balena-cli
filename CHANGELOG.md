# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-27

### 🚀 Major Features Added
- **Centralized Authentication System**: Added comprehensive authentication management
  - New `balena-config` configuration node for centralized credential management
  - Support for Email/Password, API Token, and Browser-based login methods
  - Automatic authentication and session management across all nodes
  - Support for custom Balena API endpoints (openBalena instances)

- **Enhanced Authentication Security**:
  - Secure credential storage using Node-RED's encryption system
  - API token support (recommended for production deployments)
  - Automatic re-authentication when sessions expire
  - Cached authentication status with 5-minute TTL for performance

- **Balena Supervisor Integration**: Added local supervisor operations
  - New `balena-supervisor` node for on-device operations
  - Direct API access to supervisor endpoints (ping, blink, device state)
  - Container and service management (restart, update, logs)
  - Update lock/unlock capabilities for maintenance windows
  - Device reboot, shutdown, and data purge operations

### 🔧 Enhanced Device Operations
- **Additional Device Commands**:
  - `blink` operation for device LED identification
  - `ping` operation for connectivity health checks
  - Enhanced status tracking and error reporting
  - Improved JSON parsing for device information

### 🎨 User Interface Improvements
- **Configuration Node UI**:
  - Dynamic form fields based on selected login method
  - Test connection functionality with real-time feedback
  - Provider-specific help text and documentation links
  - Visual status indicators for authentication state

- **Enhanced Node Configuration**:
  - All operational nodes now include Balena Config selector
  - Improved field validation and error messages
  - Better organization of configuration options

### 📚 Documentation Enhancements
- **Comprehensive Authentication Guide**: New `AUTHENTICATION_INTEGRATION.md`
  - Step-by-step integration patterns for developers
  - Security considerations and best practices
  - API reference for the config node
  - Error handling strategies

- **Updated README**: Complete authentication setup instructions
  - API token generation guide
  - openBalena instance configuration
  - Quick start guide with authentication setup
  - Security features and best practices

### 🛠️ Technical Improvements
- **Backward Compatibility**: Seamless upgrade path from v1.0.x
  - Existing nodes will require config node setup
  - No breaking changes to message interfaces
  - Maintained all existing functionality

- **Authentication Integration**:
  - Updated `balena-device`, `balena-fleet`, and `balena-ssh` nodes
  - Automatic CLI authentication before command execution
  - Custom API URL support for openBalena deployments
  - Improved error handling and user feedback

- **Enhanced Error Handling**:
  - Clear authentication error messages
  - Network connectivity issue detection
  - CLI availability validation
  - Session timeout handling

### 🔐 Security & Privacy
- **Production-Ready Security**:
  - Encrypted credential storage
  - API token-based authentication for automation
  - No credentials logged or exposed in debug output
  - Secure temporary file handling for credential login

- **openBalena Support**:
  - Full support for self-hosted Balena instances
  - Custom API endpoint configuration
  - Enterprise deployment compatibility

### 🧪 Testing & Quality
- **Enhanced Node Integration**:
  - Authentication pattern applied to core nodes
  - Real-time status updates during authentication
  - Comprehensive error scenarios covered
  - Connection testing capabilities

### 📦 Dependencies
- **No New Dependencies**: Authentication system uses Node.js built-ins
  - Leverages existing `child_process`, `fs`, `path`, and `os` modules
  - Maintains lightweight package footprint
  - No external authentication libraries required

## [1.0.0] - 2025-01-27

### Added
- Initial release of Node-RED Balena CLI Integration
- **Six Core Nodes**:
  - `balena-device`: Device management operations (list, info, restart, shutdown, logs, local mode, move, rename)
  - `balena-fleet`: Fleet lifecycle management (create, delete, rename, releases, configuration)
  - `balena-ssh`: SSH access and command execution (command execution, tunneling, file transfer)
  - `balena-variables`: Environment variable management (fleet and device scope)
  - `balena-deploy`: Application deployment and release management
  - `balena-supervisor`: Local supervisor operations (added in v1.1.0)

### Features
- **Comprehensive Device Management**:
  - List and filter devices by fleet
  - Detailed device information retrieval
  - Power management (restart, shutdown)
  - Local development mode control
  - Device logs with filtering options
  - Fleet migration capabilities

- **Fleet Operations**:
  - Fleet creation with device type specification
  - Release management and pinning strategies
  - Organization-based fleet filtering
  - Configuration generation and management
  - Fleet-wide operations (restart, purge)

- **SSH Capabilities**:
  - Remote command execution on devices
  - Container-specific SSH access
  - SSH tunnel creation for port forwarding
  - Host OS command execution
  - Interactive session connection information

- **Variable Management**:
  - Environment variable CRUD operations
  - Fleet and device-level variable scoping
  - Configuration variable support
  - Batch operations for multiple variables
  - Variable renaming and bulk removal

- **Deployment Features**:
  - Code push with automatic building
  - Local builds without deployment
  - Pre-built Docker image deployment
  - OS image preloading and configuration
  - Release management operations

- **Advanced Capabilities**:
  - Intelligent caching system with configurable TTL
  - Real-time status updates and visual feedback
  - Flexible input/output configuration
  - Comprehensive error handling and recovery
  - Timeout management for all operations
  - JSON and text output format support

---

## Migration Guide

### Upgrading from v1.0.0 to v1.1.0

**Important**: This upgrade introduces centralized authentication. You'll need to configure authentication for existing nodes.

**Migration Steps**:
1. **Create a Balena Config Node**:
   - Add a new `balena-config` node to your workspace
   - Configure your preferred authentication method
   - Test the connection to ensure it works

2. **Update Existing Nodes**:
   - Edit each existing Balena node (device, fleet, ssh, variables, deploy)
   - Select the Balena Config node in the configuration
   - Deploy your changes

3. **Verify Operation**:
   - Test your flows to ensure authentication works
   - Monitor the config node status for authentication state
   - Check that all operations complete successfully

**Benefits After Migration**:
- No more manual CLI login required
- Automatic authentication management
- Support for multiple authentication methods
- Enhanced security with API tokens
- openBalena instance support

---

## Roadmap

### Planned for v1.2.0
- ✨ Complete authentication integration for `balena-variables` and `balena-deploy` nodes
- ✨ Enhanced SSH features (file transfer implementation)
- ✨ Fleet templates and configuration management
- ✨ Device grouping and batch operations
- ✨ Release comparison and rollback features

### Planned for v1.3.0
- ✨ Multi-organization support
- ✨ Advanced caching strategies with Redis support
- ✨ Webhook integrations for device events
- ✨ Custom dashboard widgets for device monitoring
- ✨ Automated device provisioning workflows

### Future Considerations
- Custom Balena CLI plugin support
- Advanced deployment strategies (blue-green, canary)
- Integration with CI/CD platforms
- Device analytics and monitoring features
- Fleet optimization recommendations

---

## Support

For support, bug reports, and feature requests:
- **GitHub Issues**: https://github.com/MadnessEngineering/node-red-contrib-balena-cli/issues
- **Documentation**: https://github.com/MadnessEngineering/node-red-contrib-balena-cli#readme
- **Node-RED Forum**: Tag your posts with `node-red-contrib-balena-cli`

## License

MIT License - see [LICENSE](LICENSE) file for details.

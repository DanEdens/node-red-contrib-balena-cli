# node-red-contrib-balena-cli

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Authentication](https://img.shields.io/badge/auth-integrated-green)
![Nodes](https://img.shields.io/badge/nodes-6-brightgreen)

A comprehensive Node-RED wrapper for the Balena CLI, providing powerful IoT device and fleet management capabilities directly within Node-RED flows.

## Overview

This Node-RED contribution package provides six specialized nodes that wrap the Balena CLI, enabling seamless integration of Balena IoT operations into Node-RED automation workflows:

- **balena-config**: Configuration node for authentication and connection management
- **balena-device**: Device management and control
- **balena-fleet**: Fleet lifecycle and configuration management
- **balena-ssh**: SSH access and command execution on devices
- **balena-variables**: Environment variable management for fleets and devices
- **balena-deploy**: Code deployment and release management
- **balena-supervisor**: Local supervisor operations for nodes running on balena devices

## Authentication

### Balena Configuration Node

The `balena-config` node provides centralized authentication management for all Balena operations. It supports three login methods:

1. **Email & Password** - Traditional login with Balena account credentials
2. **API Token** - Token-based authentication (recommended for production)
3. **Browser Login** - Interactive browser-based login (development only)

#### Getting API Tokens
For production deployments, API tokens are recommended:

1. Login to the [Balena Dashboard](https://dashboard.balena-cloud.com)
2. Go to Preferences → Access Tokens
3. Click "Create API Token"
4. Give it a name and copy the token
5. Use the token in your `balena-config` node

#### openBalena Support
For openBalena instances, simply change the API URL in the config node to match your deployment (e.g., `https://api.openbalena.local`).

### Security Features

- Credentials are encrypted and stored securely by Node-RED
- Automatic authentication and session management
- Support for custom Balena API endpoints
- Configurable auto-login behavior

## Features

### 🚀 **Device Management**
- List and filter devices by fleet
- Get detailed device information
- Enable/disable local development mode
- Restart, shutdown, and control device power states
- Retrieve device logs with filtering options
- Move devices between fleets
- Rename and tag devices

### 🏗️ **Fleet Operations**
- Create, delete, and rename fleets
- List fleets with organization filtering
- Manage releases and deployment strategies
- Pin specific releases or track latest
- Generate fleet configurations
- Fleet-wide restart and purge operations
- Tag management for fleet organization

### 🔧 **SSH & Remote Access**
- Execute commands on devices via SSH
- Access specific containers/services
- Create SSH tunnels for port forwarding
- Host OS command execution
- Interactive session connection info
- File transfer capabilities (placeholder)

### ⚙️ **Variable Management**
- Set, get, and remove environment variables
- Support for both fleet-level and device-level variables
- Configuration variable management
- Batch operations for multiple variables
- Variable renaming and bulk operations

### 📦 **Deployment & Build**
- Push code to fleets with automatic building
- Local builds without deployment
- Deploy pre-built Docker images
- OS image preloading and configuration
- Release finalization and invalidation
- Device fleet joining/leaving operations

### 🎯 **Advanced Features**
- **Intelligent Caching** - Configurable caching for read operations
- **Real-time Status Updates** - Visual feedback during long operations
- **Flexible Configuration** - Override settings via message properties
- **Error Handling** - Comprehensive error reporting and recovery
- **Timeout Management** - Configurable timeouts for all operations
- **Output Formats** - JSON and text output options

## Installation

### Prerequisites

1. **Balena CLI** - Install the Balena CLI and ensure it's in your system PATH:
   ```bash
   npm install -g balena-cli
   ```

2. **Balena Account** - You'll need either:
   - A Balena Cloud account (free at [balena.io](https://balena.io))
   - Access to an openBalena instance
   - An API token for authentication

3. **Node-RED** - Ensure Node-RED is installed and running

**Note:** You no longer need to manually login to the Balena CLI as authentication is handled automatically by the `balena-config` node.

### Install the Package

#### Via Node-RED Palette Manager
1. Open Node-RED in your browser
2. Go to the hamburger menu → Manage Palette
3. Click the "Install" tab
4. Search for `node-red-contrib-balena-cli`
5. Click "Install"

#### Via npm
```bash
cd ~/.node-red
npm install node-red-contrib-balena-cli
```

#### Manual Installation
```bash
git clone https://github.com/MadnessEngineering/node-red-contrib-balena-cli.git
cd node-red-contrib-balena-cli
npm install
npm link
cd ~/.node-red
npm link node-red-contrib-balena-cli
```

## Quick Start

### 1. Setup Authentication
First, create a `balena-config` node:
1. Drag a `balena-config` node to your flow
2. Double-click to configure it
3. Choose your login method (Email/Password, API Token, or Browser)
4. Enter your credentials
5. Test the connection
6. Deploy the configuration

### 2. Basic Device Listing
```json
{
  "operation": "list",
  "fleet": "my-iot-fleet"
}
```

### 3. SSH Command Execution
```json
{
  "operation": "command",
  "deviceUuid": "1234567890abcdef",
  "command": "df -h"
}
```

### 4. Environment Variable Management
```json
{
  "operation": "set",
  "scope": "fleet",
  "target": "my-iot-fleet",
  "variableName": "API_URL",
  "variableValue": "https://api.example.com"
}
```

**Note**: `balena-variables` and `balena-deploy` nodes will be updated with authentication integration in v1.2.0. For now, ensure you're logged in via the CLI manually when using these nodes.

### 5. Code Deployment
```json
{
  "operation": "push",
  "fleetName": "my-iot-fleet",
  "sourceDirectory": "/path/to/code",
  "nocache": true
}
```

## 📚 Examples & Templates

The package includes comprehensive example flows to help you get started quickly:

### Ready-to-Use Examples
- **`examples/basic-device-monitoring.json`** - Device health monitoring and alerting
- **`examples/fleet-management.json`** - Fleet operations and release management  
- **`examples/ssh-remote-diagnostics.json`** - Remote device diagnostics and troubleshooting
- **`examples/cicd-deployment-pipeline.json`** - Complete CI/CD pipeline with rollback

### How to Import Examples
1. Open Node-RED → Menu → Import
2. Select "choose file" and browse to the `examples/` directory
3. Choose an example JSON file
4. Configure with your API tokens and device/fleet details
5. Deploy and test!

For detailed setup instructions and customization tips, see [`examples/README.md`](examples/README.md).

## Node Documentation

### balena-device

**Category:** balena
**Color:** #00AEEF (Balena Blue)
**Icon:** fa-microchip

Manages Balena devices with operations including listing, information retrieval, power control, log access, and fleet management.

**Operations:**
- `list` - List devices (optionally filtered by fleet)
- `info` - Get device details
- `enable_local_mode` / `disable_local_mode` - Development mode control
- `restart` / `shutdown` - Power management
- `logs` - Retrieve device logs
- `move` - Transfer device between fleets
- `rename` - Change device name
- `blink` - Blink device LED for identification
- `ping` - Check device connectivity status

### balena-fleet

**Category:** balena
**Color:** #4CAF50 (Green)
**Icon:** fa-ship

Comprehensive fleet management including creation, configuration, release management, and device operations.

**Operations:**
- `list` / `info` - Fleet discovery and details
- `create` / `delete` - Fleet lifecycle
- `rename` - Fleet naming
- `releases` - Release listing
- `pin_release` / `track_latest` - Release strategy
- `config` - Configuration generation
- `restart` / `purge` - Fleet-wide operations
- `devices` - Fleet device listing
- `tags` / `set_tag` / `remove_tag` - Tag management

### balena-ssh

**Category:** balena
**Color:** #FFA500 (Orange)
**Icon:** fa-terminal

Provides SSH access to Balena devices for command execution, tunneling, and file operations.

**Operations:**
- `command` - Execute commands on devices
- `interactive` - Get connection info for manual SSH
- `tunnel` - Create SSH port forwarding
- `file_transfer` - File upload/download (placeholder)
- `host_os` - Host OS command execution

### balena-variables

**Category:** balena
**Color:** #9C27B0 (Purple)
**Icon:** fa-cog

Manages environment and configuration variables at both fleet and device levels.

**Operations:**
- `list` / `get` - Variable retrieval
- `set` / `remove` - Variable management
- `rename` - Variable renaming
- `config_vars` / `set_config_var` - Configuration variables
- `batch_set` / `bulk_remove` - Bulk operations

### balena-deploy

**Category:** balena
**Color:** #FF5722 (Deep Orange)
**Icon:** fa-rocket

Handles code deployment, building, and release management for Balena applications.

**Operations:**
- `push` - Build and deploy code
- `build` - Local build without deployment
- `deploy` - Deploy pre-built images
- `preload` - OS image preloading
- `release_finalize` / `release_invalidate` - Release management
- `join` / `leave` - Device fleet management
- `os_configure` / `local_configure` - OS and device configuration

### balena-supervisor

**Category:** balena
**Color:** #8cc8ff (Light Blue)
**Icon:** balena.png

Manages local supervisor operations for nodes running ON balena devices (not remote management).

**Operations:**
- `ping` - Check supervisor connectivity
- `blink` - Blink device LED for identification
- `device` - Get device state information
- `restart` - Restart a specific service/container
- `reboot` - Reboot the entire device
- `shutdown` - Shutdown the device
- `purge` - Purge application data
- `update` - Trigger application update
- `lock` - Lock updates
- `unlock` - Unlock updates
- `apps` - Get application state
- `logs` - Get supervisor logs

**Requirements:**
- Must be running on a balena device
- Requires `BALENA_SUPERVISOR_ADDRESS` and `BALENA_SUPERVISOR_API_KEY` environment variables

## Configuration Options

### Common Settings

- **Name** - Node display name
- **Operation** - Primary operation to perform
- **Timeout** - Command execution timeout (milliseconds)
- **Output Format** - JSON or text output
- **Enable Caching** - Cache read operations for performance
- **Cache Duration** - How long to cache results (seconds)

### Node-Specific Settings

Each node has specific configuration options relevant to its operations:

- **Device nodes** require Device UUIDs
- **Fleet nodes** require Fleet names and optionally Device types
- **SSH nodes** require connection parameters
- **Variable nodes** require scope (fleet/device) and target
- **Deploy nodes** require source directories and build options

## Message Properties

All nodes support configuration override via message properties. Common properties include:

```javascript
msg = {
  operation: "list",           // Override configured operation
  timeout: 60000,             // Override timeout
  cached: false,              // Force fresh execution
  // Node-specific properties...
  deviceUuid: "...",          // For device operations
  fleetName: "...",           // For fleet operations
  command: "...",             // For SSH operations
  variableName: "...",        // For variable operations
  sourceDirectory: "..."      // For deployment operations
}
```

## Examples

### Fleet Device Monitoring
Create a flow that monitors all devices in a fleet and alerts on offline devices:

1. **Inject node** → triggers every 5 minutes
2. **balena-device** → `list` operation with fleet filter
3. **Function node** → filter offline devices
4. **Switch node** → route if any offline devices found
5. **Notification** → send alert

### Automated Deployment Pipeline
Create a CI/CD pipeline that deploys code when changes are detected:

1. **File Watch** → monitors code directory
2. **balena-deploy** → `push` operation with nocache option
3. **balena-device** → `restart` all devices in fleet
4. **Notification** → deployment success/failure alert

### Environment Configuration Management
Manage environment variables across fleets:

1. **HTTP In** → receives configuration updates
2. **Function node** → processes configuration changes
3. **balena-variables** → `batch_set` operation
4. **balena-fleet** → `restart` to apply changes
5. **HTTP Response** → confirm completion

### Remote Device Diagnostics
SSH into devices to run diagnostic commands:

1. **Dashboard Input** → select device and command
2. **balena-ssh** → `command` operation
3. **Function node** → format output
4. **Dashboard Output** → display results

## Error Handling

All nodes provide comprehensive error handling:

- **CLI Errors** - Balena CLI command failures
- **Authentication** - Invalid or expired credentials
- **Network Issues** - Connectivity problems
- **Timeout Errors** - Operation timeouts
- **Validation** - Invalid parameters or missing requirements

Error information is available in:
- Node status indicators
- `msg.error` property
- Node-RED debug panel
- Console logs

## Performance & Caching

### Caching Strategy
- **Read operations** (list, info, logs) are cached by default
- **Write operations** always execute fresh
- Cache keys include operation and parameters
- Configurable cache duration per node

### Timeout Management
- Default timeouts are optimized per operation type
- Build operations: 30 minutes
- Standard operations: 30 seconds
- SSH operations: 30 seconds
- Configurable per node instance

### Resource Usage
- Minimal memory footprint with optional caching
- Efficient CLI command execution
- Concurrent operation support
- Background process management for long operations

## Troubleshooting

### Common Issues

**"balena command not found"**
- Ensure Balena CLI is installed and in PATH
- Verify installation: `which balena`

**"Authentication failed"**
- Login to Balena: `balena login`
- Check authentication: `balena whoami`

**"Device not found"**
- Verify device UUID is correct
- Ensure device is online and accessible
- Check fleet permissions

**"SSH connection failed"**
- Verify device is online
- Ensure SSH is enabled on device
- Check network connectivity

### Debug Mode
Enable debug logging by setting the environment variable:
```bash
DEBUG=node-red-contrib-balena-cli:* node-red
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Link for development: `npm link`
4. Run tests: `npm test`

### Reporting Issues
Please report issues on our [GitHub Issues](https://github.com/MadnessEngineering/node-red-contrib-balena-cli/issues) page with:
- Node-RED version
- Balena CLI version
- Operating system
- Detailed error messages
- Steps to reproduce

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation:** [GitHub Wiki](https://github.com/MadnessEngineering/node-red-contrib-balena-cli/wiki)
- **Issues:** [GitHub Issues](https://github.com/MadnessEngineering/node-red-contrib-balena-cli/issues)
- **Discussions:** [GitHub Discussions](https://github.com/MadnessEngineering/node-red-contrib-balena-cli/discussions)

## Acknowledgments

- [Balena](https://balena.io) - For the excellent IoT platform and CLI
- [Node-RED](https://nodered.org) - For the fantastic flow-based programming environment
- [MadnessEngineering](https://github.com/MadnessEngineering) - Project maintainers

---

**Made with ❤️ by the MadnessEngineering team**

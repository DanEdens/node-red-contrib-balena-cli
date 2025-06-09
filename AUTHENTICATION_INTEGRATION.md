# Balena CLI Authentication Integration Guide

This document explains how the `balena-config` configuration node is integrated with all Balena CLI nodes to handle authentication automatically.

## Overview

The `balena-config` node provides centralized authentication management for all Balena CLI operations. It supports three login methods:

1. **Email & Password** - Traditional login with Balena account credentials
2. **API Token** - Token-based authentication (recommended for production)
3. **Browser Login** - Interactive browser-based login (development only)

## Integration Pattern

### 1. Node Configuration (JavaScript)

Each Balena node needs to be updated to reference the config node:

```javascript
function BalenaDeviceNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    
    // Get the configuration node
    node.balenaConfig = RED.nodes.getNode(config.balenaConfig);
    if (!node.balenaConfig) {
        node.error("No Balena configuration specified");
        return;
    }
    
    // ... rest of node setup
}
```

### 2. Command Execution with Authentication

Update the `executeBalenaCommand` function to handle authentication:

```javascript
function executeBalenaCommand(command, options = {}) {
    return new Promise(async (resolve, reject) => {
        try {
            // Ensure we're authenticated
            const isAuthenticated = await node.balenaConfig.checkAuth();
            if (!isAuthenticated) {
                // Try to login
                const loginSuccess = await node.balenaConfig.login();
                if (!loginSuccess) {
                    reject(new Error("Balena authentication failed"));
                    return;
                }
            }
            
            // Get the authenticated command (handles custom API URLs)
            const authenticatedCommand = node.balenaConfig.getAuthenticatedCommand(command);
            
            // Execute the command
            exec(authenticatedCommand, options, (error, stdout, stderr) => {
                // ... handle execution results
            });
        } catch (authError) {
            reject(new Error(`Authentication error: ${authError.message}`));
        }
    });
}
```

### 3. HTML Configuration Updates

Update the defaults to include the config node reference:

```javascript
defaults: {
    name: {value: ""},
    balenaConfig: {value: "", type: "balena-config", required: true},
    // ... other defaults
}
```

Add the configuration field to the HTML template:

```html
<div class="form-row">
    <label for="node-input-balenaConfig"><i class="fa fa-cog"></i> Balena Config</label>
    <input type="text" id="node-input-balenaConfig">
</div>
```

## Config Node API

The `balena-config` node provides the following methods:

### `checkAuth()`
Returns a promise that resolves to `true` if currently authenticated, `false` otherwise.
Results are cached for 5 minutes to avoid excessive checks.

### `login()`
Attempts to login using the configured method. Returns a promise that resolves to `true` on success.

### `logout()`
Logs out of the current Balena session. Returns a promise that resolves to `true` on success.

### `getAuthenticatedCommand(baseCommand)`
Returns the command with proper API URL configuration if using a custom Balena instance.

## Status Indicators

The config node shows its status in the Node-RED editor:

- **🟢 Logged in: username** - Successfully authenticated
- **🔵 Logging in...** - Authentication in progress
- **🔴 Not logged in** - Not authenticated
- **🔴 Login failed** - Authentication error

## Nodes to Update

The following nodes need to be updated with this authentication pattern:

- ✅ `balena-device` - Updated (example implementation)
- ✅ `balena-fleet` - Updated in v1.1.0
- ✅ `balena-ssh` - Updated in v1.1.0
- ⏳ `balena-variables` - Needs update (planned for v1.2.0)
- ⏳ `balena-deploy` - Needs update (planned for v1.2.0)
- ✅ `balena-supervisor` - Uses direct API (no CLI auth needed)

## Security Considerations

1. **Credential Storage**: All credentials are encrypted and stored securely by Node-RED
2. **API Tokens**: Recommended for production deployments as they can be easily revoked
3. **Session Management**: CLI sessions are shared across all nodes using the same config
4. **Auto-Login**: Can be disabled for environments requiring manual authentication

## Error Handling

The authentication system handles various error scenarios:

- **CLI Not Found**: Clear error message if Balena CLI is not installed
- **Invalid Credentials**: Proper error reporting for login failures
- **Network Issues**: Timeout and retry logic for connectivity problems
- **Token Expiry**: Automatic re-authentication when tokens expire

## Example Usage

1. Create a `balena-config` node with your credentials
2. Configure any Balena operation node to use this config
3. Deploy your flow - authentication happens automatically
4. Monitor the config node status for authentication state

The config node handles all the complexity of CLI authentication, allowing you to focus on your automation logic. 

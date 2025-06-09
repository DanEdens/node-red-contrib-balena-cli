# Node-RED Balena CLI Examples

This directory contains example flows demonstrating the capabilities of the `node-red-contrib-balena-cli` package. Each example showcases different aspects of IoT device management using Balena CLI integration.

## 📋 Available Examples

### 1. Basic Device Monitoring (`basic-device-monitoring.json`)
**Purpose**: Demonstrates basic device monitoring and management operations.

**Features**:
- Automatic device listing with 5-minute intervals
- Offline device detection and alerting
- Device LED blinking for identification
- Detailed device information retrieval
- System status monitoring

**Use Cases**:
- IoT device health monitoring
- Device identification and troubleshooting
- Fleet status dashboards
- Automated alerting systems

### 2. Fleet Management (`fleet-management.json`)
**Purpose**: Comprehensive fleet lifecycle management operations.

**Features**:
- Fleet creation and configuration
- Release management and pinning
- Fleet information and device listing
- Fleet-wide operations (restart, purge)
- Release tracking strategies

**Use Cases**:
- Fleet provisioning and management
- Release deployment strategies
- Fleet health monitoring
- Device organization and control

### 3. SSH Remote Diagnostics (`ssh-remote-diagnostics.json`)
**Purpose**: Remote device access and diagnostic capabilities.

**Features**:
- System status checks (disk, memory, uptime)
- Container log retrieval
- Network connectivity testing
- Container-specific command execution
- SSH tunnel configuration
- Host OS command execution

**Use Cases**:
- Remote device troubleshooting
- System performance monitoring
- Network diagnostics
- Secure remote access setup
- Container management

### 4. CI/CD Deployment Pipeline (`cicd-deployment-pipeline.json`)
**Purpose**: Complete automated deployment pipeline with testing and rollback.

**Features**:
- Webhook-triggered deployments
- Pre-deployment health checks
- Automated rollback on failure
- Post-deployment verification
- Deployment notifications
- Fleet health analysis

**Use Cases**:
- Automated code deployment
- Continuous integration/deployment
- Production deployment safety
- Release management automation
- DevOps workflow integration

## 🚀 Quick Start

### Step 1: Import Examples
1. Open Node-RED in your browser
2. Click the hamburger menu → Import
3. Choose "select a file to import"
4. Select one of the example JSON files
5. Click "Import"

### Step 2: Configure Authentication
Before using any example, you need to set up authentication:

1. **Create API Token**:
   - Login to [Balena Dashboard](https://dashboard.balena-cloud.com)
   - Go to Preferences → Access Tokens
   - Create a new API token and copy it

2. **Update Config Nodes**:
   - Double-click the `balena-config` node in your imported flow
   - Paste your API token in the appropriate field
   - Test the connection
   - Deploy the configuration

### Step 3: Customize for Your Environment
Update the example with your specific details:

- **Device UUIDs**: Replace `your_device_uuid_here` with actual device UUIDs
- **Fleet Names**: Replace `your_fleet_name_here` with your fleet names
- **Source Directories**: Update paths to your code repositories
- **Organizations**: Add your organization names if applicable

### Step 4: Deploy and Test
1. Click "Deploy" to activate your flow
2. Use the inject nodes to trigger operations
3. Monitor debug output for results
4. Check the Node-RED debug panel for detailed information

## 🔧 Configuration Tips

### Authentication Methods
The examples use API token authentication (recommended for automation):

```javascript
// Example config node settings
{
    "loginMethod": "apiToken",
    "apiToken": "your_api_token_here",
    "balenaUrl": "https://api.balena-cloud.com",
    "autoLogin": true
}
```

### openBalena Support
For openBalena instances, update the `balenaUrl`:

```javascript
{
    "balenaUrl": "https://api.openbalena.local",
    // ... other settings
}
```

### Custom Timeouts
Adjust timeouts based on your network and fleet size:

```javascript
{
    "timeout": 60000,  // 60 seconds for large operations
    "cacheDuration": 300  // 5 minutes cache
}
```

## 📊 Example Usage Scenarios

### Scenario 1: Device Health Dashboard
Use the **Basic Device Monitoring** example to create a real-time dashboard:

1. Set up device monitoring with 5-minute intervals
2. Add dashboard UI nodes to display device status
3. Configure email/SMS notifications for offline devices
4. Create charts showing device health trends

### Scenario 2: Automated Deployment Pipeline
Use the **CI/CD Pipeline** example for continuous deployment:

1. Configure GitHub/GitLab webhooks to trigger deployments
2. Set up Slack/Teams notifications for deployment status
3. Add custom testing steps before deployment
4. Configure automatic rollback thresholds

### Scenario 3: Remote Device Troubleshooting
Use the **SSH Diagnostics** example for support workflows:

1. Create a support dashboard with device selection
2. Run diagnostic commands on selected devices
3. Display system information and logs
4. Generate diagnostic reports

### Scenario 4: Fleet Operations Management
Use the **Fleet Management** example for operational workflows:

1. Automate fleet creation for new projects
2. Manage release strategies across environments
3. Monitor fleet health and performance
4. Implement staged deployment processes

## 🛠️ Customization Guide

### Adding Custom Commands
Extend the SSH diagnostic example with custom commands:

```javascript
// In the function node, add custom diagnostic commands
const customCommands = {
    "temperature": "cat /sys/class/thermal/thermal_zone*/temp",
    "docker_stats": "docker stats --no-stream",
    "network_interfaces": "ip addr show"
};
```

### Integrating with External Systems
Examples can be enhanced with external integrations:

- **Monitoring**: Send metrics to InfluxDB/Grafana
- **Notifications**: Integrate with Slack, Teams, or PagerDuty
- **Logging**: Forward logs to ELK stack or cloud logging
- **Analytics**: Send deployment data to analytics platforms

### Error Handling
Add robust error handling to your flows:

```javascript
// Example error handling in function nodes
try {
    // Your logic here
    return msg;
} catch (error) {
    node.error(`Operation failed: ${error.message}`, msg);
    return null;
}
```

## 🔍 Troubleshooting

### Common Issues

**Authentication Failures**:
- Verify your API token is correct
- Check the Balena URL matches your instance
- Ensure you have proper permissions for the operations

**Device Not Found**:
- Verify device UUIDs are correct
- Check that devices are online and accessible
- Ensure devices belong to the specified fleet

**Timeout Errors**:
- Increase timeout values for slow operations
- Check network connectivity to Balena cloud
- Verify CLI operations work manually

**SSH Connection Issues**:
- Ensure SSH is enabled on target devices
- Check device is online and accessible
- Verify SSH port configuration (default: 22222)

### Debug Mode
Enable debug output for troubleshooting:

1. Add debug nodes to your flows
2. Set debug level to "complete msg object"
3. Monitor the debug panel during operation
4. Check Node-RED logs for detailed error information

## 📚 Next Steps

After trying these examples:

1. **Explore the Documentation**: Read the main [README.md](../README.md) for detailed API documentation
2. **Join the Community**: Participate in discussions and share your use cases
3. **Contribute**: Submit improvements or new examples via GitHub
4. **Build Custom Solutions**: Use these examples as templates for your specific needs

## 🔗 Related Resources

- [Balena CLI Documentation](https://docs.balena.io/reference/balena-cli/)
- [Node-RED Documentation](https://nodered.org/docs/)
- [Balena Dashboard](https://dashboard.balena-cloud.com)
- [Package Repository](https://github.com/MadnessEngineering/node-red-contrib-balena-cli)

---

**Happy IoT Development!** 🚀

For questions or support, please visit our [GitHub Issues](https://github.com/MadnessEngineering/node-red-contrib-balena-cli/issues) page. 

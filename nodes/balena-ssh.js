module.exports = function (RED)
{
    "use strict";

    const { spawn } = require('child_process');
    const { Client } = require('ssh2');

    function BalenaSSHNode(config)
    {
        RED.nodes.createNode(this, config);
        const node = this;

        // Configuration
        node.name = config.name;
        node.operation = config.operation || "command";
        node.deviceUuid = config.deviceUuid || "";
        node.command = config.command || "";
        node.container = config.container || ""; // For service-specific SSH
        node.timeout = parseInt(config.timeout) || 30000;
        node.sshPort = parseInt(config.sshPort) || 22222;
        node.useBuiltInSsh = config.useBuiltInSsh !== false; // Default to true

        // Status tracking
        function updateStatus(text, color = "grey")
        {
            node.status({
                fill: color,
                shape: "dot",
                text: text
            });
        }

        // Execute Balena CLI SSH command
        function executeBalenaSshCommand(deviceUuid, command, options = {})
        {
            return new Promise((resolve, reject) =>
            {
                updateStatus("connecting", "blue");

                const args = ['ssh', deviceUuid];
                if (options.container)
                {
                    args.push('--container', options.container);
                }
                if (command)
                {
                    args.push(command);
                }

                const balena = spawn('balena', args, {
                    timeout: node.timeout,
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                let stdout = '';
                let stderr = '';

                balena.stdout.on('data', (data) =>
                {
                    stdout += data.toString();
                });

                balena.stderr.on('data', (data) =>
                {
                    stderr += data.toString();
                });

                balena.on('close', (code) =>
                {
                    if (code === 0)
                    {
                        updateStatus("ready", "green");
                        resolve({
                            success: true,
                            stdout: stdout.trim(),
                            stderr: stderr.trim(),
                            exitCode: code
                        });
                    } else
                    {
                        updateStatus("error", "red");
                        reject(new Error(`SSH command failed with exit code ${code}: ${stderr}`));
                    }
                });

                balena.on('error', (error) =>
                {
                    updateStatus("error", "red");
                    reject(new Error(`Failed to execute SSH command: ${error.message}`));
                });
            });
        }

        // Create SSH tunnel using Balena CLI
        function createBalenaTunnel(deviceUuid, localPort, remotePort, remoteHost = 'localhost')
        {
            return new Promise((resolve, reject) =>
            {
                updateStatus("creating tunnel", "blue");

                const args = ['device', 'tunnel', deviceUuid, `${localPort}:${remoteHost}:${remotePort}`];

                const tunnel = spawn('balena', args, {
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                let tunnelReady = false;

                tunnel.stdout.on('data', (data) =>
                {
                    const output = data.toString();
                    if (output.includes('Tunnel established') || output.includes('started'))
                    {
                        tunnelReady = true;
                        updateStatus("tunnel ready", "green");
                        resolve({
                            success: true,
                            localPort: localPort,
                            remotePort: remotePort,
                            remoteHost: remoteHost,
                            process: tunnel
                        });
                    }
                });

                tunnel.stderr.on('data', (data) =>
                {
                    const error = data.toString();
                    if (!tunnelReady)
                    {
                        updateStatus("tunnel error", "red");
                        reject(new Error(`Tunnel creation failed: ${error}`));
                    }
                });

                tunnel.on('error', (error) =>
                {
                    if (!tunnelReady)
                    {
                        updateStatus("error", "red");
                        reject(new Error(`Failed to create tunnel: ${error.message}`));
                    }
                });

                // Set timeout for tunnel establishment
                setTimeout(() =>
                {
                    if (!tunnelReady)
                    {
                        tunnel.kill();
                        reject(new Error('Tunnel creation timeout'));
                    }
                }, node.timeout);
            });
        }

        // Direct SSH connection (requires SSH keys or device to be in local mode)
        function executeDirectSsh(deviceUuid, command, options = {})
        {
            return new Promise((resolve, reject) =>
            {
                updateStatus("connecting direct", "blue");

                // This would require device IP resolution and SSH key management
                // For now, we'll use the Balena CLI approach
                executeBalenaSshCommand(deviceUuid, command, options)
                    .then(resolve)
                    .catch(reject);
            });
        }

        // SSH operations
        const sshOperations = {
            command: async (params = {}) =>
            {
                const deviceUuid = params.deviceUuid || node.deviceUuid;
                const command = params.command || node.command;
                const container = params.container || node.container;

                if (!deviceUuid) throw new Error('Device UUID is required for SSH command');
                if (!command) throw new Error('Command is required for SSH operation');

                const options = {};
                if (container) options.container = container;

                if (node.useBuiltInSsh)
                {
                    return await executeBalenaSshCommand(deviceUuid, command, options);
                } else
                {
                    return await executeDirectSsh(deviceUuid, command, options);
                }
            },

            interactive: async (params = {}) =>
            {
                const deviceUuid = params.deviceUuid || node.deviceUuid;
                const container = params.container || node.container;

                if (!deviceUuid) throw new Error('Device UUID is required for interactive SSH');

                // For interactive sessions, we don't execute directly but provide connection info
                return {
                    success: true,
                    message: 'Interactive SSH session info',
                    connectionCommand: container
                        ? `balena ssh ${deviceUuid} --container ${container}`
                        : `balena ssh ${deviceUuid}`,
                    deviceUuid: deviceUuid,
                    container: container || null
                };
            },

            tunnel: async (params = {}) =>
            {
                const deviceUuid = params.deviceUuid || node.deviceUuid;
                const localPort = params.localPort || 8080;
                const remotePort = params.remotePort || 80;
                const remoteHost = params.remoteHost || 'localhost';

                if (!deviceUuid) throw new Error('Device UUID is required for SSH tunnel');

                return await createBalenaTunnel(deviceUuid, localPort, remotePort, remoteHost);
            },

            file_transfer: async (params = {}) =>
            {
                const deviceUuid = params.deviceUuid || node.deviceUuid;
                const source = params.source;
                const destination = params.destination;
                const direction = params.direction || 'upload'; // 'upload' or 'download'

                if (!deviceUuid || !source || !destination)
                {
                    throw new Error('Device UUID, source, and destination are required for file transfer');
                }

                // Use SCP-like functionality through Balena CLI or direct SSH
                let command;
                if (direction === 'upload')
                {
                    command = `echo "File upload: ${source} -> ${destination}"`;
                } else
                {
                    command = `echo "File download: ${source} -> ${destination}"`;
                }

                // This is a placeholder - actual file transfer would require more complex implementation
                return {
                    success: true,
                    message: `File transfer ${direction} prepared`,
                    source: source,
                    destination: destination,
                    direction: direction,
                    note: 'File transfer implementation requires additional development'
                };
            },

            host_os: async (params = {}) =>
            {
                const deviceUuid = params.deviceUuid || node.deviceUuid;
                const command = params.command || node.command;

                if (!deviceUuid) throw new Error('Device UUID is required for host OS command');
                if (!command) throw new Error('Command is required for host OS operation');

                // Access host OS directly (not in container)
                const fullCommand = `balena ssh ${deviceUuid} '${command}'`;

                return new Promise((resolve, reject) =>
                {
                    const proc = spawn('sh', ['-c', fullCommand], {
                        timeout: node.timeout
                    });

                    let stdout = '';
                    let stderr = '';

                    proc.stdout.on('data', (data) =>
                    {
                        stdout += data.toString();
                    });

                    proc.stderr.on('data', (data) =>
                    {
                        stderr += data.toString();
                    });

                    proc.on('close', (code) =>
                    {
                        if (code === 0)
                        {
                            resolve({
                                success: true,
                                stdout: stdout.trim(),
                                stderr: stderr.trim(),
                                exitCode: code
                            });
                        } else
                        {
                            reject(new Error(`Host OS command failed with exit code ${code}: ${stderr}`));
                        }
                    });

                    proc.on('error', (error) =>
                    {
                        reject(new Error(`Failed to execute host OS command: ${error.message}`));
                    });
                });
            }
        };

        // Handle incoming messages
        node.on('input', async function (msg, send, done)
        {
            try
            {
                // Extract operation and parameters from message
                const operation = msg.operation || node.operation;
                const params = {
                    deviceUuid: msg.deviceUuid || node.deviceUuid,
                    command: msg.command || node.command,
                    container: msg.container || node.container,
                    localPort: msg.localPort,
                    remotePort: msg.remotePort,
                    remoteHost: msg.remoteHost,
                    source: msg.source,
                    destination: msg.destination,
                    direction: msg.direction,
                    ...msg.params
                };

                // Execute operation
                if (!sshOperations[operation])
                {
                    throw new Error(`Unknown SSH operation: ${operation}`);
                }

                updateStatus(`executing ${operation}`, "blue");
                const result = await sshOperations[operation](params);

                // Send result
                msg.payload = result;
                msg.operation = operation;
                updateStatus("ready", "green");
                send(msg);
                done();

            } catch (error)
            {
                updateStatus("error", "red");
                node.error(`Balena SSH operation failed: ${error.message}`, msg);
                done(error);
            }
        });

        updateStatus("ready");
    }

    RED.nodes.registerType("balena-ssh", BalenaSSHNode);
}; 

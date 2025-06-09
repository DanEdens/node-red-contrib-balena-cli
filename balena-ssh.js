module.exports = function (RED)
{
    "use strict";

    const { exec, spawn } = require('child_process');

    function BalenaSSHNode(config)
    {
        RED.nodes.createNode(this, config);
        const node = this;

        // Configuration
        node.operation = config.operation || "command";
        node.deviceUuid = config.deviceUuid || "";
        node.command = config.command || "";
        node.container = config.container || "";
        node.field = config.field || "payload";
        node.fieldType = config.fieldType || "msg";
        node.timeout = parseInt(config.timeout) || 30000;
        node.sshPort = parseInt(config.sshPort) || 22222;

        // Get the configuration node
        node.balenaConfig = RED.nodes.getNode(config.balenaConfig);
        if (!node.balenaConfig)
        {
            node.error("No Balena configuration specified");
            return;
        }

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
        function executeBalenaSshCommand(command, options = {})
        {
            return new Promise(async (resolve, reject) =>
            {
                try
                {
                    // Ensure we're authenticated
                    const isAuthenticated = await node.balenaConfig.checkAuth();
                    if (!isAuthenticated)
                    {
                        // Try to login
                        const loginSuccess = await node.balenaConfig.login();
                        if (!loginSuccess)
                        {
                            reject(new Error("Balena authentication failed"));
                            return;
                        }
                    }

                    // Get the authenticated command
                    const authenticatedCommand = node.balenaConfig.getAuthenticatedCommand(command);

                    const timeoutId = setTimeout(() =>
                    {
                        reject(new Error(`Command timed out after ${node.timeout}ms`));
                    }, node.timeout);

                    exec(authenticatedCommand, options, (error, stdout, stderr) =>
                    {
                        clearTimeout(timeoutId);

                        if (error)
                        {
                            reject(new Error(`Balena SSH error: ${error.message}\nStderr: ${stderr}`));
                            return;
                        }

                        resolve({
                            success: true,
                            stdout: stdout.trim(),
                            stderr: stderr.trim(),
                            exitCode: 0
                        });
                    });
                } catch (authError)
                {
                    reject(new Error(`Authentication error: ${authError.message}`));
                }
            });
        }

        // SSH operations
        const sshOperations = {
            command: async (params) =>
            {
                if (!params.deviceUuid || !params.command)
                {
                    throw new Error("Device UUID and command are required for SSH command");
                }

                let command = `balena ssh ${params.deviceUuid}`;
                if (params.container)
                {
                    command += ` --container ${params.container}`;
                }
                command += ` '${params.command}'`;

                return await executeBalenaSshCommand(command);
            },

            interactive: async (params) =>
            {
                if (!params.deviceUuid)
                {
                    throw new Error("Device UUID is required for interactive SSH");
                }

                return {
                    success: true,
                    message: 'Interactive SSH session info',
                    connectionCommand: params.container
                        ? `balena ssh ${params.deviceUuid} --container ${params.container}`
                        : `balena ssh ${params.deviceUuid}`,
                    deviceUuid: params.deviceUuid,
                    container: params.container || null
                };
            },

            tunnel: async (params) =>
            {
                if (!params.deviceUuid)
                {
                    throw new Error("Device UUID is required for SSH tunnel");
                }

                const localPort = params.localPort || 8080;
                const remotePort = params.remotePort || 80;
                const remoteHost = params.remoteHost || 'localhost';

                const command = `balena device tunnel ${params.deviceUuid} ${localPort}:${remoteHost}:${remotePort}`;

                return {
                    success: true,
                    message: `SSH tunnel command prepared`,
                    command: command,
                    localPort: localPort,
                    remotePort: remotePort,
                    remoteHost: remoteHost,
                    note: 'Use the command in a separate terminal to establish the tunnel'
                };
            },

            file_transfer: async (params) =>
            {
                if (!params.deviceUuid || !params.source || !params.destination)
                {
                    throw new Error("Device UUID, source, and destination are required for file transfer");
                }

                const direction = params.direction || 'upload';

                return {
                    success: true,
                    message: `File transfer ${direction} prepared`,
                    source: params.source,
                    destination: params.destination,
                    direction: direction,
                    note: 'File transfer implementation requires additional development'
                };
            },

            host_os: async (params) =>
            {
                if (!params.deviceUuid || !params.command)
                {
                    throw new Error("Device UUID and command are required for host OS command");
                }

                const command = `balena ssh ${params.deviceUuid} '${params.command}'`;
                return await executeBalenaSshCommand(command);
            }
        };

        // Main message handler
        node.on('input', async function (msg, send, done)
        {
            send = send || function () { node.send.apply(node, arguments); };

            try
            {
                updateStatus("Processing...", "blue");

                // Extract input data
                let inputData;
                if (node.fieldType === "msg")
                {
                    inputData = RED.util.getMessageProperty(msg, node.field);
                } else if (node.fieldType === "flow")
                {
                    inputData = node.context().flow.get(node.field);
                } else if (node.fieldType === "global")
                {
                    inputData = node.context().global.get(node.field);
                }

                // Prepare operation parameters
                const params = {
                    deviceUuid: inputData?.deviceUuid || node.deviceUuid || msg.deviceUuid,
                    command: inputData?.command || node.command || msg.command,
                    container: inputData?.container || node.container || msg.container,
                    localPort: inputData?.localPort || msg.localPort,
                    remotePort: inputData?.remotePort || msg.remotePort,
                    remoteHost: inputData?.remoteHost || msg.remoteHost,
                    source: inputData?.source || msg.source,
                    destination: inputData?.destination || msg.destination,
                    direction: inputData?.direction || msg.direction
                };

                // Determine operation from config or message
                const operation = inputData?.operation || msg.operation || node.operation;

                // Execute operation
                if (!sshOperations[operation])
                {
                    throw new Error(`Unknown operation: ${operation}`);
                }

                const result = await sshOperations[operation](params);

                // Send result
                msg.payload = result;
                msg.operation = operation;
                msg.deviceUuid = params.deviceUuid;

                updateStatus(`${operation} completed`, "green");
                send(msg);
                done();

            } catch (error)
            {
                updateStatus(`Error: ${error.message}`, "red");
                node.error(error.message, msg);
                done(error);
            }
        });

        // Initial status
        updateStatus("Ready");
    }

    RED.nodes.registerType("balena-ssh", BalenaSSHNode);
}; 

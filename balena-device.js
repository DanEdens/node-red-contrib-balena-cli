module.exports = function (RED)
{
    "use strict";

    const { exec, spawn } = require('child_process');
    const NodeCache = require('node-cache');

    function BalenaDeviceNode(config)
    {
        RED.nodes.createNode(this, config);
        const node = this;

        // Configuration
        node.operation = config.operation || "list";
        node.deviceUuid = config.deviceUuid || "";
        node.fleetName = config.fleetName || "";
        node.field = config.field || "payload";
        node.fieldType = config.fieldType || "msg";
        node.enableCaching = config.enableCaching !== false;
        node.cacheDuration = parseInt(config.cacheDuration) || 300; // 5 minutes default
        node.timeout = parseInt(config.timeout) || 30000;
        node.outputFormat = config.outputFormat || "json";

        // Get the configuration node
        node.balenaConfig = RED.nodes.getNode(config.balenaConfig);
        if (!node.balenaConfig)
        {
            node.error("No Balena configuration specified");
            return;
        }

        // Initialize cache
        const cache = node.enableCaching ? new NodeCache({
            stdTTL: node.cacheDuration,
            checkperiod: 60
        }) : null;

        // Status tracking
        function updateStatus(text, color = "grey")
        {
            node.status({
                fill: color,
                shape: "dot",
                text: text
            });
        }

        // Generate cache key
        function generateCacheKey(operation, deviceUuid, additionalParams = {})
        {
            const keyData = { operation, deviceUuid, ...additionalParams };
            return `device_${JSON.stringify(keyData)}`;
        }

        // Execute Balena CLI command
        function executeBalenaCommand(command, options = {})
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
                            reject(new Error(`Balena CLI error: ${error.message}\nStderr: ${stderr}`));
                            return;
                        }

                        try
                        {
                            // Try to parse as JSON if output format is JSON
                            if (node.outputFormat === "json" && stdout.trim())
                            {
                                resolve(JSON.parse(stdout));
                            } else
                            {
                                resolve(stdout.trim());
                            }
                        } catch (parseError)
                        {
                            // If JSON parsing fails, return raw text
                            resolve(stdout.trim());
                        }
                    });
                } catch (authError)
                {
                    reject(new Error(`Authentication error: ${authError.message}`));
                }
            });
        }

        // Device operations
        const deviceOperations = {
            list: async (params) =>
            {
                let command = "balena devices";
                if (params.fleetName)
                {
                    command += ` --fleet ${params.fleetName}`;
                }
                if (node.outputFormat === "json")
                {
                    command += " --json";
                }
                return await executeBalenaCommand(command);
            },

            info: async (params) =>
            {
                if (!params.deviceUuid)
                {
                    throw new Error("Device UUID is required for info operation");
                }
                let command = `balena device ${params.deviceUuid}`;
                if (node.outputFormat === "json")
                {
                    command += " --json";
                }
                return await executeBalenaCommand(command);
            },

            restart: async (params) =>
            {
                if (!params.deviceUuid)
                {
                    throw new Error("Device UUID is required for restart operation");
                }
                const command = `balena device restart ${params.deviceUuid}`;
                return await executeBalenaCommand(command);
            },

            shutdown: async (params) =>
            {
                if (!params.deviceUuid)
                {
                    throw new Error("Device UUID is required for shutdown operation");
                }
                const command = `balena device shutdown ${params.deviceUuid}`;
                return await executeBalenaCommand(command);
            },

            logs: async (params) =>
            {
                if (!params.deviceUuid)
                {
                    throw new Error("Device UUID is required for logs operation");
                }
                let command = `balena logs ${params.deviceUuid}`;
                if (params.tail)
                {
                    command += ` --tail ${params.tail}`;
                }
                if (params.since)
                {
                    command += ` --since ${params.since}`;
                }
                return await executeBalenaCommand(command);
            },

            enableLocalMode: async (params) =>
            {
                if (!params.deviceUuid)
                {
                    throw new Error("Device UUID is required for enabling local mode");
                }
                const command = `balena device local-mode enable ${params.deviceUuid}`;
                return await executeBalenaCommand(command);
            },

            disableLocalMode: async (params) =>
            {
                if (!params.deviceUuid)
                {
                    throw new Error("Device UUID is required for disabling local mode");
                }
                const command = `balena device local-mode disable ${params.deviceUuid}`;
                return await executeBalenaCommand(command);
            },

            move: async (params) =>
            {
                if (!params.deviceUuid || !params.targetFleet)
                {
                    throw new Error("Device UUID and target fleet are required for move operation");
                }
                const command = `balena device move ${params.deviceUuid} --fleet ${params.targetFleet}`;
                return await executeBalenaCommand(command);
            },

            rename: async (params) =>
            {
                if (!params.deviceUuid || !params.newName)
                {
                    throw new Error("Device UUID and new name are required for rename operation");
                }
                const command = `balena device rename ${params.deviceUuid} ${params.newName}`;
                return await executeBalenaCommand(command);
            },

            blink: async (params) =>
            {
                if (!params.deviceUuid)
                {
                    throw new Error("Device UUID is required for blink operation");
                }
                const command = `balena device identify ${params.deviceUuid}`;
                return await executeBalenaCommand(command);
            },

            ping: async (params) =>
            {
                if (!params.deviceUuid)
                {
                    throw new Error("Device UUID is required for ping operation");
                }
                const command = `balena device ${params.deviceUuid} --json`;
                const result = await executeBalenaCommand(command);
                // Parse the result to check if device is online
                try
                {
                    const deviceInfo = JSON.parse(result);
                    return {
                        uuid: deviceInfo.uuid,
                        isOnline: deviceInfo.is_online,
                        lastSeen: deviceInfo.last_connectivity_event,
                        status: deviceInfo.is_online ? 'online' : 'offline'
                    };
                } catch (e)
                {
                    throw new Error("Failed to parse device information");
                }
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
                    fleetName: inputData?.fleetName || node.fleetName || msg.fleetName,
                    targetFleet: inputData?.targetFleet || msg.targetFleet,
                    newName: inputData?.newName || msg.newName,
                    tail: inputData?.tail || msg.tail,
                    since: inputData?.since || msg.since
                };

                // Determine operation from config or message
                const operation = inputData?.operation || msg.operation || node.operation;

                // Check cache for read operations
                const readOperations = ['list', 'info', 'logs'];
                const cacheKey = generateCacheKey(operation, params.deviceUuid, params);

                if (cache && readOperations.includes(operation))
                {
                    const cachedResult = cache.get(cacheKey);
                    if (cachedResult)
                    {
                        updateStatus("Cached", "green");
                        msg.payload = cachedResult;
                        send(msg);
                        done();
                        return;
                    }
                }

                // Execute operation
                if (!deviceOperations[operation])
                {
                    throw new Error(`Unknown operation: ${operation}`);
                }

                const result = await deviceOperations[operation](params);

                // Cache result for read operations
                if (cache && readOperations.includes(operation))
                {
                    cache.set(cacheKey, result);
                }

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

        // Clean up on close
        node.on('close', function ()
        {
            if (cache)
            {
                cache.flushAll();
            }
        });

        // Initial status
        updateStatus("Ready");
    }

    RED.nodes.registerType("balena-device", BalenaDeviceNode);
}; 

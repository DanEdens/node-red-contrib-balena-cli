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
        node.name = config.name;
        node.operation = config.operation || "list";
        node.deviceUuid = config.deviceUuid || "";
        node.fleetName = config.fleetName || "";
        node.field = config.field || "payload";
        node.fieldType = config.fieldType || "msg";
        node.enableCaching = config.enableCaching !== false;
        node.cacheDuration = parseInt(config.cacheDuration) || 300; // 5 minutes default
        node.timeout = parseInt(config.timeout) || 30000;
        node.outputFormat = config.outputFormat || "json";

        // Get credentials configuration
        node.credentials = RED.nodes.getNode(config.credentials);

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

        // Execute Balena CLI command with authentication
        function executeBalenaCommand(command, options = {})
        {
            return new Promise((resolve, reject) =>
            {
                const timeoutId = setTimeout(() =>
                {
                    reject(new Error(`Command timed out after ${node.timeout}ms`));
                }, node.timeout);

                // Prepare execution options with authentication
                const execOptions = {
                    ...options,
                    env: node.credentials ? node.credentials.getAuthEnv() : process.env
                };

                // Use credentials node's executeCommand if available, otherwise use direct exec
                if (node.credentials && typeof node.credentials.executeCommand === 'function')
                {
                    node.credentials.executeCommand(command, execOptions, (error, stdout, stderr) =>
                    {
                        clearTimeout(timeoutId);
                        handleCommandResult(error, stdout, stderr, resolve, reject);
                    });
                } else
                {
                    exec(command, execOptions, (error, stdout, stderr) =>
                    {
                        clearTimeout(timeoutId);
                        handleCommandResult(error, stdout, stderr, resolve, reject);
                    });
                }
            });
        }

        function handleCommandResult(error, stdout, stderr, resolve, reject)
        {
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

            enable_local_mode: async (params) =>
            {
                if (!params.deviceUuid)
                {
                    throw new Error("Device UUID is required for enable local mode operation");
                }
                const command = `balena device local-mode ${params.deviceUuid} --enable`;
                return await executeBalenaCommand(command);
            },

            disable_local_mode: async (params) =>
            {
                if (!params.deviceUuid)
                {
                    throw new Error("Device UUID is required for disable local mode operation");
                }
                const command = `balena device local-mode ${params.deviceUuid} --disable`;
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

            move: async (params) =>
            {
                if (!params.deviceUuid || !params.fleetName)
                {
                    throw new Error("Device UUID and fleet name are required for move operation");
                }
                const command = `balena device move ${params.deviceUuid} ${params.fleetName}`;
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
            }
        };

        // Main message handler
        node.on('input', async function (msg, send, done)
        {
            send = send || function () { node.send.apply(node, arguments); };

            try
            {
                updateStatus("Processing...", "blue");

                // Check credentials
                if (!node.credentials)
                {
                    throw new Error("Balena credentials configuration is required");
                }

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
        updateStatus(node.credentials ? "Ready" : "No credentials");
    }

    RED.nodes.registerType("balena-device", BalenaDeviceNode);
}; 

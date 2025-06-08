module.exports = function (RED)
{
    "use strict";

    const { exec, spawn } = require('child_process');
    const NodeCache = require('node-cache');

    function BalenaFleetNode(config)
    {
        RED.nodes.createNode(this, config);
        const node = this;

        // Configuration
        node.operation = config.operation || "list";
        node.fleetName = config.fleetName || "";
        node.organization = config.organization || "";
        node.deviceType = config.deviceType || "";
        node.field = config.field || "payload";
        node.fieldType = config.fieldType || "msg";
        node.enableCaching = config.enableCaching !== false;
        node.cacheDuration = parseInt(config.cacheDuration) || 600; // 10 minutes default
        node.timeout = parseInt(config.timeout) || 30000;
        node.outputFormat = config.outputFormat || "json";

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
        function generateCacheKey(operation, fleetName, additionalParams = {})
        {
            const keyData = { operation, fleetName, ...additionalParams };
            return `fleet_${JSON.stringify(keyData)}`;
        }

        // Execute Balena CLI command
        function executeBalenaCommand(command, options = {})
        {
            return new Promise((resolve, reject) =>
            {
                const timeoutId = setTimeout(() =>
                {
                    reject(new Error(`Command timed out after ${node.timeout}ms`));
                }, node.timeout);

                exec(command, options, (error, stdout, stderr) =>
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
            });
        }

        // Fleet operations
        const fleetOperations = {
            list: async (params) =>
            {
                let command = "balena fleets";
                if (params.organization)
                {
                    command += ` --organization ${params.organization}`;
                }
                if (node.outputFormat === "json")
                {
                    command += " --json";
                }
                return await executeBalenaCommand(command);
            },

            info: async (params) =>
            {
                if (!params.fleetName)
                {
                    throw new Error("Fleet name is required for info operation");
                }
                let command = `balena fleet ${params.fleetName}`;
                if (node.outputFormat === "json")
                {
                    command += " --json";
                }
                return await executeBalenaCommand(command);
            },

            create: async (params) =>
            {
                if (!params.fleetName || !params.deviceType)
                {
                    throw new Error("Fleet name and device type are required for create operation");
                }
                let command = `balena fleet create ${params.fleetName} --type ${params.deviceType}`;
                if (params.organization)
                {
                    command += ` --organization ${params.organization}`;
                }
                return await executeBalenaCommand(command);
            },

            delete: async (params) =>
            {
                if (!params.fleetName)
                {
                    throw new Error("Fleet name is required for delete operation");
                }
                const command = `balena fleet rm ${params.fleetName} --yes`;
                return await executeBalenaCommand(command);
            },

            rename: async (params) =>
            {
                if (!params.fleetName || !params.newName)
                {
                    throw new Error("Fleet name and new name are required for rename operation");
                }
                const command = `balena fleet rename ${params.fleetName} ${params.newName}`;
                return await executeBalenaCommand(command);
            },

            releases: async (params) =>
            {
                if (!params.fleetName)
                {
                    throw new Error("Fleet name is required for releases operation");
                }
                let command = `balena releases ${params.fleetName}`;
                if (node.outputFormat === "json")
                {
                    command += " --json";
                }
                return await executeBalenaCommand(command);
            },

            pin_release: async (params) =>
            {
                if (!params.fleetName || !params.releaseId)
                {
                    throw new Error("Fleet name and release ID are required for pin release operation");
                }
                const command = `balena fleet pin ${params.fleetName} ${params.releaseId}`;
                return await executeBalenaCommand(command);
            },

            track_latest: async (params) =>
            {
                if (!params.fleetName)
                {
                    throw new Error("Fleet name is required for track latest operation");
                }
                const command = `balena fleet track-latest ${params.fleetName}`;
                return await executeBalenaCommand(command);
            },

            restart: async (params) =>
            {
                if (!params.fleetName)
                {
                    throw new Error("Fleet name is required for restart operation");
                }
                const command = `balena fleet restart ${params.fleetName}`;
                return await executeBalenaCommand(command);
            },

            purge: async (params) =>
            {
                if (!params.fleetName)
                {
                    throw new Error("Fleet name is required for purge operation");
                }
                const command = `balena fleet purge ${params.fleetName} --yes`;
                return await executeBalenaCommand(command);
            },

            devices: async (params) =>
            {
                if (!params.fleetName)
                {
                    throw new Error("Fleet name is required for devices operation");
                }
                let command = `balena devices --fleet ${params.fleetName}`;
                if (node.outputFormat === "json")
                {
                    command += " --json";
                }
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
                    fleetName: inputData?.fleetName || node.fleetName || msg.fleetName,
                    organization: inputData?.organization || node.organization || msg.organization,
                    deviceType: inputData?.deviceType || node.deviceType || msg.deviceType,
                    newName: inputData?.newName || msg.newName,
                    releaseId: inputData?.releaseId || msg.releaseId
                };

                // Determine operation from config or message
                const operation = inputData?.operation || msg.operation || node.operation;

                // Check cache for read operations
                const readOperations = ['list', 'info', 'releases', 'devices'];
                const cacheKey = generateCacheKey(operation, params.fleetName, params);

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
                if (!fleetOperations[operation])
                {
                    throw new Error(`Unknown operation: ${operation}`);
                }

                const result = await fleetOperations[operation](params);

                // Cache result for read operations
                if (cache && readOperations.includes(operation))
                {
                    cache.set(cacheKey, result);
                }

                // Send result
                msg.payload = result;
                msg.operation = operation;
                msg.fleetName = params.fleetName;

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

    RED.nodes.registerType("balena-fleet", BalenaFleetNode);
}; 

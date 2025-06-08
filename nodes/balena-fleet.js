module.exports = function (RED)
{
    "use strict";

    const { spawn } = require('child_process');
    const NodeCache = require('node-cache');

    function BalenaFleetNode(config)
    {
        RED.nodes.createNode(this, config);
        const node = this;

        // Configuration
        node.name = config.name;
        node.operation = config.operation || "list";
        node.fleetName = config.fleetName || "";
        node.organization = config.organization || "";
        node.deviceType = config.deviceType || "";
        node.timeout = parseInt(config.timeout) || 30000;
        node.enableCaching = config.enableCaching !== false;
        node.cacheDuration = parseInt(config.cacheDuration) || 600; // 10 minutes default
        node.outputFormat = config.outputFormat || "json";

        // Initialize cache
        const cache = node.enableCaching ? new NodeCache({
            stdTTL: node.cacheDuration,
            checkperiod: Math.max(60, node.cacheDuration / 10)
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

        // Execute Balena CLI command
        function executeBalenaCommand(command, args = [], options = {})
        {
            return new Promise((resolve, reject) =>
            {
                updateStatus("executing", "blue");

                const balena = spawn('balena', [command, ...args], {
                    timeout: node.timeout,
                    ...options
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
                        reject(new Error(`Balena CLI command failed with exit code ${code}: ${stderr}`));
                    }
                });

                balena.on('error', (error) =>
                {
                    updateStatus("error", "red");
                    reject(new Error(`Failed to execute balena command: ${error.message}`));
                });
            });
        }

        // Parse JSON output safely
        function parseJsonOutput(output)
        {
            try
            {
                return JSON.parse(output);
            } catch (error)
            {
                node.warn(`Failed to parse JSON output: ${error.message}`);
                return { raw: output, parseError: error.message };
            }
        }

        // Generate cache key
        function generateCacheKey(operation, params)
        {
            return `fleet_${operation}_${JSON.stringify(params)}`;
        }

        // Fleet operations
        const fleetOperations = {
            list: async (params = {}) =>
            {
                const args = ['fleets'];
                if (node.outputFormat === 'json') args.push('--json');
                if (params.organization) args.push('--organization', params.organization);

                const result = await executeBalenaCommand('fleets', args.slice(1));
                return node.outputFormat === 'json' ? parseJsonOutput(result.stdout) : result.stdout;
            },

            info: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                if (!fleetName) throw new Error('Fleet name is required for info operation');

                const args = ['fleet', fleetName];
                if (node.outputFormat === 'json') args.push('--json');

                const result = await executeBalenaCommand('fleet', args.slice(1));
                return node.outputFormat === 'json' ? parseJsonOutput(result.stdout) : result.stdout;
            },

            create: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                const deviceType = params.deviceType || node.deviceType;
                const organization = params.organization || node.organization;

                if (!fleetName || !deviceType)
                {
                    throw new Error('Fleet name and device type are required for create operation');
                }

                const args = ['fleet', 'create', fleetName, '--type', deviceType];
                if (organization) args.push('--organization', organization);

                const result = await executeBalenaCommand('fleet', args.slice(1));
                return {
                    success: true,
                    message: `Fleet ${fleetName} created successfully`,
                    output: result.stdout
                };
            },

            delete: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                if (!fleetName) throw new Error('Fleet name is required for delete operation');

                const args = ['fleet', 'rm', fleetName, '--yes'];

                const result = await executeBalenaCommand('fleet', args.slice(1));
                return {
                    success: true,
                    message: `Fleet ${fleetName} deleted successfully`,
                    output: result.stdout
                };
            },

            rename: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                const newName = params.newName;
                if (!fleetName || !newName)
                {
                    throw new Error('Fleet name and new name are required for rename operation');
                }

                const args = ['fleet', 'rename', fleetName, newName];

                const result = await executeBalenaCommand('fleet', args.slice(1));
                return {
                    success: true,
                    message: `Fleet renamed from ${fleetName} to ${newName}`,
                    output: result.stdout
                };
            },

            releases: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                if (!fleetName) throw new Error('Fleet name is required for releases operation');

                const args = ['releases', fleetName];
                if (node.outputFormat === 'json') args.push('--json');

                const result = await executeBalenaCommand('releases', args.slice(1));
                return node.outputFormat === 'json' ? parseJsonOutput(result.stdout) : result.stdout;
            },

            pin_release: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                const releaseId = params.releaseId;
                if (!fleetName || !releaseId)
                {
                    throw new Error('Fleet name and release ID are required for pin release operation');
                }

                const args = ['fleet', 'pin', fleetName, releaseId];

                const result = await executeBalenaCommand('fleet', args.slice(1));
                return {
                    success: true,
                    message: `Release ${releaseId} pinned to fleet ${fleetName}`,
                    output: result.stdout
                };
            },

            track_latest: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                if (!fleetName) throw new Error('Fleet name is required for track latest operation');

                const args = ['fleet', 'track-latest', fleetName];

                const result = await executeBalenaCommand('fleet', args.slice(1));
                return {
                    success: true,
                    message: `Fleet ${fleetName} now tracking latest release`,
                    output: result.stdout
                };
            },

            config: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                if (!fleetName) throw new Error('Fleet name is required for config operation');

                const args = ['config', 'generate', '--fleet', fleetName];
                if (params.output) args.push('--output', params.output);
                if (params.version) args.push('--version', params.version);
                if (params.deviceApiKey) args.push('--device-api-key', params.deviceApiKey);
                if (params.deviceType) args.push('--device-type', params.deviceType);

                const result = await executeBalenaCommand('config', args.slice(1));
                return {
                    success: true,
                    message: `Configuration generated for fleet ${fleetName}`,
                    output: result.stdout
                };
            },

            restart: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                if (!fleetName) throw new Error('Fleet name is required for restart operation');

                const args = ['fleet', 'restart', fleetName];

                const result = await executeBalenaCommand('fleet', args.slice(1));
                return {
                    success: true,
                    message: `Restart initiated for all devices in fleet ${fleetName}`,
                    output: result.stdout
                };
            },

            purge: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                if (!fleetName) throw new Error('Fleet name is required for purge operation');

                const args = ['fleet', 'purge', fleetName, '--yes'];

                const result = await executeBalenaCommand('fleet', args.slice(1));
                return {
                    success: true,
                    message: `Data purged for all devices in fleet ${fleetName}`,
                    output: result.stdout
                };
            },

            devices: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                if (!fleetName) throw new Error('Fleet name is required for devices operation');

                const args = ['devices', '--fleet', fleetName];
                if (node.outputFormat === 'json') args.push('--json');

                const result = await executeBalenaCommand('devices', args.slice(1));
                return node.outputFormat === 'json' ? parseJsonOutput(result.stdout) : result.stdout;
            },

            tags: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                if (!fleetName) throw new Error('Fleet name is required for tags operation');

                const args = ['tags', '--fleet', fleetName];
                if (node.outputFormat === 'json') args.push('--json');

                const result = await executeBalenaCommand('tags', args.slice(1));
                return node.outputFormat === 'json' ? parseJsonOutput(result.stdout) : result.stdout;
            },

            set_tag: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                const tagKey = params.tagKey;
                const tagValue = params.tagValue;
                if (!fleetName || !tagKey)
                {
                    throw new Error('Fleet name and tag key are required for set tag operation');
                }

                const args = ['tag', 'set', tagKey, tagValue || '', '--fleet', fleetName];

                const result = await executeBalenaCommand('tag', args.slice(1));
                return {
                    success: true,
                    message: `Tag ${tagKey} set for fleet ${fleetName}`,
                    output: result.stdout
                };
            },

            remove_tag: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                const tagKey = params.tagKey;
                if (!fleetName || !tagKey)
                {
                    throw new Error('Fleet name and tag key are required for remove tag operation');
                }

                const args = ['tag', 'rm', tagKey, '--fleet', fleetName, '--yes'];

                const result = await executeBalenaCommand('tag', args.slice(1));
                return {
                    success: true,
                    message: `Tag ${tagKey} removed from fleet ${fleetName}`,
                    output: result.stdout
                };
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
                    fleetName: msg.fleetName || node.fleetName,
                    organization: msg.organization || node.organization,
                    deviceType: msg.deviceType || node.deviceType,
                    newName: msg.newName,
                    releaseId: msg.releaseId,
                    output: msg.output,
                    version: msg.version,
                    deviceApiKey: msg.deviceApiKey,
                    tagKey: msg.tagKey,
                    tagValue: msg.tagValue,
                    ...msg.params
                };

                // Check cache first
                let result;
                const cacheKey = generateCacheKey(operation, params);

                if (cache && ['list', 'info', 'releases', 'devices', 'tags'].includes(operation))
                {
                    result = cache.get(cacheKey);
                    if (result)
                    {
                        updateStatus("cached", "green");
                        msg.payload = result;
                        msg.cached = true;
                        send(msg);
                        done();
                        return;
                    }
                }

                // Execute operation
                if (!fleetOperations[operation])
                {
                    throw new Error(`Unknown fleet operation: ${operation}`);
                }

                updateStatus(`executing ${operation}`, "blue");
                result = await fleetOperations[operation](params);

                // Cache read operations
                if (cache && ['list', 'info', 'releases', 'devices', 'tags'].includes(operation))
                {
                    cache.set(cacheKey, result);
                }

                // Send result
                msg.payload = result;
                msg.operation = operation;
                msg.cached = false;
                updateStatus("ready", "green");
                send(msg);
                done();

            } catch (error)
            {
                updateStatus("error", "red");
                node.error(`Balena fleet operation failed: ${error.message}`, msg);
                done(error);
            }
        });

        // Clean up
        node.on('close', function ()
        {
            if (cache)
            {
                cache.flushAll();
            }
        });

        updateStatus("ready");
    }

    RED.nodes.registerType("balena-fleet", BalenaFleetNode);
}; 

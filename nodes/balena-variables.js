module.exports = function (RED)
{
    "use strict";

    const { spawn } = require('child_process');
    const NodeCache = require('node-cache');

    function BalenaVariablesNode(config)
    {
        RED.nodes.createNode(this, config);
        const node = this;

        // Configuration
        node.name = config.name;
        node.operation = config.operation || "list";
        node.scope = config.scope || "fleet"; // 'fleet' or 'device'
        node.target = config.target || ""; // fleet name or device uuid
        node.variableName = config.variableName || "";
        node.variableValue = config.variableValue || "";
        node.timeout = parseInt(config.timeout) || 30000;
        node.enableCaching = config.enableCaching !== false;
        node.cacheDuration = parseInt(config.cacheDuration) || 300; // 5 minutes default
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
            return `vars_${operation}_${JSON.stringify(params)}`;
        }

        // Variable operations
        const variableOperations = {
            list: async (params = {}) =>
            {
                const scope = params.scope || node.scope;
                const target = params.target || node.target;

                if (!target) throw new Error(`${scope === 'fleet' ? 'Fleet name' : 'Device UUID'} is required for list operation`);

                const args = ['envs'];
                if (scope === 'fleet')
                {
                    args.push('--fleet', target);
                } else
                {
                    args.push('--device', target);
                }
                if (node.outputFormat === 'json') args.push('--json');

                const result = await executeBalenaCommand('envs', args.slice(1));
                return node.outputFormat === 'json' ? parseJsonOutput(result.stdout) : result.stdout;
            },

            get: async (params = {}) =>
            {
                const scope = params.scope || node.scope;
                const target = params.target || node.target;
                const variableName = params.variableName || node.variableName;

                if (!target || !variableName)
                {
                    throw new Error(`${scope === 'fleet' ? 'Fleet name' : 'Device UUID'} and variable name are required for get operation`);
                }

                const args = ['env'];
                if (scope === 'fleet')
                {
                    args.push('--fleet', target, variableName);
                } else
                {
                    args.push('--device', target, variableName);
                }

                const result = await executeBalenaCommand('env', args.slice(1));
                return {
                    variableName: variableName,
                    value: result.stdout,
                    scope: scope,
                    target: target
                };
            },

            set: async (params = {}) =>
            {
                const scope = params.scope || node.scope;
                const target = params.target || node.target;
                const variableName = params.variableName || node.variableName;
                const variableValue = params.variableValue !== undefined ? params.variableValue : node.variableValue;

                if (!target || !variableName)
                {
                    throw new Error(`${scope === 'fleet' ? 'Fleet name' : 'Device UUID'} and variable name are required for set operation`);
                }

                const args = ['env', 'add'];
                if (scope === 'fleet')
                {
                    args.push('--fleet', target, variableName, variableValue || '');
                } else
                {
                    args.push('--device', target, variableName, variableValue || '');
                }

                const result = await executeBalenaCommand('env', args.slice(1));
                return {
                    success: true,
                    message: `Variable ${variableName} set for ${scope} ${target}`,
                    variableName: variableName,
                    value: variableValue,
                    scope: scope,
                    target: target,
                    output: result.stdout
                };
            },

            remove: async (params = {}) =>
            {
                const scope = params.scope || node.scope;
                const target = params.target || node.target;
                const variableName = params.variableName || node.variableName;

                if (!target || !variableName)
                {
                    throw new Error(`${scope === 'fleet' ? 'Fleet name' : 'Device UUID'} and variable name are required for remove operation`);
                }

                const args = ['env', 'rm'];
                if (scope === 'fleet')
                {
                    args.push('--fleet', target, variableName, '--yes');
                } else
                {
                    args.push('--device', target, variableName, '--yes');
                }

                const result = await executeBalenaCommand('env', args.slice(1));
                return {
                    success: true,
                    message: `Variable ${variableName} removed from ${scope} ${target}`,
                    variableName: variableName,
                    scope: scope,
                    target: target,
                    output: result.stdout
                };
            },

            rename: async (params = {}) =>
            {
                const scope = params.scope || node.scope;
                const target = params.target || node.target;
                const oldName = params.variableName || node.variableName;
                const newName = params.newName;

                if (!target || !oldName || !newName)
                {
                    throw new Error(`${scope === 'fleet' ? 'Fleet name' : 'Device UUID'}, old name, and new name are required for rename operation`);
                }

                const args = ['env', 'rename'];
                if (scope === 'fleet')
                {
                    args.push('--fleet', target, oldName, newName);
                } else
                {
                    args.push('--device', target, oldName, newName);
                }

                const result = await executeBalenaCommand('env', args.slice(1));
                return {
                    success: true,
                    message: `Variable renamed from ${oldName} to ${newName} for ${scope} ${target}`,
                    oldName: oldName,
                    newName: newName,
                    scope: scope,
                    target: target,
                    output: result.stdout
                };
            },

            config_vars: async (params = {}) =>
            {
                const scope = params.scope || node.scope;
                const target = params.target || node.target;

                if (!target) throw new Error(`${scope === 'fleet' ? 'Fleet name' : 'Device UUID'} is required for config vars operation`);

                const args = ['config', 'vars'];
                if (scope === 'fleet')
                {
                    args.push('--fleet', target);
                } else
                {
                    args.push('--device', target);
                }
                if (node.outputFormat === 'json') args.push('--json');

                const result = await executeBalenaCommand('config', args.slice(1));
                return node.outputFormat === 'json' ? parseJsonOutput(result.stdout) : result.stdout;
            },

            set_config_var: async (params = {}) =>
            {
                const scope = params.scope || node.scope;
                const target = params.target || node.target;
                const variableName = params.variableName || node.variableName;
                const variableValue = params.variableValue !== undefined ? params.variableValue : node.variableValue;

                if (!target || !variableName)
                {
                    throw new Error(`${scope === 'fleet' ? 'Fleet name' : 'Device UUID'} and variable name are required for set config var operation`);
                }

                const args = ['config', 'write'];
                if (scope === 'fleet')
                {
                    args.push('--fleet', target, variableName, variableValue || '');
                } else
                {
                    args.push('--device', target, variableName, variableValue || '');
                }

                const result = await executeBalenaCommand('config', args.slice(1));
                return {
                    success: true,
                    message: `Config variable ${variableName} set for ${scope} ${target}`,
                    variableName: variableName,
                    value: variableValue,
                    scope: scope,
                    target: target,
                    type: 'config',
                    output: result.stdout
                };
            },

            batch_set: async (params = {}) =>
            {
                const scope = params.scope || node.scope;
                const target = params.target || node.target;
                const variables = params.variables || {};

                if (!target || !variables || Object.keys(variables).length === 0)
                {
                    throw new Error(`${scope === 'fleet' ? 'Fleet name' : 'Device UUID'} and variables object are required for batch set operation`);
                }

                const results = [];
                for (const [name, value] of Object.entries(variables))
                {
                    try
                    {
                        const result = await variableOperations.set({
                            scope: scope,
                            target: target,
                            variableName: name,
                            variableValue: value
                        });
                        results.push(result);
                    } catch (error)
                    {
                        results.push({
                            success: false,
                            variableName: name,
                            error: error.message
                        });
                    }
                }

                return {
                    success: true,
                    message: `Batch set completed for ${scope} ${target}`,
                    results: results,
                    scope: scope,
                    target: target
                };
            },

            bulk_remove: async (params = {}) =>
            {
                const scope = params.scope || node.scope;
                const target = params.target || node.target;
                const variableNames = params.variableNames || [];

                if (!target || !Array.isArray(variableNames) || variableNames.length === 0)
                {
                    throw new Error(`${scope === 'fleet' ? 'Fleet name' : 'Device UUID'} and variable names array are required for bulk remove operation`);
                }

                const results = [];
                for (const name of variableNames)
                {
                    try
                    {
                        const result = await variableOperations.remove({
                            scope: scope,
                            target: target,
                            variableName: name
                        });
                        results.push(result);
                    } catch (error)
                    {
                        results.push({
                            success: false,
                            variableName: name,
                            error: error.message
                        });
                    }
                }

                return {
                    success: true,
                    message: `Bulk remove completed for ${scope} ${target}`,
                    results: results,
                    scope: scope,
                    target: target
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
                    scope: msg.scope || node.scope,
                    target: msg.target || node.target,
                    variableName: msg.variableName || node.variableName,
                    variableValue: msg.variableValue !== undefined ? msg.variableValue : node.variableValue,
                    newName: msg.newName,
                    variables: msg.variables,
                    variableNames: msg.variableNames,
                    ...msg.params
                };

                // Check cache first for read operations
                let result;
                const cacheKey = generateCacheKey(operation, params);

                if (cache && ['list', 'get', 'config_vars'].includes(operation))
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
                if (!variableOperations[operation])
                {
                    throw new Error(`Unknown variable operation: ${operation}`);
                }

                updateStatus(`executing ${operation}`, "blue");
                result = await variableOperations[operation](params);

                // Cache read operations
                if (cache && ['list', 'get', 'config_vars'].includes(operation))
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
                node.error(`Balena variables operation failed: ${error.message}`, msg);
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

    RED.nodes.registerType("balena-variables", BalenaVariablesNode);
}; 

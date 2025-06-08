module.exports = function (RED)
{
    "use strict";

    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    function BalenaDeployNode(config)
    {
        RED.nodes.createNode(this, config);
        const node = this;

        // Configuration
        node.name = config.name;
        node.operation = config.operation || "push";
        node.fleetName = config.fleetName || "";
        node.sourceDirectory = config.sourceDirectory || "";
        node.dockerfile = config.dockerfile || "";
        node.nocache = config.nocache || false;
        node.emulated = config.emulated || false;
        node.detached = config.detached || false;
        node.timeout = parseInt(config.timeout) || 1800000; // 30 minutes default for builds
        node.outputFormat = config.outputFormat || "text";

        // Status tracking
        function updateStatus(text, color = "grey")
        {
            node.status({
                fill: color,
                shape: "dot",
                text: text
            });
        }

        // Execute Balena CLI command with streaming output
        function executeBalenaCommand(command, args = [], options = {})
        {
            return new Promise((resolve, reject) =>
            {
                updateStatus("executing", "blue");

                const balena = spawn('balena', [command, ...args], {
                    timeout: node.timeout,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    ...options
                });

                let stdout = '';
                let stderr = '';
                let lastStatus = '';

                balena.stdout.on('data', (data) =>
                {
                    const output = data.toString();
                    stdout += output;

                    // Update status based on output for long-running operations
                    if (output.includes('Building'))
                    {
                        lastStatus = 'building';
                        updateStatus("building", "blue");
                    } else if (output.includes('Pushing'))
                    {
                        lastStatus = 'pushing';
                        updateStatus("pushing", "yellow");
                    } else if (output.includes('Uploading'))
                    {
                        lastStatus = 'uploading';
                        updateStatus("uploading", "yellow");
                    } else if (output.includes('Release'))
                    {
                        lastStatus = 'releasing';
                        updateStatus("releasing", "blue");
                    }
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
                            exitCode: code,
                            lastStatus: lastStatus
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

        // Extract build information from output
        function extractBuildInfo(output)
        {
            const buildInfo = {
                releaseId: null,
                buildId: null,
                imageSize: null,
                serviceName: null
            };

            // Try to extract release ID
            const releaseMatch = output.match(/Release:\s+([a-f0-9]+)/i);
            if (releaseMatch)
            {
                buildInfo.releaseId = releaseMatch[1];
            }

            // Try to extract build ID
            const buildMatch = output.match(/Build:\s+([a-f0-9]+)/i);
            if (buildMatch)
            {
                buildInfo.buildId = buildMatch[1];
            }

            // Try to extract image size
            const sizeMatch = output.match(/(\d+(?:\.\d+)?)\s*(MB|GB)/i);
            if (sizeMatch)
            {
                buildInfo.imageSize = `${sizeMatch[1]} ${sizeMatch[2]}`;
            }

            // Try to extract service name
            const serviceMatch = output.match(/service\s+['"]?([^'"]+)['"]?/i);
            if (serviceMatch)
            {
                buildInfo.serviceName = serviceMatch[1];
            }

            return buildInfo;
        }

        // Deployment operations
        const deployOperations = {
            push: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                const sourceDirectory = params.sourceDirectory || node.sourceDirectory || process.cwd();

                if (!fleetName) throw new Error('Fleet name is required for push operation');

                // Verify source directory exists
                if (!fs.existsSync(sourceDirectory))
                {
                    throw new Error(`Source directory does not exist: ${sourceDirectory}`);
                }

                const args = ['push', fleetName];
                if (params.dockerfile || node.dockerfile)
                {
                    args.push('--dockerfile', params.dockerfile || node.dockerfile);
                }
                if (params.nocache || node.nocache)
                {
                    args.push('--nocache');
                }
                if (params.emulated || node.emulated)
                {
                    args.push('--emulated');
                }
                if (params.detached || node.detached)
                {
                    args.push('--detached');
                }

                const options = {
                    cwd: sourceDirectory
                };

                const result = await executeBalenaCommand('push', args.slice(1), options);
                const buildInfo = extractBuildInfo(result.stdout);

                return {
                    success: true,
                    message: `Code pushed to fleet ${fleetName}`,
                    fleetName: fleetName,
                    sourceDirectory: sourceDirectory,
                    buildInfo: buildInfo,
                    output: result.stdout
                };
            },

            build: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                const sourceDirectory = params.sourceDirectory || node.sourceDirectory || process.cwd();
                const deviceType = params.deviceType;

                if (!fleetName) throw new Error('Fleet name is required for build operation');

                const args = ['build', fleetName];
                if (deviceType)
                {
                    args.push('--deviceType', deviceType);
                }
                if (params.dockerfile || node.dockerfile)
                {
                    args.push('--dockerfile', params.dockerfile || node.dockerfile);
                }
                if (params.nocache || node.nocache)
                {
                    args.push('--nocache');
                }
                if (params.emulated || node.emulated)
                {
                    args.push('--emulated');
                }

                const options = {
                    cwd: sourceDirectory
                };

                const result = await executeBalenaCommand('build', args.slice(1), options);
                const buildInfo = extractBuildInfo(result.stdout);

                return {
                    success: true,
                    message: `Local build completed for fleet ${fleetName}`,
                    fleetName: fleetName,
                    sourceDirectory: sourceDirectory,
                    buildInfo: buildInfo,
                    output: result.stdout
                };
            },

            deploy: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                const sourceDirectory = params.sourceDirectory || node.sourceDirectory || process.cwd();
                const imageTag = params.imageTag;

                if (!fleetName || !imageTag)
                {
                    throw new Error('Fleet name and image tag are required for deploy operation');
                }

                const args = ['deploy', fleetName, imageTag];

                const options = {
                    cwd: sourceDirectory
                };

                const result = await executeBalenaCommand('deploy', args.slice(1), options);
                const buildInfo = extractBuildInfo(result.stdout);

                return {
                    success: true,
                    message: `Image ${imageTag} deployed to fleet ${fleetName}`,
                    fleetName: fleetName,
                    imageTag: imageTag,
                    buildInfo: buildInfo,
                    output: result.stdout
                };
            },

            preload: async (params = {}) =>
            {
                const fleetName = params.fleetName || node.fleetName;
                const imagePath = params.imagePath;
                const deviceType = params.deviceType;

                if (!fleetName || !imagePath)
                {
                    throw new Error('Fleet name and image path are required for preload operation');
                }

                const args = ['preload', imagePath, '--fleet', fleetName];
                if (deviceType)
                {
                    args.push('--device-type', deviceType);
                }
                if (params.commit)
                {
                    args.push('--commit', params.commit);
                }

                const result = await executeBalenaCommand('preload', args.slice(1));

                return {
                    success: true,
                    message: `Image preloaded for fleet ${fleetName}`,
                    fleetName: fleetName,
                    imagePath: imagePath,
                    output: result.stdout
                };
            },

            release_finalize: async (params = {}) =>
            {
                const releaseId = params.releaseId;

                if (!releaseId) throw new Error('Release ID is required for finalize operation');

                const args = ['release', 'finalize', releaseId];

                const result = await executeBalenaCommand('release', args.slice(1));

                return {
                    success: true,
                    message: `Release ${releaseId} finalized`,
                    releaseId: releaseId,
                    output: result.stdout
                };
            },

            release_invalidate: async (params = {}) =>
            {
                const releaseId = params.releaseId;

                if (!releaseId) throw new Error('Release ID is required for invalidate operation');

                const args = ['release', 'invalidate', releaseId];

                const result = await executeBalenaCommand('release', args.slice(1));

                return {
                    success: true,
                    message: `Release ${releaseId} invalidated`,
                    releaseId: releaseId,
                    output: result.stdout
                };
            },

            join: async (params = {}) =>
            {
                const deviceUuid = params.deviceUuid;
                const fleetName = params.fleetName || node.fleetName;

                if (!deviceUuid || !fleetName)
                {
                    throw new Error('Device UUID and fleet name are required for join operation');
                }

                const args = ['device', 'move', deviceUuid, fleetName];

                const result = await executeBalenaCommand('device', args.slice(1));

                return {
                    success: true,
                    message: `Device ${deviceUuid} joined fleet ${fleetName}`,
                    deviceUuid: deviceUuid,
                    fleetName: fleetName,
                    output: result.stdout
                };
            },

            leave: async (params = {}) =>
            {
                const deviceUuid = params.deviceUuid;

                if (!deviceUuid) throw new Error('Device UUID is required for leave operation');

                const args = ['device', 'rm', deviceUuid, '--yes'];

                const result = await executeBalenaCommand('device', args.slice(1));

                return {
                    success: true,
                    message: `Device ${deviceUuid} removed from fleet`,
                    deviceUuid: deviceUuid,
                    output: result.stdout
                };
            },

            os_configure: async (params = {}) =>
            {
                const imagePath = params.imagePath;
                const configPath = params.configPath;

                if (!imagePath) throw new Error('Image path is required for OS configure operation');

                const args = ['os', 'configure', imagePath];
                if (configPath)
                {
                    args.push('--config', configPath);
                }
                if (params.fleet)
                {
                    args.push('--fleet', params.fleet);
                }
                if (params.version)
                {
                    args.push('--version', params.version);
                }

                const result = await executeBalenaCommand('os', args.slice(1));

                return {
                    success: true,
                    message: `OS image configured: ${imagePath}`,
                    imagePath: imagePath,
                    configPath: configPath,
                    output: result.stdout
                };
            },

            local_configure: async (params = {}) =>
            {
                const target = params.target;
                const fleetName = params.fleetName || node.fleetName;

                if (!target || !fleetName)
                {
                    throw new Error('Target and fleet name are required for local configure operation');
                }

                const args = ['local', 'configure', target, '--fleet', fleetName];

                const result = await executeBalenaCommand('local', args.slice(1));

                return {
                    success: true,
                    message: `Local device configured for fleet ${fleetName}`,
                    target: target,
                    fleetName: fleetName,
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
                    sourceDirectory: msg.sourceDirectory || node.sourceDirectory,
                    dockerfile: msg.dockerfile || node.dockerfile,
                    nocache: msg.nocache !== undefined ? msg.nocache : node.nocache,
                    emulated: msg.emulated !== undefined ? msg.emulated : node.emulated,
                    detached: msg.detached !== undefined ? msg.detached : node.detached,
                    deviceType: msg.deviceType,
                    imageTag: msg.imageTag,
                    imagePath: msg.imagePath,
                    releaseId: msg.releaseId,
                    deviceUuid: msg.deviceUuid,
                    configPath: msg.configPath,
                    target: msg.target,
                    commit: msg.commit,
                    fleet: msg.fleet,
                    version: msg.version,
                    ...msg.params
                };

                // Execute operation
                if (!deployOperations[operation])
                {
                    throw new Error(`Unknown deployment operation: ${operation}`);
                }

                updateStatus(`executing ${operation}`, "blue");
                const result = await deployOperations[operation](params);

                // Send result
                msg.payload = result;
                msg.operation = operation;
                updateStatus("ready", "green");
                send(msg);
                done();

            } catch (error)
            {
                updateStatus("error", "red");
                node.error(`Balena deployment operation failed: ${error.message}`, msg);
                done(error);
            }
        });

        updateStatus("ready");
    }

    RED.nodes.registerType("balena-deploy", BalenaDeployNode);
}; 

module.exports = function (RED)
{
    "use strict";

    const http = require('http');
    const https = require('https');

    function BalenaSupervisorNode(config)
    {
        RED.nodes.createNode(this, config);
        const node = this;

        // Configuration
        node.operation = config.operation;
        node.serviceId = config.serviceId;
        node.fieldType = config.fieldType || "msg";
        node.field = config.field || "payload";
        node.timeout = parseInt(config.timeout) || 30000;

        // Get balena supervisor address and API key from environment
        const supervisorAddress = process.env.BALENA_SUPERVISOR_ADDRESS;
        const supervisorApiKey = process.env.BALENA_SUPERVISOR_API_KEY;

        function updateStatus(text, color = "grey")
        {
            node.status({ fill: color, shape: "dot", text: text });
        }

        // Check if we're running on a balena device
        if (!supervisorAddress || !supervisorApiKey)
        {
            updateStatus("Not on balena device", "red");
            node.warn("Supervisor environment variables not found. This node only works on balena devices.");
            return;
        }

        updateStatus("Ready", "green");

        function makeRequest(endpoint, method = 'GET', data = null)
        {
            return new Promise((resolve, reject) =>
            {
                const url = new URL(endpoint, supervisorAddress);
                const isHttps = url.protocol === 'https:';
                const httpModule = isHttps ? https : http;

                const options = {
                    hostname: url.hostname,
                    port: url.port,
                    path: url.pathname + url.search,
                    method: method,
                    headers: {
                        'Authorization': `Bearer ${supervisorApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: node.timeout
                };

                const req = httpModule.request(options, (res) =>
                {
                    let body = '';
                    res.on('data', (chunk) =>
                    {
                        body += chunk;
                    });

                    res.on('end', () =>
                    {
                        try
                        {
                            const response = {
                                statusCode: res.statusCode,
                                headers: res.headers,
                                body: body
                            };

                            // Try to parse JSON response
                            if (res.headers['content-type'] && res.headers['content-type'].includes('application/json'))
                            {
                                try
                                {
                                    response.data = JSON.parse(body);
                                } catch (e)
                                {
                                    response.data = body;
                                }
                            } else
                            {
                                response.data = body;
                            }

                            resolve(response);
                        } catch (error)
                        {
                            reject(error);
                        }
                    });
                });

                req.on('error', (error) =>
                {
                    reject(error);
                });

                req.on('timeout', () =>
                {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });

                if (data)
                {
                    req.write(JSON.stringify(data));
                }

                req.end();
            });
        }

        // Supervisor operations
        const supervisorOperations = {
            ping: async () =>
            {
                return await makeRequest('/ping');
            },

            blink: async () =>
            {
                return await makeRequest('/v1/blink', 'POST');
            },

            device: async () =>
            {
                return await makeRequest('/v1/device');
            },

            restart: async (params) =>
            {
                const serviceId = params.serviceId || node.serviceId;
                if (!serviceId)
                {
                    throw new Error("Service ID is required for restart operation");
                }
                return await makeRequest(`/v1/restart?appId=${serviceId}`, 'POST');
            },

            reboot: async () =>
            {
                return await makeRequest('/v1/reboot', 'POST');
            },

            shutdown: async () =>
            {
                return await makeRequest('/v1/shutdown', 'POST');
            },

            purge: async () =>
            {
                return await makeRequest('/v1/purge', 'POST');
            },

            update: async (params) =>
            {
                const force = params.force || false;
                return await makeRequest(`/v1/update?force=${force}`, 'POST');
            },

            lock: async () =>
            {
                return await makeRequest('/v1/update-lock', 'POST');
            },

            unlock: async () =>
            {
                return await makeRequest('/v1/update-unlock', 'POST');
            },

            apps: async () =>
            {
                return await makeRequest('/v2/applications/state');
            },

            logs: async (params) =>
            {
                let endpoint = '/v1/logs';
                const queryParams = [];

                if (params.count)
                {
                    queryParams.push(`count=${params.count}`);
                }
                if (params.since)
                {
                    queryParams.push(`since=${params.since}`);
                }
                if (params.until)
                {
                    queryParams.push(`until=${params.until}`);
                }
                if (params.format)
                {
                    queryParams.push(`format=${params.format}`);
                }

                if (queryParams.length > 0)
                {
                    endpoint += '?' + queryParams.join('&');
                }

                return await makeRequest(endpoint);
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
                    serviceId: inputData?.serviceId || node.serviceId || msg.serviceId,
                    force: inputData?.force || msg.force || false,
                    count: inputData?.count || msg.count,
                    since: inputData?.since || msg.since,
                    until: inputData?.until || msg.until,
                    format: inputData?.format || msg.format
                };

                // Determine operation from config or message
                const operation = inputData?.operation || msg.operation || node.operation;

                // Execute operation
                if (!supervisorOperations[operation])
                {
                    throw new Error(`Unknown operation: ${operation}`);
                }

                const result = await supervisorOperations[operation](params);

                // Send result
                msg.payload = result.data;
                msg.statusCode = result.statusCode;
                msg.headers = result.headers;
                msg.operation = operation;

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
            updateStatus("Disconnected", "red");
        });
    }

    RED.nodes.registerType("balena-supervisor", BalenaSupervisorNode);
}; 

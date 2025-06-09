module.exports = function (RED)
{
    "use strict";

    const { exec } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    function BalenaConfigNode(config)
    {
        RED.nodes.createNode(this, config);
        const node = this;

        // Configuration
        node.name = config.name;
        node.apiUrl = config.apiUrl || 'https://api.balena-cloud.com';
        node.loginMethod = config.loginMethod || 'credentials'; // 'credentials', 'token', 'browser'
        node.autoLogin = config.autoLogin !== false;

        // Status tracking
        node.isLoggedIn = false;
        node.currentUser = null;
        node.lastLoginCheck = null;

        function updateStatus(text, color = "grey")
        {
            node.status({ fill: color, shape: "dot", text: text });
        }

        // Execute Balena CLI command
        function executeBalenaCommand(command, options = {})
        {
            return new Promise((resolve, reject) =>
            {
                exec(command, { timeout: 30000, ...options }, (error, stdout, stderr) =>
                {
                    if (error)
                    {
                        reject(new Error(`Balena CLI error: ${error.message}\nStderr: ${stderr}`));
                        return;
                    }
                    resolve(stdout.trim());
                });
            });
        }

        // Check if already logged in
        async function checkLoginStatus()
        {
            try
            {
                const result = await executeBalenaCommand('balena whoami');
                if (result && result !== 'None')
                {
                    node.isLoggedIn = true;
                    node.currentUser = result;
                    node.lastLoginCheck = new Date();
                    updateStatus(`Logged in: ${result}`, "green");
                    return true;
                }
            } catch (error)
            {
                // Not logged in or CLI not available
            }

            node.isLoggedIn = false;
            node.currentUser = null;
            updateStatus("Not logged in", "red");
            return false;
        }

        // Login with credentials
        async function loginWithCredentials()
        {
            const credentials = node.credentials;
            if (!credentials || !credentials.email || !credentials.password)
            {
                throw new Error("Email and password are required for credential login");
            }

            try
            {
                updateStatus("Logging in...", "blue");

                // Create temporary credentials file for secure login
                const tempDir = os.tmpdir();
                const credFile = path.join(tempDir, `balena-creds-${Date.now()}.tmp`);

                fs.writeFileSync(credFile, JSON.stringify({
                    email: credentials.email,
                    password: credentials.password
                }));

                try
                {
                    // Use balena login with credentials
                    await executeBalenaCommand(`balena login --credentials-file "${credFile}"`);

                    // Verify login worked
                    const user = await executeBalenaCommand('balena whoami');
                    node.isLoggedIn = true;
                    node.currentUser = user;
                    node.lastLoginCheck = new Date();
                    updateStatus(`Logged in: ${user}`, "green");

                    return true;
                } finally
                {
                    // Clean up credentials file
                    if (fs.existsSync(credFile))
                    {
                        fs.unlinkSync(credFile);
                    }
                }
            } catch (error)
            {
                updateStatus("Login failed", "red");
                throw error;
            }
        }

        // Login with API token
        async function loginWithToken()
        {
            const credentials = node.credentials;
            if (!credentials || !credentials.apiToken)
            {
                throw new Error("API token is required for token login");
            }

            try
            {
                updateStatus("Logging in with token...", "blue");

                await executeBalenaCommand(`balena login --token "${credentials.apiToken}"`);

                // Verify login worked
                const user = await executeBalenaCommand('balena whoami');
                node.isLoggedIn = true;
                node.currentUser = user;
                node.lastLoginCheck = new Date();
                updateStatus(`Logged in: ${user}`, "green");

                return true;
            } catch (error)
            {
                updateStatus("Token login failed", "red");
                throw error;
            }
        }

        // Login with browser (interactive)
        async function loginWithBrowser()
        {
            try
            {
                updateStatus("Opening browser login...", "blue");

                await executeBalenaCommand('balena login');

                // Verify login worked
                const user = await executeBalenaCommand('balena whoami');
                node.isLoggedIn = true;
                node.currentUser = user;
                node.lastLoginCheck = new Date();
                updateStatus(`Logged in: ${user}`, "green");

                return true;
            } catch (error)
            {
                updateStatus("Browser login failed", "red");
                throw error;
            }
        }

        // Main login function
        node.login = async function ()
        {
            try
            {
                // First check if already logged in
                if (await checkLoginStatus())
                {
                    return true;
                }

                // Perform login based on method
                switch (node.loginMethod)
                {
                    case 'credentials':
                        return await loginWithCredentials();
                    case 'token':
                        return await loginWithToken();
                    case 'browser':
                        return await loginWithBrowser();
                    default:
                        throw new Error(`Unknown login method: ${node.loginMethod}`);
                }
            } catch (error)
            {
                node.error(`Balena login failed: ${error.message}`);
                updateStatus("Login error", "red");
                return false;
            }
        };

        // Logout function
        node.logout = async function ()
        {
            try
            {
                updateStatus("Logging out...", "blue");
                await executeBalenaCommand('balena logout');
                node.isLoggedIn = false;
                node.currentUser = null;
                updateStatus("Logged out", "grey");
                return true;
            } catch (error)
            {
                node.error(`Balena logout failed: ${error.message}`);
                updateStatus("Logout error", "red");
                return false;
            }
        };

        // Check authentication status
        node.checkAuth = async function ()
        {
            // Cache check for 5 minutes
            if (node.lastLoginCheck && (Date.now() - node.lastLoginCheck.getTime()) < 300000)
            {
                return node.isLoggedIn;
            }

            return await checkLoginStatus();
        };

        // Get authenticated command prefix
        node.getAuthenticatedCommand = function (baseCommand)
        {
            // Add API URL if different from default
            if (node.apiUrl && node.apiUrl !== 'https://api.balena-cloud.com')
            {
                return `balena --api-url ${node.apiUrl} ${baseCommand.replace('balena ', '')}`;
            }
            return baseCommand;
        };

        // Initialize
        async function initialize()
        {
            updateStatus("Initializing...", "blue");

            // Check current login status
            await checkLoginStatus();

            // Auto-login if configured and not logged in
            if (node.autoLogin && !node.isLoggedIn)
            {
                await node.login();
            }
        }

        // Cleanup on close
        node.on('close', function ()
        {
            updateStatus("Disconnected", "red");
        });

        // Initialize the node
        initialize().catch(error =>
        {
            node.error(`Initialization failed: ${error.message}`);
            updateStatus("Init error", "red");
        });
    }

    RED.nodes.registerType("balena-config", BalenaConfigNode, {
        credentials: {
            email: { type: "text" },
            password: { type: "password" },
            apiToken: { type: "password" }
        }
    });
}; 

module.exports = function (RED)
{
    "use strict";

    const { exec } = require('child_process');
    const fs = require('fs');
    const path = require('path');

    function BalenaCredentialsNode(config)
    {
        RED.nodes.createNode(this, config);
        const node = this;

        // Configuration
        node.authType = config.authType || "token";
        node.email = config.email || "";
        node.apiUrl = config.apiUrl || "https://api.balena-cloud.com";
        node.cliPath = config.cliPath || "balena";

        // Store encrypted password if using email/password auth
        if (config.password)
        {
            node.password = config.password;
        }

        // Store encrypted token if using token auth
        if (config.token)
        {
            node.token = config.token;
        }

        // Check if already logged in
        node.isLoggedIn = false;
        node.currentUser = null;

        // Login function
        node.login = function (callback)
        {
            if (node.isLoggedIn)
            {
                callback(null, { success: true, message: 'Already logged in', user: node.currentUser });
                return;
            }

            let command;
            let options = {};

            if (node.authType === "token")
            {
                if (!node.token)
                {
                    callback(new Error("Token is required for token authentication"));
                    return;
                }
                // Use token authentication
                command = `${node.cliPath} login --token ${node.token}`;
            } else
            {
                if (!node.email || !node.password)
                {
                    callback(new Error("Email and password are required for credentials authentication"));
                    return;
                }
                // Use email/password authentication similar to the user's flow
                command = `${node.cliPath} login --credentials --email ${node.email} --password ${node.password}`;

                // Set environment variables as backup
                options.env = {
                    ...process.env,
                    BALENA_EMAIL: node.email,
                    BALENA_PASS: node.password
                };
            }

            exec(command, options, (error, stdout, stderr) =>
            {
                if (error)
                {
                    node.isLoggedIn = false;
                    callback(new Error(`Login failed: ${error.message}\nStderr: ${stderr}`));
                    return;
                }

                node.isLoggedIn = true;

                // Extract username/email from output
                try
                {
                    const output = stdout.trim();
                    if (output.includes('Successfully logged in as:'))
                    {
                        node.currentUser = output.split('Successfully logged in as:')[1].trim();
                    } else if (node.email)
                    {
                        node.currentUser = node.email;
                    } else
                    {
                        node.currentUser = "token user";
                    }
                } catch (parseError)
                {
                    node.currentUser = node.email || "token user";
                }

                callback(null, {
                    success: true,
                    message: `Successfully logged in as: ${node.currentUser}`,
                    user: node.currentUser,
                    stdout: stdout.trim()
                });
            });
        };

        // Logout function
        node.logout = function (callback)
        {
            const command = `${node.cliPath} logout`;

            exec(command, (error, stdout, stderr) =>
            {
                node.isLoggedIn = false;
                node.currentUser = null;

                if (error)
                {
                    callback(new Error(`Logout failed: ${error.message}\nStderr: ${stderr}`));
                    return;
                }

                callback(null, {
                    success: true,
                    message: "Successfully logged out",
                    stdout: stdout.trim()
                });
            });
        };

        // Check authentication status
        node.checkAuth = function (callback)
        {
            const command = `${node.cliPath} whoami`;

            exec(command, (error, stdout, stderr) =>
            {
                if (error)
                {
                    node.isLoggedIn = false;
                    node.currentUser = null;
                    callback(new Error(`Not logged in: ${error.message}`));
                    return;
                }

                node.isLoggedIn = true;
                node.currentUser = stdout.trim();

                callback(null, {
                    success: true,
                    loggedIn: true,
                    user: node.currentUser
                });
            });
        };

        // Get authentication environment
        node.getAuthEnv = function ()
        {
            const env = { ...process.env };

            if (node.authType === "credentials" && node.email && node.password)
            {
                env.BALENA_EMAIL = node.email;
                env.BALENA_PASS = node.password;
            }

            return env;
        };

        // Execute authenticated command
        node.executeCommand = function (command, options = {}, callback)
        {
            // Ensure we're logged in first
            node.checkAuth((authError) =>
            {
                if (authError)
                {
                    // Try to login
                    node.login((loginError) =>
                    {
                        if (loginError)
                        {
                            callback(loginError);
                            return;
                        }
                        // Retry the command after successful login
                        executeWithAuth();
                    });
                } else
                {
                    executeWithAuth();
                }
            });

            function executeWithAuth()
            {
                const execOptions = {
                    ...options,
                    env: node.getAuthEnv()
                };

                exec(command, execOptions, callback);
            }
        };

        // Auto-login on node creation if credentials are available
        if (node.authType === "token" && node.token)
        {
            node.login((error, result) =>
            {
                if (error)
                {
                    node.warn(`Auto-login failed: ${error.message}`);
                } else
                {
                    node.log(`Auto-login successful: ${result.message}`);
                }
            });
        } else if (node.authType === "credentials" && node.email && node.password)
        {
            node.login((error, result) =>
            {
                if (error)
                {
                    node.warn(`Auto-login failed: ${error.message}`);
                } else
                {
                    node.log(`Auto-login successful: ${result.message}`);
                }
            });
        }

        // Clean up on close
        node.on('close', function ()
        {
            // Optionally logout on close
            if (node.isLoggedIn && config.logoutOnClose)
            {
                node.logout((error) =>
                {
                    if (error)
                    {
                        node.warn(`Logout on close failed: ${error.message}`);
                    }
                });
            }
        });
    }

    RED.nodes.registerType("balena-credentials", BalenaCredentialsNode, {
        credentials: {
            password: { type: "password" },
            token: { type: "password" }
        }
    });
}; 

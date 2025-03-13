#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { exec } = require("child_process");
const { promisify } = require("util");
const { existsSync } = require("fs");
const path = require("path");

// Promisify exec for cleaner async usage
const execPromise = promisify(exec);

// Log to console for debugging
console.error("STARTING COMMAND EXECUTION TOOL SERVER");

// Create server
const server = new Server(
  { name: "command-execution-tool", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Security configuration
const SECURITY_CONFIG = {
  // Commands that are considered potentially dangerous
  dangerousCommands: [
    "rm -rf", "rmdir /s", "del /f", "format", 
    ":(){:|:&};:", "dd", "mkfs", "sudo", ">", "chmod -R",
    "| mail", "wget -O", "curl -o"
  ],
  // Maximum command execution time in milliseconds
  maxExecutionTime: 30000,
  // Maximum output buffer size in bytes
  maxBufferSize: 1024 * 1024, // 1MB
  // Default working directory when none specified
  defaultWorkingDirectory: process.cwd()
};

// Define the tools
const TOOLS = [
  {
    name: "execute-command",
    description: "Executes a shell command on the local system",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute"
        },
        workingDirectory: {
          type: "string",
          description: "Optional working directory for the command execution"
        }
      },
      required: ["command"]
    }
  },
  {
    name: "simple-hello",
    description: "Simple hello tool with correct schema",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name to greet (optional)"
        }
      },
      required: []
    }
  }
];

// Validate that a working directory exists and is accessible
function validateWorkingDirectory(directory) {
  if (!directory) return SECURITY_CONFIG.defaultWorkingDirectory;
  
  // Resolve the directory path
  const resolvedPath = path.resolve(directory);
  
  // Check if the directory exists
  if (!existsSync(resolvedPath)) {
    throw new Error(`Working directory does not exist: ${resolvedPath}`);
  }
  
  return resolvedPath;
}

// Check if a command contains potentially dangerous operations
function isSafeCommand(command) {
  // Check against the dangerous commands list
  return !SECURITY_CONFIG.dangerousCommands.some(dangerous => 
    command.toLowerCase().includes(dangerous.toLowerCase())
  );
}

// Execute a shell command with safety checks
async function executeCommand(command, workingDirectory) {
  // Validate working directory
  const validatedDir = validateWorkingDirectory(workingDirectory);
  
  // Check command safety
  if (!isSafeCommand(command)) {
    throw new Error(`Command rejected due to security concerns: ${command}`);
  }
  
  console.error(`[INFO] Executing command: ${command}`);
  console.error(`[INFO] Working directory: ${validatedDir}`);
  
  // Execute the command with timeout and buffer limits
  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd: validatedDir,
      timeout: SECURITY_CONFIG.maxExecutionTime,
      maxBuffer: SECURITY_CONFIG.maxBufferSize,
      shell: process.platform === 'darwin' ? '/bin/zsh' : true
    });
    
    console.error(`[INFO] Command executed successfully`);
    
    // Return the formatted output
    return {
      content: [
        {
          type: "text",
          text: `$ ${command}`
        },
        ...(stdout.trim() ? [{
          type: "text",
          text: stdout.trim()
        }] : []),
        ...(stderr.trim() ? [{
          type: "text",
          text: `Error: ${stderr.trim()}`
        }] : [])
      ]
    };
  } catch (error) {
    console.error(`[ERROR] Command execution failed: ${error.message}`);
    
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error(`Command execution timed out after ${SECURITY_CONFIG.maxExecutionTime / 1000} seconds`);
    }
    
    const errorOutput = [];
    
    if (error.stdout?.trim()) {
      errorOutput.push({
        type: "text",
        text: error.stdout.trim()
      });
    }
    
    if (error.stderr?.trim()) {
      errorOutput.push({
        type: "text",
        text: `Error: ${error.stderr.trim()}`
      });
    }
    
    if (errorOutput.length === 0) {
      errorOutput.push({
        type: "text",
        text: `Error: ${error.message}`
      });
    }
    
    return {
      content: [
        {
          type: "text",
          text: `$ ${command} (failed)`
        },
        ...errorOutput
      ]
    };
  }
}

// Handle all requests
server.fallbackRequestHandler = async (request) => {
  try {
    const { method, params, id } = request;
    console.error(`REQUEST: ${method} [${id}]`);
    
    // Initialize
    if (method === "initialize") {
      return {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "command-execution-tool", version: "1.0.0" }
      };
    }
    
    // Tools list
    if (method === "tools/list") {
      console.error(`TOOLS: ${JSON.stringify(TOOLS)}`);
      return { tools: TOOLS };
    }
    
    // Tool call
    if (method === "tools/call") {
      const { name, arguments: args = {} } = params || {};
      
      if (name === "simple-hello") {
        const userName = args.name || "World";
        return {
          content: [
            { type: "text", text: `Hello, ${userName}!` }
          ]
        };
      }
      
      if (name === "execute-command") {
        const { command, workingDirectory } = args;
        
        if (!command) {
          return {
            error: {
              code: -32602,
              message: "Missing required parameter: command"
            }
          };
        }
        
        try {
          return await executeCommand(command, workingDirectory);
        } catch (error) {
          return {
            error: {
              code: -32603,
              message: error.message
            }
          };
        }
      }
      
      return {
        error: {
          code: -32601,
          message: `Tool not found: ${name}`
        }
      };
    }
    
    // Required empty responses
    if (method === "resources/list") return { resources: [] };
    if (method === "prompts/list") return { prompts: [] };
    
    // Empty response for unhandled methods
    return {};
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return {
      error: {
        code: -32603,
        message: "Internal error",
        data: { details: error.message }
      }
    };
  }
};

// Handle process termination
process.on('SIGINT', () => {
  console.error("[INFO] Server shutting down on SIGINT...");
  process.exit(0);
});

// Stay alive on SIGTERM
process.on("SIGTERM", () => {
  console.error("SIGTERM received but staying alive");
});

process.on('uncaughtException', (error) => {
  console.error("[FATAL] Uncaught exception:", error);
});

// Connect to stdio transport
const transport = new StdioServerTransport();

// Connect server
server.connect(transport)
  .then(() => console.error("Server connected"))
  .catch(error => {
    console.error(`Connection error: ${error.message}`);
    process.exit(1);
  });

# Command Execution MCP Server for Claude Desktop

## Overview

The Command Execution MCP (Model Context Protocol) Server is a secure, controlled tool that allows Claude to execute shell commands directly on your local system. This server provides a safe and flexible way to interact with your computer's command line through Claude's interface.

## Key Features

- **Secure Command Execution**: Runs shell commands with built-in safety checks
- **Working Directory Support**: Execute commands in specific directories
- **Cross-Platform Compatibility**: Works on macOS and other Unix-like systems
- **Extensive Error Handling**: Provides detailed feedback on command execution
- **Timeout and Buffer Limits**: Prevents runaway or resource-intensive commands

## Security Measures

The server implements multiple layers of security:

1. **Dangerous Command Blocking**
   - Prevents execution of potentially harmful commands like `rm -rf`, `sudo`, etc.
   - Blocks commands that could compromise system integrity

2. **Execution Constraints**
   - Maximum execution time: 30 seconds
   - Maximum output buffer: 1MB
   - Validates working directory existence

## Supported Tools

### 1. `execute-command`
Execute shell commands with optional working directory specification.

**Parameters:**
- `command` (required): The shell command to execute
- `workingDirectory` (optional): Specify the directory for command execution

**Example Usage in Claude:**
```
execute-command with command="ls -la" and workingDirectory="/Users/yourusername/Documents"
```

### 2. `simple-hello`
A basic demonstration tool that returns a greeting.

**Parameters:**
- `name` (optional): Name to greet (defaults to "World")

**Example Usage in Claude:**
```
simple-hello with name="Claude"
```

## Installation

### 1. Prerequisites

- Node.js (v16 or later)
- Claude Desktop
- npm (Node Package Manager)

### 2. Install Dependencies
```bash
cd /path/to/command-execution-tool
npm install @modelcontextprotocol/sdk
```

### 3. Claude Desktop Configuration

Add the following to your Claude Desktop configuration file:

**Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration Block:**
```json
{
  "mcpServers": {
    "command-execution": {
      "command": "node",
      "args": [
        "/full/path/to/command-execution-tool.js"
      ],
      "env": {
        "NODE_OPTIONS": "--no-deprecation"
      }
    }
  }
}
```

**Important:** Replace `/full/path/to/command-execution-tool.js` with the actual path to the script.

## Usage Guidelines

- **Be Cautious**: Only run commands you understand
- **Security First**: The tool prevents obviously dangerous commands
- **Working Directory**: Specify a working directory for more controlled execution

## Limitations

- Does not support interactive commands
- Maximum command execution time is 30 seconds
- Output is limited to 1MB
- Some system-critical commands are blocked

## Contributing

Contributions are welcome! Please submit pull requests or open issues on the GitHub repository.

## License

MIT License

## Support

For issues or feature requests, please open a GitHub issue.
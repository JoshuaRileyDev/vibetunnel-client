# VibeTunnel TypeScript Client

Please not that this is not an official client, we are not affiliated with VibeTunnel at all

A comprehensive TypeScript/JavaScript client library for [VibeTunnel](https://github.com/amantus-ai/vibetunnel) - the innovative macOS application that transforms any browser into a terminal for remote access and AI agent monitoring.

## Features

- **Full API Coverage**: Complete TypeScript client for all VibeTunnel endpoints
- **Authentication**: Support for SSH key and password authentication  
- **Session Management**: Create, monitor, and interact with terminal sessions
- **Real-time Communication**: WebSocket and Server-Sent Events support
- **File Operations**: Upload, download, and manage files with Git integration
- **Push Notifications**: Web Push API integration for session alerts
- **TypeScript Support**: Full type definitions and IntelliSense support
- **Auto-reconnection**: Built-in reconnection logic for reliable connections
- **Error Handling**: Comprehensive error handling with custom error types

## Installation

```bash
npm install vibetunnel-client
```

## Quick Start

```typescript
import { createVibeTunnelClient } from 'vibetunnel-client';

// Create client
const client = createVibeTunnelClient('localhost', { port: 4020 });

// Initialize and authenticate
await client.initialize();
await client.authenticatePassword('username', 'password');

// Create and run a command
const result = await client.executeCommand('echo "Hello VibeTunnel!"');
console.log(result.output); // "Hello VibeTunnel!"
```

## Table of Contents

- [Configuration](#configuration)
- [Authentication](#authentication)
- [Session Management](#session-management)
- [File Operations](#file-operations)
- [Push Notifications](#push-notifications)
- [Real-time Communication](#real-time-communication)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [TypeScript Support](#typescript-support)

## Configuration

### Basic Configuration

```typescript
import { VibeTunnelClient, VibeTunnelConfig } from 'vibetunnel-client';

const config: VibeTunnelConfig = {
  baseUrl: 'localhost',
  port: 4020,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  authToken: 'optional-bearer-token'
};

const client = new VibeTunnelClient(config);
```

### Environment Variables

Create a client from environment variables:

```typescript
import { createClientFromEnv } from 'vibetunnel-client';

// Reads from VIBETUNNEL_URL, VIBETUNNEL_PORT, VIBETUNNEL_TOKEN, etc.
const client = createClientFromEnv();
```

### Auto-Discovery

Automatically discover VibeTunnel server on local network:

```typescript
import { discoverLocalServer } from 'vibetunnel-client';

const client = await discoverLocalServer();
if (client) {
  console.log('VibeTunnel server found!');
} else {
  console.log('No VibeTunnel server found on local network');
}
```

## Authentication

VibeTunnel supports multiple authentication methods. The client will automatically handle JWT token management once authenticated.

### Password Authentication

```typescript
const success = await client.authenticatePassword('username', 'password');
if (success) {
  console.log('Authenticated successfully');
}
```

### SSH Key Authentication

```typescript
// Note: SSH key implementation requires additional setup
const success = await client.authenticateSSH('/path/to/private/key');
if (success) {
  console.log('Authenticated with SSH key');
}
```

### Check Authentication Status

```typescript
// Check if currently authenticated
if (client.isAuthenticated()) {
  const user = client.getCurrentUser();
  console.log(`Logged in as: ${user?.username}`);
}

// Verify token is still valid
const verification = await client.auth.verify();
if (verification.valid) {
  console.log('Token is valid');
}
```

### Authentication Configuration

```typescript
// Get server auth configuration
const authConfig = await client.auth.getConfig();
console.log('SSH keys enabled:', authConfig.enableSSHKeys);
console.log('Password auth allowed:', !authConfig.disallowUserPassword);
```

## Session Management

### Creating Sessions

```typescript
// Simple command execution
const session = await client.sessions.createSession({
  command: 'ls -la',
  workingDirectory: '/home/user',
  title: 'Directory Listing'
});

// Interactive shell
const shellSession = await client.sessions.createSession({
  command: '/bin/bash',
  workingDirectory: process.cwd(),
  title: 'Interactive Shell'
});
```

### Session Operations

```typescript
// List all sessions
const sessionList = await client.sessions.listSessions();
console.log(`Active sessions: ${sessionList.sessions.length}`);

// Get session details
const sessionInfo = await client.sessions.getSession(sessionId);
console.log(`Status: ${sessionInfo.status}`);
console.log(`PID: ${sessionInfo.pid}`);

// Kill a session
await client.sessions.killSession(sessionId);

// Get session output as text
const output = await client.sessions.getSessionText(sessionId);
console.log(output);
```

### Session Activity Monitoring

```typescript
// Check activity for all sessions
const activities = await client.sessions.getSessionsActivity();
activities.forEach(activity => {
  console.log(`Session ${activity.sessionId}: ${activity.isActive ? 'active' : 'idle'}`);
});

// Check specific session activity
const activity = await client.sessions.getSessionActivity(sessionId);
if (activity.isActive) {
  console.log(`Last activity: ${activity.lastActivityTime}`);
}
```

### Terminal Operations

```typescript
// Send input to session
await client.sessions.sendInput(sessionId, 'echo "Hello"\n');

// Resize terminal
await client.sessions.resizeSession(sessionId, { cols: 80, rows: 24 });

// Update session title
await client.sessions.updateSession(sessionId, { title: 'New Title' });

// Reset terminal size
await client.sessions.resetSessionSize(sessionId);
```

## File Operations

### Directory Browsing

```typescript
// Browse current directory
const files = await client.files.browseDirectory('.');
files.forEach(file => {
  console.log(`${file.isDirectory ? 'DIR' : 'FILE'}: ${file.name}`);
  if (file.gitStatus) {
    console.log(`  Git status: ${file.gitStatus.modified ? 'modified' : 'clean'}`);
  }
});

// Browse specific path
const homeFiles = await client.files.browseDirectory('/home/user');
```

### File Content Operations

```typescript
// Get file preview
const preview = await client.files.getFilePreview('/path/to/file.txt', {
  maxSize: 1024,
  encoding: 'utf8'
});
console.log('Preview:', preview.content);

// Get full file content
const content = await client.files.getFileContent('/path/to/file.txt');
console.log(content.content);

// Get raw file as buffer
const buffer = await client.files.getRawFileContent('/path/to/binary-file');
```

### File Upload/Download

```typescript
// Upload file
const uploadResult = await client.files.uploadFile('/local/path/file.txt', {
  fileName: 'uploaded-file.txt',
  targetPath: '/remote/path/',
  overwrite: true
});

// Upload from buffer
const buffer = Buffer.from('Hello VibeTunnel!');
await client.files.uploadFileFromBuffer(buffer, 'hello.txt', {
  mimeType: 'text/plain'
});

// List uploaded files
const uploadedFiles = await client.files.listUploadedFiles();

// Download uploaded file
const fileBuffer = await client.files.getUploadedFile('hello.txt');
console.log(fileBuffer.toString());

// Delete uploaded file
await client.files.deleteUploadedFile('hello.txt');
```

### Git Integration

```typescript
// Get Git diff for file
const diff = await client.files.getFileDiff('/path/to/modified-file.js');
if (diff.hasChanges) {
  console.log('Diff:', diff.diff);
}

// Get file content for different Git versions
const workingContent = await client.files.getDiffContent('/path/to/file.js', 'working');
const headContent = await client.files.getDiffContent('/path/to/file.js', 'head');
```

### Directory Operations

```typescript
// Create directory
const result = await client.files.createDirectory('/path/to/new-dir', true);
console.log(`Directory created: ${result.created}`);

// Check if path exists
const pathInfo = await client.files.getPathInfo('/some/path');
if (pathInfo) {
  console.log(`Path exists: ${pathInfo.isDirectory ? 'directory' : 'file'}`);
}
```

## Push Notifications

### Setup Push Notifications

```typescript
// Check if push notifications are supported
if (client.push.isPushSupported()) {
  // Request permission
  const permission = await client.push.requestNotificationPermission();
  
  if (permission === 'granted') {
    // Get service worker registration (in browser)
    const registration = await navigator.serviceWorker.ready;
    
    // Subscribe to push notifications
    const subscription = await client.push.subscribeWithServiceWorker(registration);
    console.log('Subscribed to push notifications');
  }
}
```

### Push Notification Management

```typescript
// Get VAPID public key
const vapidKey = await client.push.getVAPIDPublicKey();

// Get push service status
const status = await client.push.getStatus();
console.log(`Push enabled: ${status.enabled}`);
console.log(`Subscriptions: ${status.subscriptionsCount}`);

// Send test notification
const testResult = await client.push.sendTestNotification('Hello from VibeTunnel!');
console.log(`Test notification sent to ${testResult.sent} subscribers`);

// Unsubscribe
await client.push.unsubscribe();
```

## Real-time Communication

### Streaming Session Output

```typescript
// Stream session output with Server-Sent Events
const cleanup = client.sessions.streamSessionOutput(
  sessionId,
  (event) => {
    console.log(`[${event.type}] ${event.data}`);
  },
  { autoReconnect: true }
);

// Stop streaming
cleanup();
```

### WebSocket Communication

```typescript
// Connect to input WebSocket for real-time input
const inputSocket = await client.sessions.connectInputSocket(sessionId, {
  autoReconnect: true,
  reconnectInterval: 1000
});

// Send real-time input
client.sessions.sendInputSocket('ls -la\n');

// Connect to buffer updates WebSocket
const bufferSocket = await client.sessions.connectBufferSocket({
  autoReconnect: true
});

// Listen for events
client.sessions.on('message', (message) => {
  console.log('WebSocket message:', message);
});

client.sessions.on('bufferUpdate', (update) => {
  console.log('Buffer update:', update);
});

client.sessions.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

## API Reference

### VibeTunnelClient

Main client class providing access to all VibeTunnel functionality.

#### Constructor

```typescript
new VibeTunnelClient(config: VibeTunnelConfig)
```

#### Methods

- `initialize()`: Initialize client and verify connection
- `authenticatePassword(username, password)`: Authenticate with password
- `authenticateSSH(privateKeyPath, publicKey?)`: Authenticate with SSH key
- `logout()`: Logout and clear authentication
- `getHealth()`: Get server health status
- `executeCommand(command, options?)`: Execute command and get output
- `createAndConnectSession(options?)`: Create session with auto-connection
- `isAuthenticated()`: Check authentication status
- `getCurrentUser()`: Get current user info
- `disconnect()`: Disconnect all connections

#### Properties

- `auth`: AuthService - Authentication operations
- `sessions`: SessionService - Session management  
- `files`: FileService - File operations
- `push`: PushService - Push notifications

### AuthService

Authentication and user management.

#### Methods

- `getConfig()`: Get authentication configuration
- `getCurrentUser()`: Get current system user
- `createChallenge()`: Create SSH authentication challenge
- `authenticateWithSSHKey(challengeId, signature, publicKey)`: SSH authentication
- `authenticateWithPassword(username, password)`: Password authentication
- `verify()`: Verify current authentication
- `getUserAvatar(userId)`: Get user avatar (macOS)
- `logout()`: Logout
- `setAuthToken(token)`: Set authentication token
- `getAuthToken()`: Get current token
- `isAuthenticated()`: Check if authenticated

### SessionService

Terminal session management and real-time communication.

#### Methods

- `listSessions()`: List all sessions
- `createSession(options)`: Create new session
- `getSession(sessionId)`: Get session info
- `killSession(sessionId)`: Kill session
- `cleanupSession(sessionId)`: Cleanup session files
- `cleanupExitedSessions()`: Cleanup all exited sessions
- `getSessionText(sessionId)`: Get session plain text
- `getSessionBuffer(sessionId)`: Get session buffer
- `sendInput(sessionId, data)`: Send input to session
- `resizeSession(sessionId, size)`: Resize terminal
- `updateSession(sessionId, updates)`: Update session
- `getSessionsActivity()`: Get activity for all sessions
- `getSessionActivity(sessionId)`: Get session activity
- `streamSessionOutput(sessionId, callback, options)`: Stream output
- `connectInputSocket(sessionId, options)`: Connect input WebSocket
- `connectBufferSocket(options)`: Connect buffer WebSocket
- `disconnect()`: Disconnect all connections

### FileService

File and directory operations with Git integration.

#### Methods

- `browseDirectory(path)`: Browse directory
- `getFilePreview(path, options)`: Get file preview
- `getRawFileContent(path)`: Get raw file content
- `getFileContent(path, encoding)`: Get text file content
- `getFileDiff(path, options)`: Get Git diff
- `getDiffContent(path, version)`: Get diff content
- `createDirectory(path, recursive)`: Create directory
- `uploadFile(filePath, options)`: Upload file
- `uploadFileFromBuffer(buffer, fileName, options)`: Upload from buffer
- `getUploadedFile(fileName)`: Get uploaded file
- `listUploadedFiles()`: List uploaded files
- `deleteUploadedFile(fileName)`: Delete uploaded file
- `getPathInfo(path)`: Get path information

### PushService

Web Push notifications.

#### Methods

- `getVAPIDPublicKey()`: Get VAPID public key
- `subscribe(subscription)`: Subscribe to notifications
- `unsubscribe(subscriptionId)`: Unsubscribe
- `sendTestNotification(message)`: Send test notification
- `getStatus()`: Get push service status
- `createPushSubscription(registration)`: Create subscription
- `subscribeWithServiceWorker(registration)`: Subscribe with SW
- `isPushSupported()`: Check push support
- `requestNotificationPermission()`: Request permission
- `getNotificationPermission()`: Get permission status

## Examples

### Basic Command Execution

```typescript
import { createLocalClient } from 'vibetunnel-client';

async function runCommand() {
  const client = createLocalClient();
  
  await client.authenticatePassword('user', 'pass');
  
  const result = await client.executeCommand('uptime', {
    captureOutput: true,
    timeout: 10000
  });
  
  console.log('Output:', result.output);
  console.log('Exit code:', result.exitCode);
}
```

### Interactive Terminal

```typescript
import { createVibeTunnelClient } from 'vibetunnel-client';
import * as readline from 'readline';

async function interactiveTerminal() {
  const client = createVibeTunnelClient('localhost');
  await client.authenticatePassword('user', 'pass');
  
  const session = await client.sessions.createSession({
    command: '/bin/bash',
    title: 'Interactive'
  });
  
  // Connect input WebSocket
  await client.sessions.connectInputSocket(session.sessionId);
  
  // Stream output
  client.sessions.streamSessionOutput(session.sessionId, (event) => {
    if (event.type === 'data') {
      process.stdout.write(event.data);
    }
  });
  
  // Handle user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.on('line', (input) => {
    client.sessions.sendInputSocket(input + '\n');
  });
}
```

### File Upload/Download

```typescript
async function fileOperations() {
  const client = createLocalClient();
  await client.authenticatePassword('user', 'pass');
  
  // Upload file
  const upload = await client.files.uploadFile('./local-file.txt', {
    fileName: 'remote-file.txt',
    overwrite: true
  });
  
  console.log('Uploaded:', upload.filename);
  
  // Download file
  const content = await client.files.getUploadedFile(upload.filename);
  console.log('Content:', content.toString());
  
  // Cleanup
  await client.files.deleteUploadedFile(upload.filename);
}
```

### Session Monitoring

```typescript
async function monitorSessions() {
  const client = createLocalClient();
  await client.authenticatePassword('user', 'pass');
  
  // Create long-running session
  const session = await client.sessions.createSession({
    command: 'sleep 60 && echo "Done!"',
    title: 'Long Task'
  });
  
  // Monitor activity
  const interval = setInterval(async () => {
    const activity = await client.sessions.getSessionActivity(session.sessionId);
    console.log(`Session ${session.sessionId}: ${activity.isActive ? 'active' : 'idle'}`);
    
    const info = await client.sessions.getSession(session.sessionId);
    if (info.status === 'exited') {
      console.log('Session completed');
      clearInterval(interval);
    }
  }, 5000);
}
```

## Error Handling

The client provides comprehensive error handling with custom error types:

```typescript
import { VibeTunnelError } from 'vibetunnel-client';

try {
  await client.sessions.createSession({ command: 'invalid-command' });
} catch (error) {
  if (error instanceof VibeTunnelError) {
    console.error('VibeTunnel Error:', error.message);
    console.error('Code:', error.code);
    console.error('Status:', error.statusCode);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Error Types

- `HTTP_ERROR`: HTTP request failed
- `TIMEOUT`: Request timeout
- `REQUEST_FAILED`: General request failure
- `WEBSOCKET_ERROR`: WebSocket connection error
- `AUTH_ERROR`: Authentication error

## TypeScript Support

The client is written in TypeScript and provides full type definitions:

```typescript
import { 
  VibeTunnelClient,
  VibeTunnelConfig,
  Session,
  SessionCreateOptions,
  FileInfo,
  AuthResponse
} from 'vibetunnel-client';

// Full IntelliSense support
const client: VibeTunnelClient = new VibeTunnelClient(config);
const session: Session = await client.sessions.createSession(options);
const files: FileInfo[] = await client.files.browseDirectory('.');
```

### Type Definitions

All API responses and options are fully typed:

- `VibeTunnelConfig`: Client configuration
- `Session`: Terminal session information
- `SessionCreateOptions`: Session creation options
- `FileInfo`: File/directory information
- `AuthConfig`: Authentication configuration
- `PushSubscription`: Push notification subscription
- `TerminalSize`: Terminal dimensions
- `And many more...`

## Development

### Building from Source

```bash
git clone <repository-url>
cd vibetunnel-client
npm install
npm run build
```

### Running Examples

```bash
# Set environment variables
export VIBETUNNEL_URL=localhost
export VIBETUNNEL_PORT=4020
export VIBETUNNEL_PASSWORD=your-password

# Run examples
npx ts-node src/examples/basic-usage.ts
npx ts-node src/examples/interactive-session.ts
npx ts-node src/examples/file-operations.ts
```

### Testing

The client includes comprehensive examples that can be used for testing:

```bash
npm run build
node dist/examples/basic-usage.js
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests and examples
5. Submit a pull request

## Support

- **Issues**: Report bugs and request features on GitHub
- **Documentation**: See the [VibeTunnel repository](https://github.com/amantus-ai/vibetunnel) for server documentation
- **Examples**: Check the `src/examples/` directory for usage examples

## Related Projects

- [VibeTunnel](https://github.com/amantus-ai/vibetunnel) - The main VibeTunnel server
- [VibeTunnel iOS](https://github.com/amantus-ai/vibetunnel/tree/main/ios) - iOS companion app

---

**VibeTunnel** - Turn any browser into your Mac terminal & command your agents on the go!

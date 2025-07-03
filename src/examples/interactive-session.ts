import { createVibeTunnelClient } from '../utils/factory';
import * as readline from 'readline';

async function interactiveExample() {
  const client = createVibeTunnelClient('localhost');

  try {
    // Initialize
    await client.initialize();
    
    // Authenticate (using environment variables for demo)
    const username = process.env.USER || 'demo';
    const password = process.env.VIBETUNNEL_PASSWORD || 'demo';
    
    const authenticated = await client.authenticatePassword(username, password);
    if (!authenticated) {
      console.error('Authentication failed');
      return;
    }

    // Create interactive shell session
    const session = await client.sessions.createSession({
      command: '/bin/bash', // or '/bin/zsh'
      workingDirectory: process.cwd(),
      title: 'Interactive Shell'
    });

    console.log(`Interactive session started: ${session.sessionId}`);
    console.log('Type commands and press Enter. Type "exit" to quit.');

    // Connect to input WebSocket
    const inputSocket = await client.sessions.connectInputSocket(session.sessionId);

    // Stream output
    const outputCleanup = client.sessions.streamSessionOutput(
      session.sessionId,
      (event) => {
        if (event.type === 'data') {
          process.stdout.write(event.data);
        }
      }
    );

    // Setup readline for input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: ''
    });

    // Handle user input
    rl.on('line', (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log('\nExiting...');
        rl.close();
        return;
      }

      // Send input to session
      client.sessions.sendInputSocket(input + '\n');
    });

    // Handle session events
    client.sessions.on('message', (message) => {
      if (message.type === 'session-status' && message.data?.status === 'exited') {
        console.log('\nSession ended');
        rl.close();
      }
    });

    // Cleanup on exit
    rl.on('close', () => {
      outputCleanup();
      client.disconnect();
      process.exit(0);
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\nReceived SIGINT, cleaning up...');
      rl.close();
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run example
if (require.main === module) {
  interactiveExample().catch(console.error);
}

export { interactiveExample };
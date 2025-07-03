import { createVibeTunnelClient } from '../utils/factory';

async function basicExample() {
  // Create client
  const client = createVibeTunnelClient('localhost', { port: 4020 });

  try {
    // Initialize and check connection
    console.log('Connecting to VibeTunnel...');
    const status = await client.initialize();
    console.log('Server status:', status);

    // Authenticate with password
    console.log('Authenticating...');
    const authenticated = await client.authenticatePassword('username', 'password');
    
    if (!authenticated) {
      console.error('Authentication failed');
      return;
    }

    console.log('Authentication successful!');

    // List existing sessions
    const sessionList = await client.sessions.listSessions();
    console.log('Current sessions:', sessionList.sessions.length);

    // Create a new session
    console.log('Creating new session...');
    const session = await client.sessions.createSession({
      command: 'echo "Hello from VibeTunnel!" && sleep 2 && echo "Done!"',
      workingDirectory: process.cwd(),
      title: 'Demo Session'
    });

    console.log('Session created:', session.sessionId);

    // Stream session output
    const cleanup = client.sessions.streamSessionOutput(
      session.sessionId,
      (event) => {
        console.log(`[${event.type}]`, event.data);
      }
    );

    // Wait for session to complete
    setTimeout(async () => {
      const sessionInfo = await client.sessions.getSession(session.sessionId);
      console.log('Session status:', sessionInfo.status);
      
      if (sessionInfo.status === 'exited') {
        console.log('Session completed with exit code:', sessionInfo.exitCode);
        cleanup();
      }
    }, 5000);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run example
if (require.main === module) {
  basicExample().catch(console.error);
}

export { basicExample };
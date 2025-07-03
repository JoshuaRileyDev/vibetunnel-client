import { VibeTunnelClient } from '../client';
import { VibeTunnelConfig } from '../types';

/**
 * Create a VibeTunnel client with common configurations
 */
export function createVibeTunnelClient(
  baseUrl: string,
  options: Partial<VibeTunnelConfig> = {}
): VibeTunnelClient {
  const config: VibeTunnelConfig = {
    baseUrl,
    port: 4020,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    ...options
  };

  return new VibeTunnelClient(config);
}

/**
 * Create a VibeTunnel client for local development
 */
export function createLocalClient(port: number = 4020): VibeTunnelClient {
  return createVibeTunnelClient('localhost', { port });
}

/**
 * Create a VibeTunnel client with authentication token
 */
export function createAuthenticatedClient(
  baseUrl: string,
  authToken: string,
  options: Partial<VibeTunnelConfig> = {}
): VibeTunnelClient {
  return createVibeTunnelClient(baseUrl, {
    ...options,
    authToken
  });
}

/**
 * Auto-discover VibeTunnel server on local network
 */
export async function discoverLocalServer(
  timeout: number = 5000
): Promise<VibeTunnelClient | null> {
  const commonPorts = [4020, 4021, 4022, 8080, 3000];
  const baseHosts = ['localhost', '127.0.0.1'];
  
  for (const host of baseHosts) {
    for (const port of commonPorts) {
      try {
        const client = createVibeTunnelClient(host, { port, timeout: 2000 });
        const health = await client.getHealth();
        
        if (health.status === 'healthy') {
          return client;
        }
      } catch (error) {
        // Continue trying other ports/hosts
        continue;
      }
    }
  }

  return null;
}

/**
 * Create client from environment variables
 */
export function createClientFromEnv(): VibeTunnelClient {
  const baseUrl = process.env.VIBETUNNEL_URL || 'localhost';
  const port = process.env.VIBETUNNEL_PORT ? parseInt(process.env.VIBETUNNEL_PORT) : 4020;
  const authToken = process.env.VIBETUNNEL_TOKEN;
  const timeout = process.env.VIBETUNNEL_TIMEOUT ? parseInt(process.env.VIBETUNNEL_TIMEOUT) : 30000;

  return createVibeTunnelClient(baseUrl, {
    port,
    authToken,
    timeout
  });
}
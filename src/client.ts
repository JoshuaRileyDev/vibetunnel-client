import { VibeTunnelConfig, HealthCheck, LogEntry } from './types';
import { AuthService } from './services/auth';
import { SessionService } from './services/sessions';
import { FileService } from './services/files';
import { PushService } from './services/push';

export class VibeTunnelClient {
  private config: VibeTunnelConfig;
  public auth: AuthService;
  public sessions: SessionService;
  public files: FileService;
  public push: PushService;

  constructor(config: VibeTunnelConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    // Construct base URL
    const port = this.config.port || 4020;
    const baseUrl = this.config.baseUrl.includes('://') 
      ? this.config.baseUrl 
      : `http://${this.config.baseUrl}:${port}`;

    // Initialize services
    this.auth = new AuthService(baseUrl, { timeout: this.config.timeout });
    this.sessions = new SessionService(baseUrl, { timeout: this.config.timeout });
    this.files = new FileService(baseUrl, { timeout: this.config.timeout });
    this.push = new PushService(baseUrl, { timeout: this.config.timeout });

    // Set auth token if provided
    if (this.config.authToken) {
      this.auth.setAuthToken(this.config.authToken);
      this.propagateAuthToken();
    }

    // Set up auth token propagation
    this.setupAuthTokenPropagation();
  }

  /**
   * Initialize client and verify connection
   */
  async initialize(): Promise<{ healthy: boolean; version?: string; authenticated?: boolean }> {
    try {
      // Check server health
      const health = await this.getHealth();
      
      let authenticated = false;
      if (this.auth.isAuthenticated()) {
        const verification = await this.auth.verify();
        authenticated = verification.valid;
      }

      return {
        healthy: health.status === 'healthy',
        version: health.version,
        authenticated
      };
    } catch (error) {
      return { healthy: false };
    }
  }

  /**
   * Authenticate with SSH key
   */
  async authenticateSSH(privateKeyPath: string, publicKey?: string): Promise<boolean> {
    try {
      // Create challenge
      const challenge = await this.auth.createChallenge();
      
      // Sign challenge (this would need SSH key implementation)
      const signature = await this.signChallenge(challenge.challenge, privateKeyPath);
      
      // Use provided public key or derive from private key
      const pubKey = publicKey || await this.getPublicKeyFromPrivate(privateKeyPath);
      
      // Authenticate
      const response = await this.auth.authenticateWithSSHKey(
        challenge.challengeId,
        signature,
        pubKey
      );

      if (response.success) {
        this.propagateAuthToken();
        return true;
      }

      return false;
    } catch (error) {
      console.error('SSH authentication failed:', error);
      return false;
    }
  }

  /**
   * Authenticate with password
   */
  async authenticatePassword(username: string, password: string): Promise<boolean> {
    try {
      const response = await this.auth.authenticateWithPassword(username, password);
      
      if (response.success) {
        this.propagateAuthToken();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Password authentication failed:', error);
      return false;
    }
  }

  /**
   * Logout and clear authentication
   */
  async logout(): Promise<void> {
    await this.auth.logout();
    this.clearAuthTokens();
  }

  /**
   * Get server health status
   */
  async getHealth(): Promise<HealthCheck> {
    const response = await fetch(`${this.getBaseUrl()}/api/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get server logs
   */
  async getLogs(options: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    limit?: number;
    sessionId?: string;
    component?: string;
  } = {}): Promise<LogEntry[]> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const response = await fetch(`${this.getBaseUrl()}/api/logs?${params}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get logs: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new terminal session and connect to it
   */
  async createAndConnectSession(options: {
    command?: string;
    workingDirectory?: string;
    title?: string;
    autoConnect?: boolean;
  } = {}): Promise<{
    session: any;
    cleanup: () => void;
  }> {
    // Create session
    const session = await this.sessions.createSession(options);

    let cleanup: () => void = () => {};

    if (options.autoConnect !== false) {
      // Connect to output stream
      const streamCleanup = this.sessions.streamSessionOutput(
        session.sessionId,
        (event) => {
          console.log(`[${session.sessionId}] ${event.type}:`, event.data);
        },
        { autoReconnect: true }
      );

      // Connect input socket
      const inputSocket = await this.sessions.connectInputSocket(session.sessionId, {
        autoReconnect: true
      });

      cleanup = () => {
        streamCleanup();
        this.sessions.disconnect();
      };
    }

    return { session, cleanup };
  }

  /**
   * Quick method to execute a command and get output
   */
  async executeCommand(
    command: string,
    options: {
      workingDirectory?: string;
      timeout?: number;
      captureOutput?: boolean;
    } = {}
  ): Promise<{ output: string; exitCode?: number; sessionId: string }> {
    return new Promise(async (resolve, reject) => {
      const session = await this.sessions.createSession({
        command,
        workingDirectory: options.workingDirectory
      });

      let output = '';
      const timeout = options.timeout || 30000;
      const timeoutId = setTimeout(() => {
        reject(new Error(`Command execution timeout after ${timeout}ms`));
      }, timeout);

      // Stream output if capture is enabled
      const cleanup = this.sessions.streamSessionOutput(
        session.sessionId,
        (event) => {
          if (event.type === 'data' && options.captureOutput) {
            output += event.data;
          }
        }
      );

      // Poll session status
      const checkStatus = async () => {
        try {
          const sessionInfo = await this.sessions.getSession(session.sessionId);
          
          if (sessionInfo.status === 'exited') {
            clearTimeout(timeoutId);
            cleanup();
            
            resolve({
              output: options.captureOutput ? output : await this.sessions.getSessionText(session.sessionId),
              exitCode: sessionInfo.exitCode,
              sessionId: session.sessionId
            });
          } else {
            setTimeout(checkStatus, 500);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          cleanup();
          reject(error);
        }
      };

      checkStatus();
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): VibeTunnelConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<VibeTunnelConfig>): void {
    this.config = { ...this.config, ...updates };
    
    if (updates.authToken) {
      this.auth.setAuthToken(updates.authToken);
      this.propagateAuthToken();
    }
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  /**
   * Get current user info
   */
  getCurrentUser() {
    return this.auth.getUser();
  }

  /**
   * Disconnect all connections
   */
  disconnect(): void {
    this.sessions.disconnect();
  }

  private getBaseUrl(): string {
    const port = this.config.port || 4020;
    return this.config.baseUrl.includes('://') 
      ? this.config.baseUrl 
      : `http://${this.config.baseUrl}:${port}`;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = this.auth.getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private setupAuthTokenPropagation(): void {
    // Override service getHeaders methods to include auth token
    const originalSessionHeaders = this.sessions['getHeaders'].bind(this.sessions);
    this.sessions['getHeaders'] = () => ({
      ...originalSessionHeaders(),
      ...this.getAuthHeaders()
    });

    const originalFileHeaders = this.files['getHeaders'].bind(this.files);
    this.files['getHeaders'] = () => ({
      ...originalFileHeaders(),
      ...this.getAuthHeaders()
    });

    const originalPushHeaders = this.push['getHeaders'].bind(this.push);
    this.push['getHeaders'] = () => ({
      ...originalPushHeaders(),
      ...this.getAuthHeaders()
    });
  }

  private propagateAuthToken(): void {
    // Auth token is automatically propagated through getHeaders override
  }

  private clearAuthTokens(): void {
    // Tokens are cleared through individual services
  }

  private async signChallenge(challenge: string, privateKeyPath: string): Promise<string> {
    // This would need actual SSH key implementation
    // For now, return a placeholder
    throw new Error('SSH key signing not implemented - please use password authentication');
  }

  private async getPublicKeyFromPrivate(privateKeyPath: string): Promise<string> {
    // This would need actual SSH key implementation
    throw new Error('SSH public key derivation not implemented');
  }
}
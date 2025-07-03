import { AuthConfig, AuthChallenge, AuthResponse, SystemUser, RequestOptions } from '../types';
import { BaseService } from './base';

export class AuthService extends BaseService {
  private token?: string;
  private currentUser?: SystemUser;

  constructor(baseUrl: string, options?: { timeout?: number }) {
    super(baseUrl, options);
  }

  /**
   * Get authentication configuration from the server
   */
  async getConfig(): Promise<AuthConfig> {
    return this.request<AuthConfig>('/api/auth/config');
  }

  /**
   * Get current system user information
   */
  async getCurrentUser(): Promise<SystemUser> {
    if (this.currentUser) {
      return this.currentUser;
    }
    
    this.currentUser = await this.request<SystemUser>('/api/auth/current-user');
    return this.currentUser;
  }

  /**
   * Create SSH key authentication challenge
   */
  async createChallenge(): Promise<AuthChallenge> {
    return this.request<AuthChallenge>('/api/auth/challenge', { method: 'POST' });
  }

  /**
   * Authenticate using SSH key
   * @param challengeId - The challenge ID from createChallenge()
   * @param signature - The signed challenge using SSH private key
   * @param publicKey - The SSH public key used for signing
   */
  async authenticateWithSSHKey(
    challengeId: string,
    signature: string,
    publicKey: string
  ): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/auth/ssh-key', {
      method: 'POST',
      body: {
        challengeId,
        signature,
        publicKey
      }
    });

    if (response.success && response.token) {
      this.setAuthToken(response.token);
      this.currentUser = response.user;
    }

    return response;
  }

  /**
   * Authenticate using password
   * @param username - System username
   * @param password - User password
   */
  async authenticateWithPassword(username: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/auth/password', {
      method: 'POST',
      body: {
        username,
        password
      }
    });

    if (response.success && response.token) {
      this.setAuthToken(response.token);
      this.currentUser = response.user;
    }

    return response;
  }

  /**
   * Verify current authentication status
   */
  async verify(): Promise<{ valid: boolean; user?: SystemUser }> {
    if (!this.token) {
      return { valid: false };
    }

    try {
      const user = await this.request<SystemUser>('/api/auth/verify');
      this.currentUser = user;
      return { valid: true, user };
    } catch (error) {
      this.clearAuthToken();
      return { valid: false };
    }
  }

  /**
   * Get user avatar (macOS only)
   * @param userId - User ID
   */
  async getUserAvatar(userId: string): Promise<Buffer> {
    const response = await fetch(`${this.baseUrl}/api/auth/avatar/${userId}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get user avatar: ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Logout and invalidate current token
   */
  async logout(): Promise<void> {
    if (this.token) {
      try {
        await this.request('/api/auth/logout', { method: 'POST' });
      } catch (error) {
        // Continue with logout even if request fails
        console.warn('Logout request failed:', error);
      }
    }
    
    this.clearAuthToken();
    this.currentUser = undefined;
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.token = token;
  }

  /**
   * Get current authentication token
   */
  getAuthToken(): string | undefined {
    return this.token;
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.token = undefined;
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * Get current authenticated user
   */
  getUser(): SystemUser | undefined {
    return this.currentUser;
  }

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }
}
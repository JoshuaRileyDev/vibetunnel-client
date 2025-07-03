import WebSocket from 'ws';
import { 
  Session, 
  SessionCreateOptions, 
  SessionListResponse, 
  SessionActivity, 
  TerminalSize, 
  SessionInputOptions,
  SSEEvent,
  WebSocketMessage,
  ConnectionOptions
} from '../types';
import { BaseService } from './base';
import { EventEmitter } from 'events';

export class SessionService extends BaseService {
  private inputSocket?: WebSocket;
  private bufferSocket?: WebSocket;
  private eventSources: Map<string, EventSource> = new Map();
  private emitter = new EventEmitter();

  constructor(baseUrl: string, options?: { timeout?: number }) {
    super(baseUrl, options);
  }

  /**
   * List all sessions (including remote sessions in HQ mode)
   */
  async listSessions(): Promise<SessionListResponse> {
    return this.request<SessionListResponse>('/api/sessions');
  }

  /**
   * Create a new session
   */
  async createSession(options: SessionCreateOptions = {}): Promise<Session> {
    return this.request<Session>('/api/sessions', {
      method: 'POST',
      body: options
    });
  }

  /**
   * Get session information by ID
   */
  async getSession(sessionId: string): Promise<Session> {
    return this.request<Session>(`/api/sessions/${sessionId}`);
  }

  /**
   * Kill a session
   */
  async killSession(sessionId: string): Promise<void> {
    await this.request(`/api/sessions/${sessionId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Cleanup session files
   */
  async cleanupSession(sessionId: string): Promise<void> {
    await this.request(`/api/sessions/${sessionId}/cleanup`, {
      method: 'DELETE'
    });
  }

  /**
   * Cleanup all exited sessions
   */
  async cleanupExitedSessions(): Promise<{ cleaned: number }> {
    return this.request<{ cleaned: number }>('/cleanup-exited', {
      method: 'POST'
    });
  }

  /**
   * Get session plain text content
   */
  async getSessionText(sessionId: string): Promise<string> {
    return this.request<string>(`/api/sessions/${sessionId}/text`);
  }

  /**
   * Get session buffer content (binary)
   */
  async getSessionBuffer(sessionId: string): Promise<Buffer> {
    return this.requestBuffer(`/api/sessions/${sessionId}/buffer`);
  }

  /**
   * Send input to a session
   */
  async sendInput(sessionId: string, data: string | Buffer): Promise<void> {
    await this.request(`/api/sessions/${sessionId}/input`, {
      method: 'POST',
      body: { data: data.toString() }
    });
  }

  /**
   * Resize session terminal
   */
  async resizeSession(sessionId: string, size: TerminalSize): Promise<void> {
    await this.request(`/api/sessions/${sessionId}/resize`, {
      method: 'POST',
      body: size
    });
  }

  /**
   * Update session (rename)
   */
  async updateSession(sessionId: string, updates: { title?: string }): Promise<Session> {
    return this.request<Session>(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      body: updates
    });
  }

  /**
   * Reset session terminal size
   */
  async resetSessionSize(sessionId: string): Promise<void> {
    await this.request(`/api/sessions/${sessionId}/reset-size`, {
      method: 'POST'
    });
  }

  /**
   * Get activity status for all sessions
   */
  async getSessionsActivity(): Promise<SessionActivity[]> {
    return this.request<SessionActivity[]>('/api/sessions/activity');
  }

  /**
   * Get activity status for specific session
   */
  async getSessionActivity(sessionId: string): Promise<SessionActivity> {
    return this.request<SessionActivity>(`/api/sessions/${sessionId}/activity`);
  }

  /**
   * Stream session output using Server-Sent Events
   */
  streamSessionOutput(
    sessionId: string,
    callback: (event: SSEEvent) => void,
    options: { autoReconnect?: boolean; reconnectInterval?: number } = {}
  ): () => void {
    const eventSourceKey = `stream-${sessionId}`;
    
    const createEventSource = () => {
      const eventSource = this.createEventSource(`/api/sessions/${sessionId}/stream`);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          callback({
            type: event.type || 'message',
            data: data,
            id: event.lastEventId
          });
        } catch (error) {
          callback({
            type: 'error',
            data: `Failed to parse event data: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      };

      eventSource.onerror = (error) => {
        callback({
          type: 'error',
          data: 'EventSource connection error'
        });

        if (options.autoReconnect !== false) {
          setTimeout(() => {
            if (this.eventSources.has(eventSourceKey)) {
              this.eventSources.delete(eventSourceKey);
              createEventSource();
            }
          }, options.reconnectInterval || 1000);
        }
      };

      this.eventSources.set(eventSourceKey, eventSource);
      return eventSource;
    };

    createEventSource();

    // Return cleanup function
    return () => {
      const eventSource = this.eventSources.get(eventSourceKey);
      if (eventSource) {
        eventSource.close();
        this.eventSources.delete(eventSourceKey);
      }
    };
  }

  /**
   * Connect to input WebSocket for real-time input
   */
  connectInputSocket(
    sessionId: string,
    options: ConnectionOptions = {}
  ): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.baseUrl.replace(/^http/, 'ws')}/ws/input?sessionId=${sessionId}`;
      
      const socket = new WebSocket(wsUrl, {
        headers: this.getHeaders()
      });

      socket.on('open', () => {
        this.inputSocket = socket;
        resolve(socket);
      });

      socket.on('error', (error) => {
        reject(error);
      });

      socket.on('close', () => {
        if (this.inputSocket === socket) {
          this.inputSocket = undefined;
        }

        if (options.autoReconnect !== false) {
          setTimeout(() => {
            this.connectInputSocket(sessionId, options);
          }, options.reconnectInterval || 1000);
        }
      });

      socket.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.emitter.emit('message', message);
        } catch (error) {
          this.emitter.emit('error', error);
        }
      });
    });
  }

  /**
   * Send input through WebSocket (for real-time input)
   */
  sendInputSocket(data: string | Buffer): void {
    if (!this.inputSocket || this.inputSocket.readyState !== WebSocket.OPEN) {
      throw new Error('Input socket not connected');
    }

    this.inputSocket.send(data);
  }

  /**
   * Connect to buffer updates WebSocket
   */
  connectBufferSocket(options: ConnectionOptions = {}): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.baseUrl.replace(/^http/, 'ws')}/buffers`;
      
      const socket = new WebSocket(wsUrl, {
        headers: this.getHeaders()
      });

      socket.on('open', () => {
        this.bufferSocket = socket;
        resolve(socket);
      });

      socket.on('error', (error) => {
        reject(error);
      });

      socket.on('close', () => {
        if (this.bufferSocket === socket) {
          this.bufferSocket = undefined;
        }

        if (options.autoReconnect !== false) {
          setTimeout(() => {
            this.connectBufferSocket(options);
          }, options.reconnectInterval || 1000);
        }
      });

      socket.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.emitter.emit('bufferUpdate', message);
        } catch (error) {
          this.emitter.emit('error', error);
        }
      });
    });
  }

  /**
   * Listen for session events
   */
  on(event: 'message' | 'bufferUpdate' | 'error', listener: (data: any) => void): void {
    this.emitter.on(event, listener);
  }

  /**
   * Remove event listener
   */
  off(event: 'message' | 'bufferUpdate' | 'error', listener: (data: any) => void): void {
    this.emitter.off(event, listener);
  }

  /**
   * Disconnect all sockets and event sources
   */
  disconnect(): void {
    // Close input socket
    if (this.inputSocket) {
      this.inputSocket.close();
      this.inputSocket = undefined;
    }

    // Close buffer socket
    if (this.bufferSocket) {
      this.bufferSocket.close();
      this.bufferSocket = undefined;
    }

    // Close all event sources
    for (const [key, eventSource] of this.eventSources) {
      eventSource.close();
    }
    this.eventSources.clear();

    // Remove all listeners
    this.emitter.removeAllListeners();
  }

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Note: Auth token should be set by parent service or client
    return headers;
  }
}
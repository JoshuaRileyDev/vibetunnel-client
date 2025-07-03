export interface VibeTunnelConfig {
  baseUrl: string;
  port?: number;
  authToken?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface AuthConfig {
  enableSSHKeys: boolean;
  disallowUserPassword: boolean;
  noAuth: boolean;
  allowLocalBypass: boolean;
  localAuthToken?: string;
}

export interface SystemUser {
  username: string;
  uid: number;
  gid: number;
  shell: string;
  homeDirectory: string;
}

export interface AuthChallenge {
  challenge: string;
  challengeId: string;
  sshKeyFingerprints: string[];
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: SystemUser;
  error?: string;
}

export interface Session {
  sessionId: string;
  command: string;
  workingDirectory: string;
  status: 'running' | 'exited';
  title?: string;
  pid?: number;
  startTime: string;
  endTime?: string;
  exitCode?: number;
}

export interface SessionCreateOptions {
  command?: string;
  workingDirectory?: string;
  title?: string;
  env?: Record<string, string>;
}

export interface SessionListResponse {
  sessions: Session[];
  remoteSessions?: RemoteSession[];
}

export interface RemoteSession extends Session {
  remoteId: string;
  remoteName: string;
}

export interface SessionActivity {
  sessionId: string;
  isActive: boolean;
  lastActivityTime?: string;
  outputSize: number;
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  isExecutable: boolean;
  modificationTime: string;
  permissions: string;
  gitStatus?: GitStatus;
}

export interface GitStatus {
  staged: boolean;
  modified: boolean;
  untracked: boolean;
  deleted: boolean;
  renamed: boolean;
}

export interface UploadedFile {
  filename: string;
  originalName: string;
  size: number;
  uploadTime: string;
  mimetype: string;
}

export interface VAPIDKeys {
  publicKey: string;
  privateKey: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationStatus {
  enabled: boolean;
  subscriptionsCount: number;
  vapidConfigured: boolean;
}

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface SessionInputOptions {
  sessionId: string;
  data: string | Buffer;
  type?: 'text' | 'key' | 'paste';
}

export interface WebSocketMessage {
  type: 'buffer-update' | 'session-status' | 'error' | 'heartbeat';
  sessionId?: string;
  data?: any;
  timestamp: string;
}

export interface SSEEvent {
  type: string;
  data: string;
  id?: string;
  retry?: number;
}

export interface VibeTunnelError extends Error {
  code?: string;
  statusCode?: number;
  response?: any;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

export interface ConnectionOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  component?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
  sessions: {
    total: number;
    active: number;
  };
  system: {
    memory: {
      used: number;
      total: number;
    };
    cpu: {
      usage: number;
    };
  };
}
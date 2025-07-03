// Main client export
export { VibeTunnelClient } from './client';

// Service exports
export { AuthService } from './services/auth';
export { SessionService } from './services/sessions';
export { FileService } from './services/files';
export { PushService } from './services/push';

// Type exports
export * from './types';

// Utility exports
export { createVibeTunnelClient } from './utils/factory';

// Re-export WebSocket for convenience
export { default as WebSocket } from 'ws';
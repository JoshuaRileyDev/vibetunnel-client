import { VAPIDKeys, PushSubscription, PushNotificationStatus } from '../types';
import { BaseService } from './base';

export class PushService extends BaseService {
  constructor(baseUrl: string, options?: { timeout?: number }) {
    super(baseUrl, options);
  }

  /**
   * Get VAPID public key for push notifications
   */
  async getVAPIDPublicKey(): Promise<{ publicKey: string }> {
    return this.request<{ publicKey: string }>('/api/push/vapid-public-key');
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(subscription: PushSubscription): Promise<{ success: boolean; id: string }> {
    return this.request<{ success: boolean; id: string }>('/api/push/subscribe', {
      method: 'POST',
      body: subscription
    });
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(subscriptionId?: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/push/unsubscribe', {
      method: 'POST',
      body: { subscriptionId }
    });
  }

  /**
   * Send test notification
   */
  async sendTestNotification(
    message: string = 'Test notification from VibeTunnel'
  ): Promise<{ success: boolean; sent: number }> {
    return this.request<{ success: boolean; sent: number }>('/api/push/test', {
      method: 'POST',
      body: { message }
    });
  }

  /**
   * Get push notification service status
   */
  async getStatus(): Promise<PushNotificationStatus> {
    return this.request<PushNotificationStatus>('/api/push/status');
  }

  /**
   * Helper method to create a push subscription using the Web Push API
   * Note: This requires a browser environment with service worker support
   */
  async createPushSubscription(
    serviceWorkerRegistration: ServiceWorkerRegistration
  ): Promise<PushSubscription> {
    const { publicKey } = await this.getVAPIDPublicKey();
    
    const pushSubscription = await serviceWorkerRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(publicKey)
    });

    return {
      endpoint: pushSubscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(pushSubscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64(pushSubscription.getKey('auth')!)
      }
    };
  }

  /**
   * Subscribe to push notifications with automatic subscription creation
   */
  async subscribeWithServiceWorker(
    serviceWorkerRegistration: ServiceWorkerRegistration
  ): Promise<{ success: boolean; id: string }> {
    const subscription = await this.createPushSubscription(serviceWorkerRegistration);
    return this.subscribe(subscription);
  }

  /**
   * Check if push notifications are supported in current environment
   */
  isPushSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }

    return Notification.permission;
  }

  /**
   * Get current notification permission status
   */
  getNotificationPermission(): NotificationPermission | null {
    if (!('Notification' in window)) {
      return null;
    }
    return Notification.permission;
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    };
  }
}
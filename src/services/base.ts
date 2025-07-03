import { RequestOptions, VibeTunnelError } from '../types';

export abstract class BaseService {
  protected baseUrl: string;
  protected timeout: number;

  constructor(baseUrl: string, options?: { timeout?: number }) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = options?.timeout || 30000; // 30 seconds default
  }

  protected async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeout = options.timeout || this.timeout;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          ...this.getHeaders(),
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage: string;
        
        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage = errorJson.error || errorJson.message || response.statusText;
        } catch {
          errorMessage = errorBody || response.statusText;
        }

        const error = new Error(errorMessage) as VibeTunnelError;
        error.code = 'HTTP_ERROR';
        error.statusCode = response.status;
        error.response = errorBody;
        throw error;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text() as unknown as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${timeout}ms`) as VibeTunnelError;
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }

      if (error instanceof Error && (error as VibeTunnelError).code) {
        throw error; // Re-throw VibeTunnelError as-is
      }

      // Wrap other errors
      const wrappedError = new Error(`Request failed: ${error instanceof Error ? error.message : String(error)}`) as VibeTunnelError;
      wrappedError.code = 'REQUEST_FAILED';
      throw wrappedError;
    }
  }

  protected async requestWithRetry<T>(
    endpoint: string,
    options: RequestOptions = {},
    retries: number = 3
  ): Promise<T> {
    let lastError: VibeTunnelError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.request<T>(endpoint, options);
      } catch (error) {
        lastError = error as VibeTunnelError;
        
        // Don't retry on authentication errors or client errors (4xx)
        if (lastError.statusCode && lastError.statusCode >= 400 && lastError.statusCode < 500) {
          throw lastError;
        }

        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  protected async requestBuffer(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<Buffer> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeout = options.timeout || this.timeout;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          ...this.getHeaders(),
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  protected createEventSource(endpoint: string): EventSource {
    const url = `${this.baseUrl}${endpoint}`;
    const eventSource = new EventSource(url);
    return eventSource;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected abstract getHeaders(): Record<string, string>;
}
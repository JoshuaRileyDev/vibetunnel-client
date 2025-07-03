import { FileInfo, UploadedFile } from '../types';
import { BaseService } from './base';
import { createReadStream } from 'fs';
import { basename } from 'path';

export class FileService extends BaseService {
  constructor(baseUrl: string, options?: { timeout?: number }) {
    super(baseUrl, options);
  }

  /**
   * Browse directory with Git status
   */
  async browseDirectory(path: string = '.'): Promise<FileInfo[]> {
    const params = new URLSearchParams({ path });
    return this.request<FileInfo[]>(`/api/fs/browse?${params}`);
  }

  /**
   * Get file preview
   */
  async getFilePreview(
    path: string,
    options: { maxSize?: number; encoding?: string } = {}
  ): Promise<{ content: string; isBinary: boolean; size: number }> {
    const params = new URLSearchParams({ path });
    if (options.maxSize) params.append('maxSize', options.maxSize.toString());
    if (options.encoding) params.append('encoding', options.encoding);
    
    return this.request<{ content: string; isBinary: boolean; size: number }>(
      `/api/fs/preview?${params}`
    );
  }

  /**
   * Get raw file content as buffer
   */
  async getRawFileContent(path: string): Promise<Buffer> {
    const params = new URLSearchParams({ path });
    return this.requestBuffer(`/api/fs/raw?${params}`);
  }

  /**
   * Get file content as text
   */
  async getFileContent(
    path: string,
    encoding: string = 'utf8'
  ): Promise<{ content: string; encoding: string }> {
    const params = new URLSearchParams({ path, encoding });
    return this.request<{ content: string; encoding: string }>(
      `/api/fs/content?${params}`
    );
  }

  /**
   * Get Git diff for file
   */
  async getFileDiff(
    path: string,
    options: { staged?: boolean; cached?: boolean } = {}
  ): Promise<{ diff: string; hasChanges: boolean }> {
    const params = new URLSearchParams({ path });
    if (options.staged) params.append('staged', 'true');
    if (options.cached) params.append('cached', 'true');
    
    return this.request<{ diff: string; hasChanges: boolean }>(
      `/api/fs/diff?${params}`
    );
  }

  /**
   * Get file content for diff view
   */
  async getDiffContent(
    path: string,
    version: 'working' | 'staged' | 'head' = 'working'
  ): Promise<{ content: string; exists: boolean }> {
    const params = new URLSearchParams({ path, version });
    return this.request<{ content: string; exists: boolean }>(
      `/api/fs/diff-content?${params}`
    );
  }

  /**
   * Create directory
   */
  async createDirectory(path: string, recursive: boolean = false): Promise<{ created: boolean; path: string }> {
    return this.request<{ created: boolean; path: string }>('/api/fs/mkdir', {
      method: 'POST',
      body: { path, recursive }
    });
  }

  /**
   * Upload file using FormData
   */
  async uploadFile(
    filePath: string,
    options: { 
      fileName?: string;
      targetPath?: string;
      overwrite?: boolean;
    } = {}
  ): Promise<UploadedFile> {
    const formData = new FormData();
    
    // Read file and create blob
    const fileBuffer = await this.readFileBuffer(filePath);
    const fileName = options.fileName || basename(filePath);
    const blob = new Blob([fileBuffer]);
    
    formData.append('file', blob, fileName);
    if (options.targetPath) {
      formData.append('targetPath', options.targetPath);
    }
    if (options.overwrite) {
      formData.append('overwrite', 'true');
    }

    const response = await fetch(`${this.baseUrl}/api/files/upload`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders() // Only auth headers, not Content-Type for FormData
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Upload file from buffer
   */
  async uploadFileFromBuffer(
    buffer: Buffer,
    fileName: string,
    options: {
      targetPath?: string;
      overwrite?: boolean;
      mimeType?: string;
    } = {}
  ): Promise<UploadedFile> {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: options.mimeType });
    
    formData.append('file', blob, fileName);
    if (options.targetPath) {
      formData.append('targetPath', options.targetPath);
    }
    if (options.overwrite) {
      formData.append('overwrite', 'true');
    }

    const response = await fetch(`${this.baseUrl}/api/files/upload`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get uploaded file content
   */
  async getUploadedFile(fileName: string): Promise<Buffer> {
    return this.requestBuffer(`/api/files/${fileName}`);
  }

  /**
   * List uploaded files
   */
  async listUploadedFiles(): Promise<UploadedFile[]> {
    return this.request<UploadedFile[]>('/api/files');
  }

  /**
   * Delete uploaded file
   */
  async deleteUploadedFile(fileName: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/api/files/${fileName}`, {
      method: 'DELETE'
    });
  }

  /**
   * Download file as buffer
   */
  async downloadFile(remotePath: string): Promise<Buffer> {
    return this.getRawFileContent(remotePath);
  }

  /**
   * Check if path exists and get info
   */
  async getPathInfo(path: string): Promise<FileInfo | null> {
    try {
      const files = await this.browseDirectory(path);
      // If browsing returns results, the path exists as a directory
      return {
        name: basename(path),
        path: path,
        size: 0,
        isDirectory: true,
        isExecutable: false,
        modificationTime: new Date().toISOString(),
        permissions: 'drwxr-xr-x'
      };
    } catch (error) {
      // Try to get file info by browsing parent directory
      const parentPath = path.substring(0, path.lastIndexOf('/')) || '.';
      const fileName = basename(path);
      
      try {
        const files = await this.browseDirectory(parentPath);
        return files.find(file => file.name === fileName) || null;
      } catch {
        return null;
      }
    }
  }

  private async readFileBuffer(filePath: string): Promise<Buffer> {
    // This is a simplified version - in a real implementation,
    // you'd use fs.readFile or handle streams properly
    const fs = await import('fs/promises');
    return fs.readFile(filePath);
  }

  private getAuthHeaders(): Record<string, string> {
    // This will be set by the main client with auth token
    return {};
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders()
    };
  }
}
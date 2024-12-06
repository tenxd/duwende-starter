import { Tool } from 'duwende';
import fs from 'fs/promises';
import path from 'path';

export class FileSystemTool extends Tool {
  constructor(params) {
    super(params);
  }

  async use(params) {
    const { action, path: filePath, content } = params;

    switch (action) {
      case 'read':
        return this.readFile(filePath);
      case 'list':
        return this.listFiles(filePath);
      case 'write':
        return this.writeFile(filePath, content);
      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  }

  async readFile(filePath) {
    try {
      const content = await fs.readFile(filePath);
      const mimeType = this.getMimeType(filePath);
      return { status: 200, content, mimeType };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { status: 404 };
      }
      throw error;
    }
  }

  async listFiles(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      return { status: 200, files };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { status: 404 };
      }
      throw error;
    }
  }

  async writeFile(filePath, content) {
    try {
      await fs.writeFile(filePath, content);
      return { status: 200, message: 'File written successfully' };
    } catch (error) {
      return { status: 500, message: `Error writing file: ${error.message}` };
    }
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  static init_schema() {
    return {};
  }

  static in_schema() {
    return {
      action: { type: 'string', required: true },
      path: { type: 'string', required: true },
      content: { type: 'string', required: false }
    };
  }

  static out_schema() {
    return {
      status: { type: 'number' },
      content: { type: 'string', required: false },
      mimeType: { type: 'string', required: false },
      files: { type: 'array', required: false },
      message: { type: 'string', required: false }
    };
  }

  static about() {
    return 'A tool for reading static files, listing directory contents, and writing files.';
  }
}

export const file_system_tool = FileSystemTool;

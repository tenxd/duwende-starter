import { Tool } from 'duwende';
import bcrypt from 'bcryptjs';

export class BcryptTool extends Tool {
  constructor(params) {
    super(params);
    this.saltRounds = params.saltRounds || 10;
  }

  async use(params) {
    const { action, password, hash } = params;

    try {
      switch (action) {
        case 'hash':
          return this.hashPassword(password);
        case 'compare':
          return this.comparePassword(password, hash);
        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    } catch (error) {
      return {
        status: 400,
        content: `Error: ${error.message}`
      };
    }
  }

  async hashPassword(password) {
    try {
      const hash = await bcrypt.hash(password, this.saltRounds);
      return {
        status: 200,
        content: hash
      };
    } catch (error) {
      return {
        status: 500,
        content: `Failed to hash password: ${error.message}`
      };
    }
  }

  async comparePassword(password, hash) {
    try {
      const match = await bcrypt.compare(password, hash);
      return {
        status: 200,
        content: match
      };
    } catch (error) {
      return {
        status: 500,
        content: `Failed to compare password: ${error.message}`
      };
    }
  }

  static init_schema() {
    return {
      saltRounds: { type: 'number', required: false }
    };
  }

  static in_schema() {
    return {
      action: {
        type: 'string',
        required: true,
        enum: ['hash', 'compare']
      },
      password: { type: 'string', required: true },
      hash: { type: 'string', required: false }
    };
  }

  static out_schema() {
    return {
      type: 'object',
      properties: {
        status: { type: 'number' },
        content: { type: 'any' }
      }
    };
  }

  static about() {
    return 'This tool provides bcrypt operations for password hashing and verification. It supports hashing passwords with configurable salt rounds and comparing plain text passwords with hashed values.';
  }
}

export const bcrypt_tool = BcryptTool;

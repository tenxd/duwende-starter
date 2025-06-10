import { Tool } from 'duwende';
import jwt from 'jsonwebtoken';

export class JWTTool extends Tool {
  constructor(params) {
    super(params);
    this.secretKey = params.secretKey || 'default_secret_key';
  }

  async use(params) {
    const { action, payload, token, cookies, headers, cookieName, expiresIn } = params;

    try {
      switch (action) {
        case 'sign':
          return this.signToken(payload, expiresIn);
        case 'verify': {
          // Try Authorization header first
          if (headers?.get('authorization')) {
            const authHeader = headers.get('authorization');
            if (authHeader.startsWith('Bearer ')) {
              const bearerToken = authHeader.substring(7);
              return this.verifyToken(bearerToken);
            }
          }

          // Then try cookies
          if (cookies) {
            if (headers?.get('cookie')) {
              const tokenName = cookieName || 'jwt-token';
              const cookieStr = headers.get('cookie');
              const cookies = cookieStr.split(';').map(c => c.trim());
              const tokenCookie = cookies.find(c => c.startsWith(`${tokenName}=`) || c.startsWith(`${tokenName} =`));
              if (tokenCookie) {
                const [name, ...valueParts] = tokenCookie.split('=');
                const cookieToken = valueParts.join('=').trim();
                return this.verifyToken(cookieToken);
              }
            }
          }

          // Finally try token parameter
          if (token) {
            return this.verifyToken(token);
          }

          return {
            status: 401,
            content: 'No JWT token found in Authorization header, cookies, or token parameter'
          };
        }
        case 'decode':
          return this.decodeToken(token);
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

  signToken(payload, expiresIn) {
    const token = jwt.sign(payload || {}, this.secretKey,  {expiresIn});
    return {
      status: 200,
      content: token
    };
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.secretKey);
      return {
        status: 200,
        content: decoded
      };
    } catch (error) {
      return {
        status: 401,
        content: 'Invalid token'
      };
    }
  }

  decodeToken(token) {
    const decoded = jwt.decode(token, { complete: true });
    return {
      status: 200,
      content: decoded
    };
  }

  static init_schema() {
    return {
      secretKey: { type: 'string', required: false }
    };
  }

  static in_schema() {
    return {
      action: { 
        type: 'string', 
        required: true, 
        enum: ['sign', 'verify', 'decode'] 
      },
      payload: { type: 'object', required: false },
      token: { type: 'string', required: false },
      cookies: { type: 'object', required: false },
      headers: { type: 'object', required: false },
      cookieName: { type: 'string', required: false }
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
    return 'This tool provides JWT operations including signing, verifying, and decoding tokens. The verify action automatically checks Authorization headers, cookies, and the token parameter in that order.';
  }
}

export const jwt_tool = JWTTool;

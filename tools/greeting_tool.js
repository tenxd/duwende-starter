import { Tool } from 'duwende';

export class GreetingTool extends Tool {
  constructor(params) {
    super(params);
    this.defaultGreeting = params.defaultGreeting || 'Hello';
  }

  async use(params) {
    try {
      const greeting = this.defaultGreeting;
      const name = params.name || 'World';
      
      return {
        status: 200,
        content: `${greeting}, ${name}!`
      };
    } catch (error) {
      return {
        status: 500,
        content: error.message
      };
    }
  }

  static init_schema() {
    return {
      defaultGreeting: { type: 'string', required: false }
    };
  }

  static in_schema() {
    return {
      name: { type: 'string', required: false }
    };
  }

  static out_schema() {
    return {
      type: 'object',
      properties: {
        status: { type: 'number' },
        content: { type: 'string' }
      }
    };
  }

  static about() {
    return 'A simple greeting tool that generates personalized greetings';
  }
}

export const greeting_tool = GreetingTool;

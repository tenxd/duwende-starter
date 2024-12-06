import { Resource } from 'duwende';

export class User extends Resource {
  constructor(hostname, service, name, config) {
    super(hostname, service, name, config);
    this.greetingTool = Resource.tools['greeting_tool'].tool;
    this.mustacheTool = Resource.tools['mustache_tool'].tool;
  }

  async handleGet(request, id) {
    try {
      const greeter = new this.greetingTool({ defaultGreeting: this.config.defaultGreeting });
      const user = { id, name: id };
      const greeting = await greeter.use({ name: user.name });
      
      return new Response(JSON.stringify({
        user,
        greeting: greeting.content
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error in User resource:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async handleList(request) {
    try {
      const greeter = new this.greetingTool({ defaultGreeting: this.config.defaultGreeting });
      const user = { name: 'Guest' };
      const greeting = await greeter.use({ name: user.name });
      
      return new Response(JSON.stringify({
        user,
        greeting: greeting.content
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error in User resource:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async renderGet(request, id) {
    try {
      const greeter = new this.greetingTool({ defaultGreeting: this.config.defaultGreeting });
      const user = { id, name: id };
      const greeting = await greeter.use({ name: user.name });

      const renderer = new this.mustacheTool({ baseDir: 'views' });
      const result = await renderer.use({
        templatePath: 'user/greeting.mustache',
        data: { greeting: greeting.content }
      });
      
      return new Response(result.renderedContent, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    } catch (error) {
      console.error('Error in User resource:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  async renderList(request) {
    try {
      const greeter = new this.greetingTool({ defaultGreeting: this.config.defaultGreeting });
      const user = { name: 'Guest' };
      const greeting = await greeter.use({ name: user.name });

      const renderer = new this.mustacheTool({ baseDir: 'views' });
      const result = await renderer.use({
        templatePath: 'user/greeting.mustache',
        data: { greeting: greeting.content }
      });
      
      return new Response(result.renderedContent, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    } catch (error) {
      console.error('Error in User resource:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
}

export const user = User;

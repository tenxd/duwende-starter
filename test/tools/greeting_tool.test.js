import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Server, Resource, Tool } from 'duwende';
import { GreetingTool, greeting_tool } from '../../tools/greeting_tool.js';

describe("GreetingTool Tests", () => {
  let server;

  // Setup server before tests
  beforeAll(async () => {
    try {
      server = new Server();
      await server.loadConfig();
      await server.loadTools();
      
      // Detailed logging of Resource.tools
      console.log('Resource.tools:', Resource.tools);
      console.log('Resource.tools type:', typeof Resource.tools);
      console.log('Resource.tools keys:', Object.keys(Resource.tools));
      console.log('Resource.tools entries:', Object.entries(Resource.tools));
    } catch (error) {
      console.error('Setup error:', error);
      throw error;
    }
  });

  // Cleanup after tests
  afterAll(() => {
    if (server) {
      server.stop();
    }
  });

  test("should properly extend Tool class", () => {
    expect(GreetingTool.prototype instanceof Tool).toBe(true);
  });

  test("tool should be loaded by server", () => {
    console.log('Resource.tools in test:', Resource.tools);
    expect(Resource.tools).toBeDefined();
    expect(Resource.tools['greeting_tool']).toBeDefined();
    expect(Resource.tools['greeting_tool'].tool).toBe(GreetingTool);
  });

  test("tool initialization with default params", () => {
    const tool = new GreetingTool({});
    expect(tool.defaultGreeting).toBe('Hello');
  });

  test("tool initialization with custom params", () => {
    const tool = new GreetingTool({ defaultGreeting: 'Hi' });
    expect(tool.defaultGreeting).toBe('Hi');
  });

  test("tool use with default parameters", async () => {
    const tool = new GreetingTool({});
    const result = await tool.use({});
    
    expect(result.status).toBe(200);
    expect(result.content).toBe('Hello, World!');
  });

  test("tool use with custom name", async () => {
    const tool = new GreetingTool({});
    const result = await tool.use({ name: 'Test' });
    
    expect(result.status).toBe(200);
    expect(result.content).toBe('Hello, Test!');
  });

  test("tool use with custom greeting and name", async () => {
    const tool = new GreetingTool({ defaultGreeting: 'Hi' });
    const result = await tool.use({ name: 'Test' });
    
    expect(result.status).toBe(200);
    expect(result.content).toBe('Hi, Test!');
  });
});

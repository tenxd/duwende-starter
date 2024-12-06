import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Server, Resource } from 'duwende';

describe("User Resource Tests", () => {
  let server;
  const PORT = 3456;
  const BASE_URL = `http://localhost:${PORT}`;

  // Setup server before tests
  beforeAll(async () => {
    try {
      server = new Server();
      await server.loadConfig();
      await server.loadTools();
      await server.start(PORT);
      console.log(`Test server running on ${BASE_URL}`);
    } catch (error) {
      console.error('Setup error:', error);
      throw error;
    }
  });

  // Cleanup after tests
  afterAll(() => {
    if (server) {
      server.stop();
      console.log('Test server stopped');
    }
  });

  test("should handle GET request with ID", async () => {
    console.log('\nTesting GET /api/user/john:');
    const url = `${BASE_URL}/api/user/john`;
    console.log('Request URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error('Response not OK:', await response.text());
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Response body:', JSON.stringify(data, null, 2));
    
    expect(response.status).toBe(200);
    expect(data.user.id).toBe("john");
    expect(data.user.name).toBe("john");
    expect(data.greeting).toBe("Welcome, john!");
  });

  test("should handle request without ID (LIST)", async () => {
    console.log('\nTesting GET /api/user (LIST):');
    const url = `${BASE_URL}/api/user`;
    console.log('Request URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error('Response not OK:', await response.text());
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Response body:', JSON.stringify(data, null, 2));
    
    expect(response.status).toBe(200);
    expect(data.user.name).toBe("Guest");
    expect(data.greeting).toBe("Welcome, Guest!");
  });
});

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { Tool } from 'duwende';
import { SqlTool } from "../../tools/sql_tool.js";

describe("SqlTool", () => {
  test("should properly extend Tool class", () => {
    expect(SqlTool.prototype instanceof Tool).toBe(true);
  });

  describe("SQLite Tests", () => {
    let sqliteTool;

    beforeEach(async () => {
      sqliteTool = new SqlTool({
        type: "sqlite",
        dbPath: ":memory:",
        initialization: `
          DROP TABLE IF EXISTS test_table;
          CREATE TABLE test_table (
            id INTEGER PRIMARY KEY,
            name TEXT
          );
        `
      });
      await sqliteTool.initialize();
    });

    afterEach(() => {
      if (sqliteTool) {
        sqliteTool.cleanup();
      }
    });

    test('should execute basic queries', async () => {
      const result = await sqliteTool.use({
        query: 'SELECT 1 as test'
      });

      expect(result.status).toBe(200);
      expect(result.content.success).toBe(true);
      expect(result.content.rows).toEqual([{ test: 1 }]);
    });

    test('should create and query a table', async () => {
      // Insert data
      const insertResult = await sqliteTool.use({
        query: 'INSERT INTO test_table (name) VALUES (?)',
        values: ['Test Name']
      });

      expect(insertResult.status).toBe(200);
      expect(insertResult.content.success).toBe(true);

      // Query data
      const selectResult = await sqliteTool.use({
        query: 'SELECT * FROM test_table'
      });

      expect(selectResult.status).toBe(200);
      expect(selectResult.content.success).toBe(true);
      expect(selectResult.content.rows).toEqual([{
        id: 1,
        name: 'Test Name'
      }]);
    });
  });

  describe("PostgreSQL Tests", () => {
    let postgresTool;

    beforeAll(async () => {
      postgresTool = new SqlTool({
        type: "postgresql",
        host: "localhost",
        user: "postgres",
        password: "postgres",
        database: "duwende-test",
        port: 5432,
        initialization: `
          DROP TABLE IF EXISTS test_table;
          CREATE TABLE test_table (
            id SERIAL PRIMARY KEY,
            name TEXT
          );
        `
      });
      await postgresTool.initialize();
    });

    afterAll(() => {
      if (postgresTool) {
        postgresTool.cleanup();
      }
    });

    test('should execute basic queries', async () => {
      const result = await postgresTool.use({
        query: 'SELECT 1 as test'
      });
      expect(result.status).toBe(200);
      expect(result.content.success).toBe(true);
      expect(result.content.rows).toEqual([{ test: 1 }]);
    });

    test('should create and query a table', async () => {
      // Insert data
      const insertResult = await postgresTool.use({
        query: 'INSERT INTO test_table (name) VALUES ($1) RETURNING *',
        values: ['Test Name']
      });

      expect(insertResult.status).toBe(200);
      expect(insertResult.content.success).toBe(true);

      // Query data
      const selectResult = await postgresTool.use({
        query: 'SELECT * FROM test_table'
      });

      expect(selectResult.status).toBe(200);
      expect(selectResult.content.success).toBe(true);
      expect(selectResult.content.rows).toEqual([{
        id: 1,
        name: 'Test Name'
      }]);
    });
  });

  describe("MySQL Tests", () => {
    let mysqlTool;

    beforeAll(async () => {
      // Now create the actual connection
      mysqlTool = new SqlTool({
        type: "mysql",
        host: "localhost",
        user: "root",
        password: "root",
        database: "duwende-test",
        port: 3306,
        initialization: `
          DROP TABLE IF EXISTS test_table;
        `
      });
      await mysqlTool.initialize();
    });

    afterAll(() => {
      if (mysqlTool) {
        mysqlTool.cleanup();
      }
    });

    test('should create table', async () => {
      const result = await mysqlTool.use({
        query: "CREATE TABLE test_table (id INT AUTO_INCREMENT PRIMARY KEY, name TEXT);"
      });

      expect(result.status).toBe(200);
      expect(result.content.success).toBe(true);
    });

    

    test('should execute basic queries', async () => {
      const result = await mysqlTool.use({
        query: 'SELECT 1 as test'
      });

      expect(result.status).toBe(200);
      expect(result.content.success).toBe(true);
      expect(result.content.rows).toEqual([{ test: 1 }]);
    });

    test('should create and query a table', async () => {
      // Insert data
      const insertResult = await mysqlTool.use({
        query: 'INSERT INTO test_table (name) VALUES (?)',
        values: ['Test Name']
      });

      expect(insertResult.status).toBe(200);
      expect(insertResult.content.success).toBe(true);

      // Query data
      const selectResult = await mysqlTool.use({
        query: 'SELECT * FROM test_table'
      });

      expect(selectResult.status).toBe(200);
      expect(selectResult.content.success).toBe(true);
      expect(selectResult.content.rows).toEqual([{
        id: 1,
        name: 'Test Name'
      }]);
    });
  });

  describe("Schema Validation", () => {
    test("should have valid init schema", () => {
      const schema = SqlTool.init_schema();
      expect(schema.type).toBeDefined();
      expect(schema.type.type).toBe("string");
      expect(schema.type.required).toBe(true);
      
      // PostgreSQL and MySQL specific
      expect(schema.host).toBeDefined();
      expect(schema.host.type).toBe("string");
      expect(schema.host.required).toBe(false);
      expect(schema.user).toBeDefined();
      expect(schema.user.type).toBe("string");
      expect(schema.user.required).toBe(false);
      expect(schema.password).toBeDefined();
      expect(schema.password.type).toBe("string");
      expect(schema.password.required).toBe(false);
      expect(schema.database).toBeDefined();
      expect(schema.database.type).toBe("string");
      expect(schema.database.required).toBe(false);
      expect(schema.port).toBeDefined();
      expect(schema.port.type).toBe("number");
      expect(schema.port.required).toBe(false);
      
      // SQLite specific
      expect(schema.dbPath).toBeDefined();
      expect(schema.dbPath.type).toBe("string");
      expect(schema.dbPath.required).toBe(false);
      
      // Common
      expect(schema.initialization).toBeDefined();
      expect(schema.initialization.type).toBe("string");
      expect(schema.initialization.required).toBe(false);
    });

    test("should have valid in schema", () => {
      const schema = SqlTool.in_schema();
      expect(schema.query).toBeDefined();
      expect(schema.query.type).toBe("string");
      expect(schema.query.required).toBe(true);
      expect(schema.values).toBeDefined();
      expect(schema.values.type).toBe("array");
      expect(schema.values.required).toBe(false);
    });

    test("should have valid out schema", () => {
      const schema = SqlTool.out_schema();
      expect(schema.type).toBe("object");
      expect(schema.properties.status).toBeDefined();
      expect(schema.properties.content).toBeDefined();
      expect(schema.required).toContain("status");
      expect(schema.required).toContain("content");
    });
  });

  describe("About Method", () => {
    test("should return a non-empty description", () => {
      expect(typeof SqlTool.about()).toBe("string");
      expect(SqlTool.about().length).toBeGreaterThan(0);
    });

    test("should include key features in description", () => {
      const description = SqlTool.about();
      expect(description).toContain("SQL");
      expect(description).toContain("database");
    });
  });

  describe("Error Handling", () => {
    let tool;

    beforeEach(async () => {
      tool = new SqlTool({
        type: "sqlite",
        dbPath: ":memory:"
      });
      await tool.initialize();
    });

    afterEach(() => {
      if (tool) {
        tool.cleanup();
      }
    });

    test("should handle invalid queries", async () => {
      const result = await tool.use({
        query: "INVALID SQL QUERY"
      });

      expect(result.status).toBe(400);
      expect(result.content.success).toBe(false);
      expect(result.content.error).toBeDefined();
    });

    test("should handle missing table errors", async () => {
      const result = await tool.use({
        query: "SELECT * FROM non_existent_table"
      });

      expect(result.status).toBe(400);
      expect(result.content.success).toBe(false);
      expect(result.content.error).toBeDefined();
    });

    test("should handle empty input", async () => {
      const result = await tool.use({});
      expect(result.status).toBe(400);
      expect(result.content.error).toBe("Query is required");
    });

    test("should validate database type", () => {
      expect(() => new SqlTool({ type: "invalid" }))
        .toThrow("Unsupported database type");
    });
  });
});

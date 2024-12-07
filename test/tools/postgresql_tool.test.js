import { describe, expect, test, beforeEach, beforeAll, afterAll } from "bun:test";
import { Tool } from 'duwende';
import { PostgreSQLTool } from "../../tools/postgresql_tool.js";

describe("PostgreSQLTool", () => {
  let pgTool;

  test("should properly extend Tool class", () => {
    expect(PostgreSQLTool.prototype instanceof Tool).toBe(true);
  });

  beforeAll(() => {
    pgTool = new PostgreSQLTool({
      host: "localhost",
      user: "duwende",
      password: "duwende",
      database: "duwende-test",
      port: 5432,
      minConn: 1,
      maxConn: 10,
      initialization:
        "CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL);",
    });
  });

  afterAll(async () => {
    if (pgTool && pgTool.pool) {
      await pgTool.pool.end();
    }
  });

  beforeEach(async () => {
    // Clear the table and ensure it succeeds
    const deleteResult = await pgTool.use({
      query: "DELETE FROM test_table",
    });
    console.log("DELETE operation result:", deleteResult);

    if (deleteResult.status !== 200) {
      throw new Error("Failed to clear test_table before test.");
    }

    // Confirm the table is empty before starting the test
    const result = await pgTool.use({
      query: "SELECT * FROM test_table",
    });
    console.log("Current state of test_table:", result.content.rows);
    if (result.content.rows.length !== 0) {
      throw new Error("test_table is not empty before test.");
    }
  });

  describe("Basic Query Execution", () => {
    test("should execute a query successfully", async () => {
      const insertResult = await pgTool.use({
        query: "INSERT INTO test_table (name) VALUES ($1) RETURNING *",
        values: ["Test Name"],
      });

      expect(insertResult.status).toBe(200);
      expect(insertResult.content.affectedRows).toBe(1);
      expect(insertResult.content.rows[0]).toHaveProperty("name", "Test Name");

      const selectResult = await pgTool.use({
        query: "SELECT * FROM test_table WHERE name = $1",
        values: ["Test Name"],
      });

      expect(selectResult.status).toBe(200);
      expect(selectResult.content.rows).toHaveLength(1);
      expect(selectResult.content.rows[0]).toHaveProperty("name", "Test Name");
    });

    test("should handle large datasets", async () => {
      // Insert 1000 records
      const values = Array.from({ length: 1000 }, (_, i) => 
        `('User${i}')`
      ).join(',');
      
      const insertResult = await pgTool.use({
        query: `INSERT INTO test_table (name) VALUES ${values}`
      });

      expect(insertResult.status).toBe(200);
      expect(insertResult.content.affectedRows).toBe(1000);

      const countResult = await pgTool.use({
        query: 'SELECT COUNT(*) as count FROM test_table'
      });

      expect(countResult.status).toBe(200);
      expect(countResult.content.rows[0].count).toBe('1000');
    });

    test("should handle concurrent operations", async () => {
      // Create multiple concurrent operations
      const operations = Array.from({ length: 10 }, (_, i) => 
        pgTool.use({
          query: 'INSERT INTO test_table (name) VALUES ($1) RETURNING *',
          values: [`User${i}`]
        })
      );

      // Execute all operations concurrently
      const results = await Promise.all(operations);

      // Verify all operations succeeded
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.content.affectedRows).toBe(1);
      });

      // Verify final state
      const countResult = await pgTool.use({
        query: 'SELECT COUNT(*) as count FROM test_table'
      });
      expect(countResult.content.rows[0].count).toBe('10');
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid queries", async () => {
      const result = await pgTool.use({
        query: "INVALID SQL QUERY",
      });

      expect(result.status).toBe(400);
      expect(result.content.error).toBeDefined();
    });

    test("should handle errors for non-existent tables", async () => {
      const result = await pgTool.use({
        query: "SELECT * FROM non_existent_table",
      });

      expect(result.status).toBe(400);
      expect(result.content.error).toBeDefined();
    });

    test("should handle empty input gracefully", async () => {
      const result = await pgTool.use({
        query: "INSERT INTO test_table (name) VALUES (NULL) RETURNING *",
      });

      expect(result.status).toBe(400);
      expect(result.content.error).toBeDefined();
    });

    test("should prevent SQL injection", async () => {
      const result = await pgTool.use({
        query: "SELECT * FROM test_table WHERE name = $1",
        values: ["Test Name'; DROP TABLE test_table; --"],
      });

      expect(result.status).toBe(400);
      expect(result.content.error).toBeDefined();
    });

    test("should handle parameter binding errors", async () => {
      const result = await pgTool.use({
        query: "SELECT * FROM test_table WHERE name = $1"
        // Missing values array
      });

      expect(result.status).toBe(400);
      expect(result.content.error).toBeDefined();
    });
  });

  describe("Transaction Handling", () => {
    test("should handle transaction rollback on error", async () => {
      // First create a valid record
      await pgTool.use({
        query: 'INSERT INTO test_table (name) VALUES ($1)',
        values: ['Test Name']
      });

      // Try to insert a duplicate (will fail due to unique constraint)
      const result = await pgTool.use({
        query: `
          BEGIN;
          INSERT INTO test_table (name) VALUES ($1);
          INSERT INTO test_table (name) VALUES ($1);
          COMMIT;
        `,
        values: ['Test Name']
      });

      expect(result.status).toBe(400);
      expect(result.content.error).toBeDefined();

      // Verify only one record exists
      const countResult = await pgTool.use({
        query: 'SELECT COUNT(*) as count FROM test_table'
      });
      expect(countResult.content.rows[0].count).toBe('1');
    });
  });

  describe("Schema Validation", () => {
    test("should have valid init schema", () => {
      const schema = PostgreSQLTool.init_schema();
      expect(schema.host).toBeDefined();
      expect(schema.host.type).toBe("string");
      expect(schema.host.required).toBe(true);
      expect(schema.user).toBeDefined();
      expect(schema.user.type).toBe("string");
      expect(schema.user.required).toBe(true);
      expect(schema.password).toBeDefined();
      expect(schema.password.type).toBe("string");
      expect(schema.password.required).toBe(true);
      expect(schema.database).toBeDefined();
      expect(schema.database.type).toBe("string");
      expect(schema.database.required).toBe(true);
      expect(schema.port).toBeDefined();
      expect(schema.port.type).toBe("number");
      expect(schema.port.required).toBe(true);
      expect(schema.minConn).toBeDefined();
      expect(schema.minConn.type).toBe("number");
      expect(schema.minConn.required).toBe(true);
      expect(schema.maxConn).toBeDefined();
      expect(schema.maxConn.type).toBe("number");
      expect(schema.maxConn.required).toBe(true);
      expect(schema.initialization).toBeDefined();
      expect(schema.initialization.type).toBe("string");
      expect(schema.initialization.required).toBe(false);
    });

    test("should have valid in schema", () => {
      const schema = PostgreSQLTool.in_schema();
      expect(schema.query).toBeDefined();
      expect(schema.query.type).toBe("string");
      expect(schema.query.required).toBe(true);
      expect(schema.values).toBeDefined();
      expect(schema.values.type).toBe("array");
      expect(schema.values.required).toBe(false);
    });

    test("should have valid out schema", () => {
      const schema = PostgreSQLTool.out_schema();
      expect(schema.type).toBe("object");
      expect(schema.properties.status).toBeDefined();
      expect(schema.properties.content).toBeDefined();
    });
  });

  describe("About Method", () => {
    test("should return a non-empty description", () => {
      expect(typeof PostgreSQLTool.about()).toBe("string");
      expect(PostgreSQLTool.about().length).toBeGreaterThan(0);
    });

    test("should include key features in description", () => {
      const description = PostgreSQLTool.about();
      expect(description).toContain("PostgreSQL");
      expect(description).toContain("database");
    });
  });
});

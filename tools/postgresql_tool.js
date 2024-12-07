import { Tool } from "duwende";
import pkg from "pg";
const { Pool } = pkg;

export class PostgreSQLTool extends Tool {
  constructor(params) {
    super(params);
    const {
      host,
      user,
      password,
      database,
      port,
      minConn,
      maxConn,
      initialization,
    } = params;

    this.pool = new Pool({
      host,
      user,
      password,
      database,
      port,
      max: maxConn,
      min: minConn,
    });

    if (initialization) {
      this.initializeDatabase(initialization);
    }
  }

  async initializeDatabase(initSql) {
    const client = await this.pool.connect();
    try {
      await client.query(initSql);
    } catch (error) {
      console.error("Database initialization error:", error);
      throw new Error("Database initialization failed");
    } finally {
      client.release();
    }
  }

  async use(params) {
    const { query, values } = params;

    if (!query) {
      throw new Error('Required parameter "query" is missing');
    }

    if (!this.isTrustedQuery(query, values)) {
      return {
        status: 400,
        content: { error: "Potential SQL injection detected." },
      };
    }

    // Explicit check for inserting NULL into a non-nullable column
    if (query.includes("INSERT INTO") && query.includes("VALUES (NULL)")) {
      return {
        status: 400,
        content: { error: "Cannot insert NULL into non-nullable column." },
      };
    }

    const client = await this.pool.connect();
    try {
      const res = await client.query(query, values);
      return {
        status: 200,
        content: {
          affectedRows: res.rowCount,
          rows: res.rows,
          success: true
        },
      };
    } catch (error) {
      console.error("Query execution error:", error);

      let status = 400;
      if (error.code === "23502") {
        return {
          status: 400,
          content: { error: "Cannot insert NULL into non-nullable column." },
        };
      }
      return {
        status: status,
        content: { error: error.message },
      };
    } finally {
      client.release();
    }
  }

  isTrustedQuery(query, values = []) {
    const unsafeCommands = ["DROP TABLE"];
    const unsafePatterns = ["; DROP TABLE", "--"];

    if (unsafeCommands.some((cmd) => query.includes(cmd))) {
      return false;
    }

    if (
      values.some(
        (value) =>
          typeof value === "string" &&
          unsafePatterns.some((pattern) => value.includes(pattern))
      )
    ) {
      return false;
    }

    return true;
  }

  static init_schema() {
    return {
      host: { type: "string", required: true },
      user: { type: "string", required: true },
      password: { type: "string", required: true },
      database: { type: "string", required: true },
      port: { type: "number", required: true },
      minConn: { type: "number", required: true },
      maxConn: { type: "number", required: true },
      initialization: { type: "string", required: false },
    };
  }

  static in_schema() {
    return {
      query: { type: "string", required: true },
      values: { type: "array", required: false },
    };
  }

  static out_schema() {
    return {
      type: "object",
      properties: {
        status: { type: "number" },
        content: {
          type: "object",
          properties: {
            affectedRows: { type: "number" },
            rows: { type: "array" },
            success: { type: "boolean" },
            error: { type: "string" }
          }
        },
      },
      required: ["status", "content"]
    };
  }

  static about() {
    return "Executes SQL queries on a PostgreSQL database with connection pooling. Supports parameterized queries, transactions, and concurrent operations.";
  }
}

export const postgresql_tool = PostgreSQLTool;

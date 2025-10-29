import { Tool } from "duwende";
import { SQL } from "bun";
import path from "path";
import { mkdir } from "fs/promises";

export class SqlTool extends Tool {
  constructor(params) {
    super(params);
    this.type = params.type?.toLowerCase() || "sqlite";
    this.connection = null;
    this.params = params;

    if (!["postgresql", "mysql", "sqlite"].includes(this.type)) {
      throw new Error("Unsupported database type. Must be one of: postgresql, mysql, sqlite");
    }
  }

  async initialize() {
    try {
      switch (this.type) {
        case "postgresql":
          await this.initializePostgres();
          if (this.params.initialization) {
            await this.executeQuery(this.params.initialization);
          }
          break;

        case "mysql":
          await this.initializeMysql();
          if (this.params.initialization) {
            await this.executeQuery(this.params.initialization);
          }
          break;

        case "sqlite":
          await this.initializeSqlite();
          break;
      }
    } catch (error) {
      console.error("Database initialization error:", error);
      throw new Error(`Failed to initialize ${this.type} database: ${error.message}`);
    }
  }

  async initializePostgres() {
    const { host, user, password, database, port } = this.params;
    this.connection = new SQL({
      hostname: host,
      port,
      database,
      username: user,
      password,
      idleTimeout: 20
    });
  }

  async initializeMysql() {
    const { host, user, password, database, port } = this.params;

    this.connection = new SQL({
      adapter: 'mysql',
      hostname: host,
      port,
      username: user,
      password,
      database,
      idleTimeout:20,
    });
  }

  async initializeSqlite() {
    try {
      const dbPath = this.params.dbPath || ":memory:";

      if (dbPath !== ":memory:") {
        const dbDir = path.dirname(dbPath);
        await mkdir(dbDir, { recursive: true });
      }

      // ✅ Use a connection string, not an object
      const connectionString =
        dbPath === ":memory:" ? "sqlite::memory:" : `sqlite://${dbPath}`;

      this.connection = new SQL(connectionString);

      // Run initialization SQL if provided
      if (this.params.initialization) {
        try {
          await this.connection.unsafe(this.params.initialization);
        } catch (error) {
          this.connection.end?.();
          this.connection = null;
          throw error;
        }
      }
    } catch (error) {
      throw new Error(`Failed to initialize sqlite database: ${error.message}`);
    }
  }


  // relaxed version – only checks query text, not parameter values
  isTrustedQuery(query) {
    const unsafeCommands = ["DROP TABLE", "DROP DATABASE", "TRUNCATE TABLE"];
    const unsafePatterns = ["; DROP", ";--", "/*", "*/"];

    const upper = query.toUpperCase();
    if (unsafeCommands.some(cmd => upper.includes(cmd))) return false;
    if (unsafePatterns.some(pattern => query.includes(pattern))) return false;
    return true;
  }

  async executeQuery(query, values = []) {
    if (!this.connection) {
      throw new Error("Connection not initialized");
    }

    try {
      const result =
        values && values.length > 0
          ? await this.connection.unsafe(query, values)
          : await this.connection.unsafe(query);

      const rows = Array.isArray(result) ? result : [result];
      return {
        rows,
        affectedRows: rows.length,
        success: true
      };
    } catch (error) {
      console.error(`${this.type} query error:`, error);
      return {
        rows: [],
        affectedRows: 0,
        success: false,
        error: error.message
      };
    }
  }

  async use(params) {
    try {
      if (!this.connection) {
        await this.initialize();
      }

      const { query, values = [] } = params;

      if (!query) {
        return {
          status: 400,
          content: { error: "Query is required", success: false }
        };
      }

      if (!this.isTrustedQuery(query)) {
        return {
          status: 400,
          content: { error: "Potential SQL injection detected", success: false }
        };
      }

      const result = await this.executeQuery(query, values);
      return {
        status: result.success ? 200 : 400,
        content: result
      };
    } catch (error) {
      console.error(`${this.type} query error:`, error);
      return {
        status: 400,
        content: { error: error.message, success: false }
      };
    }
  }

  cleanup() {
    if (!this.connection) return;

    try {
      this.connection.end?.();
    } catch (error) {
      console.error(`Error during cleanup: ${error.message}`);
    } finally {
      this.connection = null;
    }
  }

  static init_schema() {
    return {
      type: {
        type: "string",
        required: true,
        description: "Database type: postgresql, mysql, or sqlite"
      },
      host: {
        type: "string",
        required: false,
        description: "Database host (required for PostgreSQL/MySQL)"
      },
      user: {
        type: "string",
        required: false,
        description: "Database user (required for PostgreSQL/MySQL)"
      },
      password: {
        type: "string",
        required: false,
        description: "Database password (required for PostgreSQL/MySQL)"
      },
      database: {
        type: "string",
        required: false,
        description: "Database name (required for PostgreSQL/MySQL)"
      },
      port: {
        type: "number",
        required: false,
        description: "Database port (required for PostgreSQL/MySQL)"
      },
      maxConn: {
        type: "number",
        required: false,
        description: "Maximum number of connections (MySQL only)"
      },
      dbPath: {
        type: "string",
        required: false,
        description: "Path to SQLite database file or :memory:"
      },
      initialization: {
        type: "string",
        required: false,
        description: "SQL statements to initialize the database"
      }
    };
  }

  static in_schema() {
    return {
      query: {
        type: "string",
        required: true,
        description: "SQL query to execute"
      },
      values: {
        type: "array",
        required: false,
        description: "Values for parameterized queries"
      }
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
            rows: { type: "array" },
            affectedRows: { type: "number" },
            success: { type: "boolean" },
            error: { type: "string" },
            lastInsertId: { type: "number" }
          }
        }
      },
      required: ["status", "content"]
    };
  }

  static about() {
    return "A unified SQL tool using Bun.SQL that supports PostgreSQL, MySQL, and SQLite databases. Maintains backward compatibility and relaxed injection checks.";
  }
}

export const sql_tool = SqlTool;

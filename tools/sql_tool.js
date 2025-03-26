import { Tool } from "duwende";
import { SQL } from "bun";
import { Database } from 'bun:sqlite';
import mysql from 'mysql2/promise';
import path from 'path';
import { mkdir } from 'fs/promises';

export class SqlTool extends Tool {
  constructor(params) {
    super(params);
    this.type = params.type?.toLowerCase() || 'sqlite';
    this.connection = null;
    this.params = params;

    // Validate database type
    if (!['postgresql', 'mysql', 'sqlite'].includes(this.type)) {
      throw new Error('Unsupported database type. Must be one of: postgresql, mysql, sqlite');
    }
  }

  async initialize() {
    try {
      switch (this.type) {
        case 'postgresql':
          await this.initializePostgres();
          // Run initialization SQL if provided
          if (this.params.initialization) {
            await this.executeQuery(this.params.initialization);
          }
          break;
        case 'mysql':
          await this.initializeMysql();
          // Run initialization SQL if provided
          if (this.params.initialization) {
            await this.executeQuery(this.params.initialization);
          }
          break;
        case 'sqlite':
          await this.initializeSqlite();
          break;
      }
    } catch (error) {
      console.error('Database initialization error:', error);
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
      password
    });
  }

  async initializeMysql() {
    const { host, user, password, database, port } = this.params;
    this.connection = await mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: this.params.maxConn || 10,
      queueLimit: 0
    });
  }

  async initializeSqlite() {
    try {
      const dbPath = this.params.dbPath || ':memory:';
      
      if (dbPath !== ':memory:') {
        const dbDir = path.dirname(dbPath);
        await mkdir(dbDir, { recursive: true });
      }

      this.connection = new Database(dbPath, {
        readwrite: true,
        create: true,
        strict: true
      });

      // Run initialization SQL if provided
      if (this.params.initialization) {
        try {
          this.connection.exec(this.params.initialization);
        } catch (error) {
          // Close the connection on initialization error
          this.connection.close();
          this.connection = null;
          throw error;
        }
      }
    } catch (error) {
      throw new Error(`Failed to initialize sqlite database: ${error.message}`);
    }
  }

  async executeQuery(query, values = []) {
    switch (this.type) {
      case 'postgresql':
        return this.executePostgresQuery(query, values);
      case 'mysql':
        return this.executeMysqlQuery(query, values);
      case 'sqlite':
        return this.executeSqliteQuery(query, values);
      default:
        throw new Error(`Unsupported database type: ${this.type}`);
    }
  }

  async executePostgresQuery(query, values = []) {
    try {
      // Execute the query using unsafe for parameterized queries
      const sql = this.connection;
      const result = await sql.unsafe(query, values);
      const rows = Array.isArray(result) ? result : [result];
      return {
        rows,
        affectedRows: rows.length,
        success: true
      };
    } catch (error) {
      console.error('PostgreSQL query error:', error);
      return {
        rows: [],
        affectedRows: 0,
        success: false,
        error: error.message
      };
    }
  }

  async executeMysqlQuery(query, values) {
    try {
      const [result] = await this.connection.execute(query, values);
      return {
        rows: Array.isArray(result) ? result : [],
        affectedRows: result.affectedRows || 0,
        success: true,
        lastInsertId: result.insertId
      };
    } catch (error) {
      return {
        rows: [],
        affectedRows: 0,
        success: false,
        error: error.message
      };
    }
  }

  executeSqliteQuery(query, values) {
    try {
      // Check if the query requires parameters but none were provided
      const hasParams = query.includes('?');
      if (hasParams && !values) {
        throw new Error('Query parameters are required but not provided');
      }

      const stmt = this.connection.prepare(query);
      const isSelect = query.trim().toLowerCase().startsWith('select');

      try {
        if (isSelect) {
          const rows = values ? stmt.all(values) : stmt.all();
          return {
            rows,
            affectedRows: rows.length,
            success: true
          };
        } else {
          try {
            values ? stmt.run(values) : stmt.run();
            const changesStmt = this.connection.prepare('SELECT changes()');
            const changes = changesStmt.get()['changes()'];
            return {
              rows: [],
              affectedRows: changes,
              success: true,
              lastInsertId: this.connection.lastInsertRowId
            };
          } catch (error) {
            if (error.code === 'SQLITE_READONLY') {
              return {
                rows: [],
                affectedRows: 0,
                success: false,
                error: 'attempt to write a readonly database'
              };
            }
            throw error;
          }
        }
      } finally {
        stmt.finalize();
      }
    } catch (error) {
      return {
        rows: [],
        affectedRows: 0,
        success: false,
        error: error.message
      };
    }
  }

  isTrustedQuery(query, values = []) {
    const unsafeCommands = ['DROP TABLE', 'DROP DATABASE', 'TRUNCATE TABLE'];
    const unsafePatterns = ['; DROP', '--', ';--', '/*', '*/'];

    if (unsafeCommands.some(cmd => query.toUpperCase().includes(cmd))) {
      return false;
    }

    if (values.some(value => 
      typeof value === 'string' && 
      unsafePatterns.some(pattern => value.includes(pattern))
    )) {
      return false;
    }

    return true;
  }

  async use(params) {
    try {
      // Initialize connection if not already done
      if (!this.connection) {
        await this.initialize();
      }

      const { query, values = [] } = params;

      if (!query) {
        return {
          status: 400,
          content: {
            error: 'Query is required',
            success: false
          }
        };
      }

      if (!this.isTrustedQuery(query, values)) {
        return {
          status: 400,
          content: {
            error: 'Potential SQL injection detected',
            success: false
          }
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
        content: {
          error: error.message,
          success: false
        }
      };
    }
  }

  cleanup() {
    if (!this.connection) return;

    try {
      switch (this.type) {
        case 'postgresql':
          this.connection.end();
          break;
        case 'mysql':
          this.connection.end();
          break;
        case 'sqlite':
          this.connection.close();
          break;
      }
    } catch (error) {
      console.error(`Error during cleanup: ${error.message}`);
    } finally {
      this.connection = null;
    }
  }

  static init_schema() {
    return {
      type: {
        type: 'string',
        required: true,
        description: 'Database type: postgresql, mysql, or sqlite'
      },
      // PostgreSQL and MySQL
      host: {
        type: 'string',
        required: false,
        description: 'Database host (required for PostgreSQL and MySQL)'
      },
      user: {
        type: 'string',
        required: false,
        description: 'Database user (required for PostgreSQL and MySQL)'
      },
      password: {
        type: 'string',
        required: false,
        description: 'Database password (required for PostgreSQL and MySQL)'
      },
      database: {
        type: 'string',
        required: false,
        description: 'Database name (required for PostgreSQL and MySQL)'
      },
      port: {
        type: 'number',
        required: false,
        description: 'Database port (required for PostgreSQL and MySQL)'
      },
      maxConn: {
        type: 'number',
        required: false,
        description: 'Maximum number of connections in pool (MySQL only)'
      },
      // SQLite
      dbPath: {
        type: 'string',
        required: false,
        description: 'Path to SQLite database file or :memory: for in-memory database (SQLite only)'
      },
      // Common
      initialization: {
        type: 'string',
        required: false,
        description: 'SQL statements to initialize the database'
      }
    };
  }

  static in_schema() {
    return {
      query: {
        type: 'string',
        required: true,
        description: 'SQL query to execute'
      },
      values: {
        type: 'array',
        required: false,
        description: 'Values for parameterized queries'
      }
    };
  }

  static out_schema() {
    return {
      type: 'object',
      properties: {
        status: { type: 'number' },
        content: {
          type: 'object',
          properties: {
            rows: { type: 'array' },
            affectedRows: { type: 'number' },
            success: { type: 'boolean' },
            error: { type: 'string' },
            lastInsertId: { type: 'number' }
          }
        }
      },
      required: ['status', 'content']
    };
  }

  static about() {
    return 'A unified SQL tool that supports PostgreSQL, MySQL, and SQLite databases. Handles connection pooling, parameterized queries, and provides consistent interface across different database types.';
  }
}

export const sql_tool = SqlTool;

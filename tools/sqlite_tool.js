import { Tool } from 'duwende';
import { Database } from 'bun:sqlite';
import path from 'path';
import { mkdir } from 'fs/promises';

export class SqliteTool extends Tool {
    constructor(params) {
        super(params);
        this.dbPath = params.dbPath || ':memory:';
        this.initialization = params.initialization;
        this.db = null;
    }

    async initialize() {
        try {
            if (this.dbPath !== ':memory:') {
                // Ensure the directory exists
                const dbDir = path.dirname(this.dbPath);
                await mkdir(dbDir, { recursive: true });
            }

            // Open database connection with proper flags
            this.db = new Database(this.dbPath, {
                readwrite: true, // Enable read/write mode
                create: true,    // Create if it doesn't exist
                strict: true     // Enable strict mode for better error handling
            });

            // Run initialization SQL if provided
            if (this.initialization) {
                this.db.exec(this.initialization);
            }
        } catch (error) {
            console.error('Database initialization error:', error);
            throw new Error(`Failed to initialize database: ${error.message}`);
        }
    }

    async use(params) {
        try {
            // Initialize connection if not already done
            if (!this.db) {
                await this.initialize();
            }

            const { query, values } = params;

            if (!query) {
                return {
                    status: 400,
                    content: {
                        error: 'Query is required',
                        success: false
                    }
                };
            }

            try {
                // Check if the query requires parameters but none were provided
                const hasParams = query.includes('?');
                if (hasParams && !values) {
                    return {
                        status: 400,
                        content: {
                            error: 'Query parameters are required but not provided',
                            success: false
                        }
                    };
                }

                const stmt = this.db.prepare(query);
                const isSelect = query.trim().toLowerCase().startsWith('select');

                if (isSelect) {
                    // For SELECT queries
                    const rows = values ? stmt.all(values) : stmt.all();
                    return {
                        status: 200,
                        content: {
                            rows: rows,
                            affectedRows: rows.length,
                            success: true
                        }
                    };
                } else {
                    // For other queries (INSERT, UPDATE, DELETE)
                    try {
                        // Execute the statement
                        values ? stmt.run(values) : stmt.run();

                        // Get the number of affected rows using changes()
                        const changesStmt = this.db.prepare('SELECT changes()');
                        const changes = changesStmt.get()['changes()'];
                        const lastInsertId = this.db.lastInsertRowId;
                        
                        return {
                            status: 200,
                            content: {
                                affectedRows: changes,
                                rows: [],
                                success: true,
                                lastInsertId: lastInsertId
                            }
                        };
                    } catch (error) {
                        console.error('Statement execution error:', error);
                        return {
                            status: 400,
                            content: {
                                error: error.message,
                                success: false
                            }
                        };
                    } finally {
                        // Finalize the statement to free resources
                        stmt.finalize();
                    }
                }
            } catch (error) {
                console.error('SQL error:', error);
                return {
                    status: 400,
                    content: {
                        error: error.message,
                        success: false
                    }
                };
            }
        } catch (error) {
            console.error('General error:', error);
            return {
                status: 400,
                content: {
                    error: error.message,
                    success: false
                }
            };
        }
    }

    static init_schema() {
        return {
            dbPath: { 
                type: 'string', 
                required: true,
                description: 'Path to SQLite database file or :memory: for in-memory database'
            },
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
                description: 'Values for parameterized queries. Use array for positional (?) parameters.'
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
        return 'Executes SQL queries on an SQLite3 database using Bun\'s native SQLite support. Supports parameterized queries, transactions, and both file-based and in-memory databases.';
    }

    // Cleanup method to close the database connection
    cleanup() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

export const sqlite_tool = SqliteTool;

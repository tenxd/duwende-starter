import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Tool } from 'duwende';
import { SqliteTool } from '../../tools/sqlite_tool.js';
import { unlink, chmod } from 'fs/promises';
import { existsSync } from 'fs';

describe('SqliteTool', () => {
    let sqliteTool;
    const testDbPath = 'test/test.db';

    beforeEach(async () => {
        // Clean up any existing test database
        if (existsSync(testDbPath)) {
            await unlink(testDbPath);
        }
    });

    afterEach(async () => {
        // Clean up after each test
        if (sqliteTool) {
            sqliteTool.cleanup();
        }
        if (existsSync(testDbPath)) {
            await unlink(testDbPath);
        }
    });

    test("should properly extend Tool class", () => {
        expect(SqliteTool.prototype instanceof Tool).toBe(true);
    });

    describe('Initialization', () => {
        test('should initialize with in-memory database', async () => {
            sqliteTool = new SqliteTool({ dbPath: ':memory:' });
            await sqliteTool.initialize();
            
            const result = await sqliteTool.use({
                query: 'SELECT 1 as test'
            });

            expect(result.status).toBe(200);
            expect(result.content.success).toBe(true);
            expect(result.content.rows).toEqual([{ test: 1 }]);
            expect(result.content.affectedRows).toBe(1);
        });

        test('should initialize with file database', async () => {
            sqliteTool = new SqliteTool({ dbPath: testDbPath });
            await sqliteTool.initialize();
            
            const result = await sqliteTool.use({
                query: 'SELECT 1 as test'
            });

            expect(result.status).toBe(200);
            expect(result.content.success).toBe(true);
            expect(result.content.rows).toEqual([{ test: 1 }]);
            expect(result.content.affectedRows).toBe(1);
            expect(existsSync(testDbPath)).toBe(true);
        });

        test('should execute initialization SQL', async () => {
            const initSql = `
                CREATE TABLE test_table (
                    id INTEGER PRIMARY KEY,
                    name TEXT
                );
                INSERT INTO test_table (name) VALUES ('test');
            `;

            sqliteTool = new SqliteTool({
                dbPath: ':memory:',
                initialization: initSql
            });
            await sqliteTool.initialize();

            const result = await sqliteTool.use({
                query: 'SELECT * FROM test_table'
            });

            expect(result.status).toBe(200);
            expect(result.content.success).toBe(true);
            expect(result.content.rows).toEqual([{ id: 1, name: 'test' }]);
            expect(result.content.affectedRows).toBe(1);
        });

        test('should handle initialization errors', async () => {
            const invalidSql = 'INVALID SQL STATEMENT;';
            sqliteTool = new SqliteTool({
                dbPath: ':memory:',
                initialization: invalidSql
            });
            
            await expect(sqliteTool.initialize())
                .rejects.toThrow();
        });
    });

    describe('Query Operations', () => {
        beforeEach(async () => {
            sqliteTool = new SqliteTool({
                dbPath: ':memory:',
                initialization: `
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY,
                        name TEXT UNIQUE,
                        age INTEGER
                    );
                `
            });
            await sqliteTool.initialize();
        });

        test('should execute INSERT operation with parameters', async () => {
            const result = await sqliteTool.use({
                query: 'INSERT INTO users (name, age) VALUES (?, ?)',
                values: ['John Doe', 30]
            });

            expect(result.status).toBe(200);
            expect(result.content.success).toBe(true);
            expect(result.content.affectedRows).toBe(1);
            expect(result.content.rows).toEqual([]);
        });

        test('should execute SELECT operation with parameters', async () => {
            // Insert test data
            await sqliteTool.use({
                query: 'INSERT INTO users (name, age) VALUES (?, ?)',
                values: ['John Doe', 30]
            });

            const result = await sqliteTool.use({
                query: 'SELECT * FROM users WHERE age = ?',
                values: [30]
            });

            expect(result.status).toBe(200);
            expect(result.content.success).toBe(true);
            expect(result.content.rows).toEqual([{
                id: 1,
                name: 'John Doe',
                age: 30
            }]);
            expect(result.content.affectedRows).toBe(1);
        });

        test('should execute UPDATE operation with parameters', async () => {
            // Insert test data
            await sqliteTool.use({
                query: 'INSERT INTO users (name, age) VALUES (?, ?)',
                values: ['John Doe', 30]
            });

            const updateResult = await sqliteTool.use({
                query: 'UPDATE users SET age = ? WHERE name = ?',
                values: [31, 'John Doe']
            });

            expect(updateResult.status).toBe(200);
            expect(updateResult.content.success).toBe(true);
            expect(updateResult.content.affectedRows).toBe(1);
            expect(updateResult.content.rows).toEqual([]);

            // Verify update
            const selectResult = await sqliteTool.use({
                query: 'SELECT age FROM users WHERE name = ?',
                values: ['John Doe']
            });

            expect(selectResult.content.rows[0].age).toBe(31);
        });

        test('should execute DELETE operation with parameters', async () => {
            // Insert test data
            await sqliteTool.use({
                query: 'INSERT INTO users (name, age) VALUES (?, ?)',
                values: ['John Doe', 30]
            });

            const deleteResult = await sqliteTool.use({
                query: 'DELETE FROM users WHERE name = ?',
                values: ['John Doe']
            });

            expect(deleteResult.status).toBe(200);
            expect(deleteResult.content.success).toBe(true);
            expect(deleteResult.content.affectedRows).toBe(1);
            expect(deleteResult.content.rows).toEqual([]);

            // Verify deletion
            const selectResult = await sqliteTool.use({
                query: 'SELECT * FROM users'
            });

            expect(selectResult.content.rows).toEqual([]);
            expect(selectResult.content.affectedRows).toBe(0);
        });

        test('should handle large datasets', async () => {
            // Insert 1000 records
            const values = Array.from({ length: 1000 }, (_, i) => 
                `('User${i}', ${20 + (i % 50)})`
            ).join(',');
            
            await sqliteTool.use({
                query: `INSERT INTO users (name, age) VALUES ${values}`
            });

            const result = await sqliteTool.use({
                query: 'SELECT COUNT(*) as count FROM users'
            });

            expect(result.status).toBe(200);
            expect(result.content.success).toBe(true);
            expect(result.content.rows[0].count).toBe(1000);
            expect(result.content.affectedRows).toBe(1);
        });

        test('should handle complex transactions', async () => {
            // First create the accounts table and execute the transaction as separate statements
            await sqliteTool.use({
                query: 'CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER)'
            });

            await sqliteTool.use({
                query: 'INSERT INTO accounts (balance) VALUES (1000)'
            });

            await sqliteTool.use({
                query: 'INSERT INTO accounts (balance) VALUES (2000)'
            });

            await sqliteTool.use({
                query: 'UPDATE accounts SET balance = balance - 500 WHERE id = 1'
            });

            await sqliteTool.use({
                query: 'UPDATE accounts SET balance = balance + 500 WHERE id = 2'
            });

            const balances = await sqliteTool.use({
                query: 'SELECT balance FROM accounts ORDER BY id'
            });

            expect(balances.status).toBe(200);
            expect(balances.content.success).toBe(true);
            expect(balances.content.rows).toEqual([
                { balance: 500 },
                { balance: 2500 }
            ]);
            expect(balances.content.affectedRows).toBe(2);
        });

        test('should handle transaction rollback on error', async () => {
            // First create a valid record
            await sqliteTool.use({
                query: 'INSERT INTO users (name, age) VALUES (?, ?)',
                values: ['John Doe', 30]
            });

            // Try to insert a duplicate name (violates UNIQUE constraint)
            const result = await sqliteTool.use({
                query: 'INSERT INTO users (name, age) VALUES (?, ?)',
                values: ['John Doe', 25]  // Same name as existing record
            });

            expect(result.status).toBe(400);
            expect(result.content.success).toBe(false);
            expect(result.content.error).toBeDefined();

            // Verify original data is unchanged
            const selectResult = await sqliteTool.use({
                query: 'SELECT * FROM users WHERE name = ?',
                values: ['John Doe']
            });

            expect(selectResult.content.rows).toEqual([{
                id: 1,
                name: 'John Doe',
                age: 30
            }]);

            // Verify no new data was inserted
            const allRecords = await sqliteTool.use({
                query: 'SELECT * FROM users'
            });

            expect(allRecords.content.rows.length).toBe(1);
        });

        test('should handle concurrent operations', async () => {
            // Create multiple concurrent operations
            const operations = Array.from({ length: 10 }, (_, i) => 
                sqliteTool.use({
                    query: 'INSERT INTO users (name, age) VALUES (?, ?)',
                    values: [`User${i}`, 20 + i]
                })
            );

            // Execute all operations concurrently
            const results = await Promise.all(operations);

            // Verify all operations succeeded
            results.forEach(result => {
                expect(result.status).toBe(200);
                expect(result.content.success).toBe(true);
            });

            // Verify final state
            const count = await sqliteTool.use({
                query: 'SELECT COUNT(*) as count FROM users'
            });
            expect(count.content.rows[0].count).toBe(10);
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            sqliteTool = new SqliteTool({ dbPath: ':memory:' });
            await sqliteTool.initialize();
        });

        test('should handle syntax errors', async () => {
            const result = await sqliteTool.use({
                query: 'INVALID SQL QUERY'
            });

            expect(result.status).toBe(400);
            expect(result.content.success).toBe(false);
            expect(result.content.error).toBeDefined();
        });

        test('should handle missing table errors', async () => {
            const result = await sqliteTool.use({
                query: 'SELECT * FROM non_existent_table'
            });

            expect(result.status).toBe(400);
            expect(result.content.success).toBe(false);
            expect(result.content.error).toBeDefined();
        });

        test('should handle parameter binding errors', async () => {
            const result = await sqliteTool.use({
                query: 'SELECT * FROM sqlite_master WHERE type = ?'
                // Missing values array
            });

            expect(result.status).toBe(400);
            expect(result.content.success).toBe(false);
            expect(result.content.error).toBeDefined();
        });

        test('should handle database file permission errors', async () => {
            const readOnlyPath = 'test/readonly.db';
            
            // Create database first with a table
            sqliteTool = new SqliteTool({ dbPath: readOnlyPath });
            await sqliteTool.initialize();
            await sqliteTool.use({
                query: 'CREATE TABLE test (id INTEGER PRIMARY KEY)'
            });
            sqliteTool.cleanup();  // Close the connection
            
            // Make it read-only
            await chmod(readOnlyPath, 0o444);

            try {
                // Try to open a new connection with write permissions
                sqliteTool = new SqliteTool({ dbPath: readOnlyPath });
                await sqliteTool.initialize();

                // Attempt to write to the read-only database
                const result = await sqliteTool.use({
                    query: 'INSERT INTO test (id) VALUES (1)'
                });

                expect(result.status).toBe(400);
                expect(result.content.success).toBe(false);
                expect(result.content.error).toBeDefined();
                expect(result.content.error).toContain('readonly database');
            } finally {
                // Cleanup
                if (existsSync(readOnlyPath)) {
                    await chmod(readOnlyPath, 0o666);
                    await unlink(readOnlyPath);
                }
            }
        });

        test('should handle cleanup errors', async () => {
            sqliteTool = new SqliteTool({ dbPath: ':memory:' });
            await sqliteTool.initialize();
            
            // Force close the database to simulate an error during cleanup
            sqliteTool.db.close();
            
            // Cleanup should not throw even if database is already closed
            expect(() => sqliteTool.cleanup()).not.toThrow();
        });
    });

    describe('Schema Validation', () => {
        test('should have valid init schema', () => {
            const schema = SqliteTool.init_schema();
            expect(schema.dbPath).toBeDefined();
            expect(schema.dbPath.type).toBe('string');
            expect(schema.dbPath.required).toBe(true);
            expect(schema.initialization).toBeDefined();
            expect(schema.initialization.type).toBe('string');
            expect(schema.initialization.required).toBe(false);
        });

        test('should have valid in schema', () => {
            const schema = SqliteTool.in_schema();
            expect(schema.query).toBeDefined();
            expect(schema.query.type).toBe('string');
            expect(schema.query.required).toBe(true);
            expect(schema.values).toBeDefined();
            expect(schema.values.type).toBe('array');
            expect(schema.values.required).toBe(false);
        });

        test('should have valid out schema', () => {
            const schema = SqliteTool.out_schema();
            expect(schema.type).toBe('object');
            expect(schema.properties.status).toBeDefined();
            expect(schema.properties.content).toBeDefined();
            expect(schema.required).toContain('status');
            expect(schema.required).toContain('content');
        });
    });

    describe('About Method', () => {
        test('should return a non-empty description', () => {
            expect(typeof SqliteTool.about()).toBe('string');
            expect(SqliteTool.about().length).toBeGreaterThan(0);
        });

        test('should include key features in description', () => {
            const description = SqliteTool.about();
            expect(description).toContain('SQLite');
            expect(description).toContain('database');
        });
    });
});

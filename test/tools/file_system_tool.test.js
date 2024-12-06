import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Tool } from 'duwende';
import { FileSystemTool } from '../../tools/file_system_tool.js';
import fs from 'fs/promises';
import path from 'path';

describe('FileSystemTool', () => {
    let fileSystemTool;
    const testDir = 'test/temp-fs-tool';
    const testFile = path.join(testDir, 'test.txt');
    const testContent = 'Hello, World!';

    beforeEach(async () => {
        fileSystemTool = new FileSystemTool({});
        // Create test directory and file
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(testFile, testContent);
    });

    afterEach(async () => {
        // Clean up test directory and files
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    });

    test("should properly extend Tool class", () => {
        expect(FileSystemTool.prototype instanceof Tool).toBe(true);
    });

    describe('File Operations', () => {
        describe('read', () => {
            test('should read existing file', async () => {
                const result = await fileSystemTool.use({
                    action: 'read',
                    path: testFile
                });

                expect(result.status).toBe(200);
                expect(result.content.toString()).toBe(testContent);
                expect(result.mimeType).toBe('application/octet-stream');
            });

            test('should return 404 for non-existent file', async () => {
                const result = await fileSystemTool.use({
                    action: 'read',
                    path: path.join(testDir, 'nonexistent.txt')
                });

                expect(result.status).toBe(404);
            });

            test('should detect correct mime type for different file extensions', async () => {
                const testFiles = {
                    'test.html': 'text/html',
                    'test.css': 'text/css',
                    'test.js': 'application/javascript',
                    'test.json': 'application/json',
                    'test.png': 'image/png',
                    'test.jpg': 'image/jpeg',
                    'test.gif': 'image/gif',
                    'test.svg': 'image/svg+xml',
                    'test.ico': 'image/x-icon'
                };

                for (const [fileName, expectedMimeType] of Object.entries(testFiles)) {
                    const filePath = path.join(testDir, fileName);
                    await fs.writeFile(filePath, 'test content');

                    const result = await fileSystemTool.use({
                        action: 'read',
                        path: filePath
                    });

                    expect(result.status).toBe(200);
                    expect(result.mimeType).toBe(expectedMimeType);
                }
            });
        });

        describe('list', () => {
            test('should list directory contents', async () => {
                // Create additional test files
                await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
                await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');

                const result = await fileSystemTool.use({
                    action: 'list',
                    path: testDir
                });

                expect(result.status).toBe(200);
                expect(result.files).toBeInstanceOf(Array);
                expect(result.files).toContain('test.txt');
                expect(result.files).toContain('file1.txt');
                expect(result.files).toContain('file2.txt');
                expect(result.files).toHaveLength(3);
            });

            test('should return 404 for non-existent directory', async () => {
                const result = await fileSystemTool.use({
                    action: 'list',
                    path: path.join(testDir, 'nonexistent')
                });

                expect(result.status).toBe(404);
            });

            test('should list empty directory', async () => {
                const emptyDir = path.join(testDir, 'empty');
                await fs.mkdir(emptyDir);

                const result = await fileSystemTool.use({
                    action: 'list',
                    path: emptyDir
                });

                expect(result.status).toBe(200);
                expect(result.files).toBeInstanceOf(Array);
                expect(result.files).toHaveLength(0);
            });
        });

        describe('write', () => {
            test('should write content to file', async () => {
                const newFile = path.join(testDir, 'new.txt');
                const content = 'New content';

                const result = await fileSystemTool.use({
                    action: 'write',
                    path: newFile,
                    content
                });

                expect(result.status).toBe(200);
                expect(result.message).toBe('File written successfully');

                // Verify file was written
                const fileContent = await fs.readFile(newFile, 'utf-8');
                expect(fileContent).toBe(content);
            });

            test('should overwrite existing file', async () => {
                const content = 'Updated content';

                const result = await fileSystemTool.use({
                    action: 'write',
                    path: testFile,
                    content
                });

                expect(result.status).toBe(200);
                expect(result.message).toBe('File written successfully');

                // Verify file was overwritten
                const fileContent = await fs.readFile(testFile, 'utf-8');
                expect(fileContent).toBe(content);
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle unsupported action', async () => {
            await expect(fileSystemTool.use({
                action: 'unsupported',
                path: testFile
            })).rejects.toThrow('Unsupported action');
        });

        test('should handle missing required parameters', async () => {
            await expect(fileSystemTool.use({
                action: 'read'
            })).rejects.toThrow();
        });
    });

    describe('Schema Validation', () => {
        test('should have valid init schema', () => {
            const schema = FileSystemTool.init_schema();
            expect(schema).toEqual({});
        });

        test('should have valid in schema', () => {
            const schema = FileSystemTool.in_schema();
            expect(schema.action).toBeDefined();
            expect(schema.action.type).toBe('string');
            expect(schema.action.required).toBe(true);

            expect(schema.path).toBeDefined();
            expect(schema.path.type).toBe('string');
            expect(schema.path.required).toBe(true);

            expect(schema.content).toBeDefined();
            expect(schema.content.type).toBe('string');
            expect(schema.content.required).toBe(false);
        });

        test('should have valid out schema', () => {
            const schema = FileSystemTool.out_schema();
            expect(schema.status).toBeDefined();
            expect(schema.status.type).toBe('number');

            expect(schema.content).toBeDefined();
            expect(schema.content.type).toBe('string');
            expect(schema.content.required).toBe(false);

            expect(schema.mimeType).toBeDefined();
            expect(schema.mimeType.type).toBe('string');
            expect(schema.mimeType.required).toBe(false);

            expect(schema.files).toBeDefined();
            expect(schema.files.type).toBe('array');
            expect(schema.files.required).toBe(false);

            expect(schema.message).toBeDefined();
            expect(schema.message.type).toBe('string');
            expect(schema.message.required).toBe(false);
        });
    });

    describe('About Method', () => {
        test('should return a non-empty description', () => {
            expect(typeof FileSystemTool.about()).toBe('string');
            expect(FileSystemTool.about().length).toBeGreaterThan(0);
        });

        test('should include key features in description', () => {
            const description = FileSystemTool.about();
            expect(description).toContain('reading');
            expect(description).toContain('listing');
            expect(description).toContain('writing');
            expect(description).toContain('files');
        });
    });
});

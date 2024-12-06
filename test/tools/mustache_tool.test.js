import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Tool } from 'duwende';
import { MustacheTool } from '../../tools/mustache_tool.js';
import fs from 'fs/promises';
import path from 'path';

describe('MustacheTool', () => {
  let renderer;
  const testDir = '/tmp/test-mustache';
  const baseDir = path.join(testDir, 'templates');

  // Setup test files
  beforeEach(async () => {
    await fs.mkdir(baseDir, { recursive: true });
    await fs.mkdir(path.join(baseDir, 'partials'), { recursive: true });
    
    // Create test template files
    await fs.writeFile(
      path.join(baseDir, 'test.mustache'),
      'Hello {{name}}{{#items}}{{.}}{{/items}}{{> header}}!'
    );
    await fs.writeFile(
      path.join(baseDir, 'partials/header.mustache'),
      ' (Welcome)'
    );
    await fs.writeFile(
      path.join(baseDir, 'partials/footer.mustache'),
      ' [Footer]'
    );

    renderer = new MustacheTool({ baseDir });
  });

  // Cleanup test files
  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  test("should properly extend Tool class", () => {
    expect(MustacheTool.prototype instanceof Tool).toBe(true);
  });

  describe('constructor', () => {
    test('should throw error if baseDir is not provided', () => {
      expect(() => new MustacheTool({})).toThrow('baseDir is required');
    });

    test('should set baseDir when provided', () => {
      const renderer = new MustacheTool({ baseDir });
      expect(renderer.baseDir).toBe(baseDir);
    });
  });

  describe('use', () => {
    const templatePath = 'test.mustache';
    const headerPartialPath = 'partials/header.mustache';
    const footerPartialPath = 'partials/footer.mustache';
    const data = { 
      name: 'World',
      items: ['A', 'B', 'C'],
      nested: { value: 'test' }
    };
    const partialsMap = { 
      header: headerPartialPath,
      footer: footerPartialPath
    };

    test('should render template with simple data', async () => {
      const result = await renderer.use({ 
        templatePath, 
        data: { name: 'World' } 
      });
      expect(result.status).toBe(200);
      expect(result.renderedContent).toBe('Hello World!');
    });

    test('should render template with array data', async () => {
      const result = await renderer.use({ 
        templatePath, 
        data: { name: 'World', items: ['A', 'B', 'C'] } 
      });
      expect(result.status).toBe(200);
      expect(result.renderedContent).toBe('Hello WorldABC!');
    });

    test('should render template with nested data', async () => {
      await fs.writeFile(
        path.join(baseDir, 'nested.mustache'),
        'Value: {{nested.value}}'
      );
      const result = await renderer.use({ 
        templatePath: 'nested.mustache', 
        data: { nested: { value: 'test' } } 
      });
      expect(result.status).toBe(200);
      expect(result.renderedContent).toBe('Value: test');
    });

    test('should render template with single partial', async () => {
      const result = await renderer.use({ 
        templatePath, 
        data: { name: 'World' },
        partialsMap: { header: headerPartialPath }
      });
      expect(result.status).toBe(200);
      expect(result.renderedContent).toBe('Hello World (Welcome)!');
    });

    test('should render template with multiple partials', async () => {
      await fs.writeFile(
        path.join(baseDir, 'multi.mustache'),
        'Hello {{name}}{{> header}}{{> footer}}'
      );
      const result = await renderer.use({ 
        templatePath: 'multi.mustache', 
        data: { name: 'World' },
        partialsMap
      });
      expect(result.status).toBe(200);
      expect(result.renderedContent).toBe('Hello World (Welcome) [Footer]');
    });

    test('should throw error if templatePath is missing', async () => {
      await expect(renderer.use({ data }))
        .rejects.toThrow('Missing required parameters');
    });

    test('should throw error if data is missing', async () => {
      await expect(renderer.use({ templatePath }))
        .rejects.toThrow('Missing required parameters');
    });

    test('should handle template file not found error', async () => {
      await expect(renderer.use({ 
        templatePath: 'nonexistent.mustache', 
        data 
      }))
        .rejects.toThrow('Template file not found: nonexistent.mustache');
    });

    test('should handle partial file not found error', async () => {
      await expect(renderer.use({ 
        templatePath, 
        data, 
        partialsMap: { header: 'nonexistent.mustache' } 
      }))
        .rejects.toThrow('Failed to load partial \'header\' from nonexistent.mustache');
    });

    test('should handle file system errors', async () => {
      // Make baseDir non-readable
      await fs.chmod(baseDir, 0o000);
      await expect(renderer.use({ templatePath, data }))
        .rejects.toThrow();
      // Restore permissions for cleanup
      await fs.chmod(baseDir, 0o755);
    });
  });

  describe('loadTemplate', () => {
    test('should load template from file', async () => {
      const templatePath = 'test.mustache';
      const result = await renderer.loadTemplate(templatePath);
      expect(result).toBe('Hello {{name}}{{#items}}{{.}}{{/items}}{{> header}}!');
    });

    test('should throw error if template file not found', async () => {
      const templatePath = 'nonexistent.mustache';
      await expect(renderer.loadTemplate(templatePath))
        .rejects.toThrow(`Template file not found: ${templatePath}`);
    });

    test('should handle file system errors', async () => {
      // Make baseDir non-readable
      await fs.chmod(baseDir, 0o000);
      await expect(renderer.loadTemplate('test.mustache'))
        .rejects.toThrow();
      // Restore permissions for cleanup
      await fs.chmod(baseDir, 0o755);
    });
  });

  describe('loadPartials', () => {
    test('should load all partials from files', async () => {
      const partialsMap = {
        header: 'partials/header.mustache',
        footer: 'partials/footer.mustache'
      };
      const result = await renderer.loadPartials(partialsMap);
      expect(result).toEqual({
        header: ' (Welcome)',
        footer: ' [Footer]'
      });
    });

    test('should return empty object if no partials provided', async () => {
      const result = await renderer.loadPartials();
      expect(result).toEqual({});
    });

    test('should handle file system errors in partial loading', async () => {
      // Make partials directory non-readable
      await fs.chmod(path.join(baseDir, 'partials'), 0o000);
      await expect(renderer.loadPartials({ 
        header: 'partials/header.mustache' 
      }))
        .rejects.toThrow();
      // Restore permissions for cleanup
      await fs.chmod(path.join(baseDir, 'partials'), 0o755);
    });
  });

  describe('schemas', () => {
    test('should have correct init_schema', () => {
      const schema = MustacheTool.init_schema();
      expect(schema).toHaveProperty('baseDir');
      expect(schema.baseDir).toEqual({ type: 'string', required: true });
    });

    test('should have correct in_schema', () => {
      const schema = MustacheTool.in_schema();
      expect(schema).toHaveProperty('templatePath');
      expect(schema).toHaveProperty('data');
      expect(schema).toHaveProperty('partialsMap');
      expect(schema.templatePath).toEqual({ type: 'string', required: true });
      expect(schema.data).toEqual({ type: 'object', required: true });
      expect(schema.partialsMap).toEqual({
        type: 'object',
        required: false,
        description: 'Object mapping partial names to their file paths'
      });
    });

    test('should have correct out_schema', () => {
      const schema = MustacheTool.out_schema();
      expect(schema).toHaveProperty('type', 'object');
      expect(schema.properties).toHaveProperty('status');
      expect(schema.properties).toHaveProperty('renderedContent');
      expect(schema.properties.renderedContent).toEqual({ type: 'string' });
    });
  });

  describe('about', () => {
    test('should return a non-empty description', () => {
      expect(typeof MustacheTool.about()).toBe('string');
      expect(MustacheTool.about().length).toBeGreaterThan(0);
    });
  });
});

import { Tool } from 'duwende';
import Mustache from 'mustache';
import fs from 'fs';
import path from 'path';

/**
 * MustacheTool is a tool for rendering Mustache templates from files.
 * It provides core template rendering functionality, with support for partials loaded from files.
 */
export class MustacheTool extends Tool {
  /**
   * Constructor for MustacheTool.
   * @param {Object} params - Parameters for the renderer.
   * @param {string} params.baseDir - The base directory for template paths.
   * @throws {Error} If baseDir is not provided
   */
  constructor(params) {
    super(params);
    if (!params.baseDir) {
      throw new Error('baseDir is required');
    }
    this.baseDir = params.baseDir;
  }

  /**
   * Initializes the schema for the MustacheTool.
   * @returns {Object} The schema defining the required parameters.
   */
  static init_schema() {
    return {
      baseDir: { type: 'string', required: true }
    };
  }

  /**
   * Defines the input schema for the use method.
   * @returns {Object} The schema for input parameters.
   */
  static in_schema() {
    return {
      templatePath: { type: 'string', required: true },
      data: { type: 'object', required: true },
      partialsMap: {
        type: 'object',
        required: false,
        description: 'Object mapping partial names to their file paths'
      }
    };
  }

  /**
   * Defines the output schema for the use method.
   * @returns {Object} The schema for output parameters.
   */
  static out_schema() {
    return {
      type: 'object',
      properties: {
        status: { type: 'number' },
        renderedContent: { type: 'string' }
      }
    };
  }

  /**
   * Provides a description of the MustacheTool.
   * @returns {string} A detailed description of the tool.
   */
  static about() {
    return 'A tool for rendering Mustache templates from files. Supports template files, data injection, and partials loaded from files for modular template composition.';
  }

  /**
   * Loads a template file from the given path.
   * @param {string} templatePath - Path to the template file.
   * @returns {Promise<string>} The template content.
   * @throws {Error} If the template file cannot be read
   */
  async loadTemplate(templatePath) {
    try {
      return await fs.promises.readFile(path.join(this.baseDir, templatePath), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Template file not found: ${templatePath}`);
      }
      throw error;
    }
  }

  /**
   * Loads all partial templates from their respective files.
   * @param {Object} partialsMap - Object mapping partial names to file paths.
   * @returns {Promise<Object>} Object containing loaded partial templates.
   */
  async loadPartials(partialsMap) {
    if (!partialsMap) return {};

    const loadedPartials = {};
    for (const [name, filePath] of Object.entries(partialsMap)) {
      try {
        loadedPartials[name] = await this.loadTemplate(filePath);
      } catch (error) {
        throw new Error(`Failed to load partial '${name}' from ${filePath}: ${error.message}`);
      }
    }
    return loadedPartials;
  }

  /**
   * Renders a Mustache template with the provided data and optional partials.
   * @param {Object} params - The parameters for rendering.
   * @param {string} params.templatePath - The path to the template file.
   * @param {Object} params.data - The data to be used for rendering the template.
   * @param {Object} [params.partialsMap] - Optional object mapping partial names to their file paths.
   * @returns {Promise<Object>} The rendered content with status.
   * @throws {Error} If required parameters are missing or template files cannot be loaded
   */
  async use(params) {
    try {
      const { templatePath, data, partialsMap } = params;
      
      if (!templatePath || !data) {
        throw new Error('Missing required parameters');
      }

      // Load main template
      const template = await this.loadTemplate(templatePath);
      
      // Load partials if provided
      const loadedPartials = await this.loadPartials(partialsMap);
      
      // Render the template with data and loaded partials
      const renderedContent = Mustache.render(template, data, loadedPartials);
      
      return {
        status: 200,
        renderedContent
      };
    } catch (error) {
      throw error;
    }
  }
}

export const mustache_tool = MustacheTool;

# Creating a New Tool

## Tool File
- Create in: `tools/<your_tool_name>_tool.js` (in your project directory)
- Use snake_case for filename
- Filename must end in '_tool.js'

## Tool Class Structure
```javascript
import { Tool } from 'duwende';

export class YourToolName extends Tool {
  constructor(params) {
    super(params);
    this.someProperty = params.someProperty || 'default value';
  }

  async use(params) {
    // Implement main functionality
    return {
      status: 200, // or appropriate status code
      content: result
    };
  }

  static init_schema() {
    return {
      someProperty: { type: 'string', required: false }
    };
  }

  static in_schema() {
    return {
      inputParam: { type: 'string', required: true }
    };
  }

  static out_schema() {
    return {
      type: 'object',
      properties: {
        status: { type: 'number' },
        content: { type: 'any' }
      }
    };
  }

  static about() {
    return 'Description of your tool and its functionality.';
  }
}

export const your_tool_name = YourToolName;
```

## Naming Conventions
Follow these consistent patterns when creating a new tool:

1. Class Names:
   - Use PascalCase for the tool class
   - Always append 'Tool' to the class name
   - Keep acronyms in uppercase when converting from snake_case
   - Example: file_system_tool.js → FileSystemTool
   - Example: jwt_tool.js → JWTTool (not JwtTool, as JWT is an acronym)
   - Example: xml_parser_tool.js → XMLParserTool

2. Tool Exports:
   - Use snake_case for the exported tool instance
   - Export name should match filename (without .js)
   - Example: for file_system_tool.js, export as file_system_tool
   - Example: for jwt_tool.js, export as jwt_tool

3. Static Methods:
   - Use snake_case for schema methods:
     * init_schema()
     * in_schema()
     * out_schema()
   - Use camelCase for other static methods:
     * about()

4. Instance Methods:
   - Use camelCase for all instance methods (e.g., use, initialize, loadTemplate)
   - Use camelCase for parameter names in method signatures

5. Configuration Parameters:
   - Use camelCase for parameter names in constructor and methods
   - Example: { baseDir, secretKey, configPath }

6. Response Properties:
   - Use camelCase for all response object properties
   - Example: { status: 200, content: { lastInsertId, affectedRows } }

## Key Methods
1. `constructor(params)`: Initialize properties
2. `use(params)`: Implement main functionality (should be async)
3. `static init_schema()`: Define initialization parameters schema
4. `static in_schema()`: Define input parameters schema
5. `static out_schema()`: Define output schema
6. `static about()`: Provide tool description

## Error Handling
```javascript
async use(params) {
  if (!params.requiredParam) {
    throw new Error('Required parameter is missing');
  }
  // Implementation
}
```

## Key Points
- Extend the base `Tool` class from the duwende package
- Implement all required methods (constructor, use, schemas, about)
- Use `params` in constructor for configuration
- Throw errors for invalid inputs or operational issues
- Return results from the `use` method in the format: `{ status: number, content: any }`
- Keep tools focused on a single responsibility
- Avoid external dependencies; use built-in Node.js modules if necessary
- The `use` method should be asynchronous (use `async/await`)

## Integration
- Create tools in your project's `tools/` directory
- Tools are automatically loaded from the project's `tools/` directory
- Accessible in resources via `Resource.tools['your_tool_name']`
- Use in resources: 
  ```javascript
  const toolClass = Resource.tools['your_tool_name'].tool;
  const toolInstance = new toolClass();
  const result = await toolInstance.use({ /* params */ });
  if (result.status === 200) {
    // Process result.content
  } else {
    // Handle error
  }
  ```

## Tool Usage in Resources
Tools are primarily used in the resource loading process. They can be used to fetch resource code from various sources (file system, databases, etc.) and perform other utility functions. When creating a tool, consider how it might be used in the context of resource management and request handling.

# Creating a New Resource

## Resource File
- Create in: `sites/<hostname>/services/<service>/resources/<your_resource_name>.js`
- Use snake_case for filename

## Resource Class Structure
```javascript
import { Resource } from 'duwende';

export class YourResourceName extends Resource {
  constructor(hostname, service, name, config) {
    super(hostname, service, name, config);
    this.yourTool = Resource.tools['your_tool_name'].tool;
  }

  // Implement handler methods here
}

export const yourResourceName = YourResourceName;
```

## Handler Methods
Implement these methods as needed:
- `async handleGet(request, id, path)`
- `async handlePost(request, id, path)`
- `async handlePut(request, id, path)`
- `async handlePatch(request, id, path)`
- `async handleDelete(request, id, path)`
- `async handleList(request)`

## Render Methods (optional)
For HTML responses:
- `async renderGet(request, id, path)`
- `async renderList(request)`

## Using Tools
- Access tools via `Resource.tools['tool_name'].tool`
- Instantiate tools when using them
- Example:
  ```javascript
  const toolInstance = new this.yourTool();
  const result = await toolInstance.use({ /* params */ });
  if (result.status === 200) {
    // Process result.content
  } else {
    // Handle error
  }
  ```

## Response Handling
```javascript
return new Response(responseBody, {
  status: statusCode,
  headers: { 'Content-Type': contentType }
});
```

## Error Handling
```javascript
try {
  // Your logic here
} catch (error) {
  console.error('Error:', error);
  return new Response('Internal Server Error', { status: 500 });
}
```

## Key Points
- Extend the base `Resource` class from the duwende package
- Use provided tools, strictly no external libraries
- Implement necessary handler and render methods
- Handle errors gracefully
- Return responses using the `Response` object
- Access resource config via `this.config`
- Access hostname, service, and name via `this.hostname`, `this.service`, `this.name`
- Tools are asynchronous and return results in the format: `{ status: number, content: any }`

## Coding Guidelines

### Planning and Implementation
1. Plan out and explicitly list the required steps before beginning to code.
2. Implement each step methodically, following the guidelines below.

### Code Structure and Style
3. Strictly no imports of external libraries; use only tools provided by the framework.
4. Avoid nesting unless absolutely necessary; maximum one level of nesting allowed.
5. Implement early return whenever possible to reduce code complexity.
6. Prefer higher-order functions (map, reduce, filter) over traditional looping constructs.
7. Use only `const` for variable declarations; avoid `var` and `let`.
8. Do not mutate scalars. Mutate arrays and objects only if necessary for performance or memory optimization.

### Function and Method Design
9. Keep functions and methods small and focused on a single responsibility.
10. Use descriptive names for functions, variables, and parameters.
11. Limit the number of parameters in functions; consider using object parameters for multiple options.

### Error Handling and HTTP Responses
12. Always use the correct HTTP status code when returning responses.
13. Provide informative error messages in catch blocks to aid debugging.
14. Log errors appropriately using `console.error()` or a custom logging mechanism.

### Performance and Optimization
15. Minimize API calls and database queries; batch operations when possible.
16. Use caching mechanisms where appropriate to improve performance.

### Code Documentation
17. Include clear and concise comments for complex logic or non-obvious implementations.
18. Use JSDoc-style comments for function and method documentation.

### Testing
19. Write unit tests for each new method or significant piece of functionality.
20. Ensure all edge cases and error scenarios are covered in tests.

### Version Control
21. Make small, focused commits with descriptive commit messages.
22. Review your own code before submitting for review or merging.

Remember: These guidelines are designed to produce clean, efficient, and maintainable code while leveraging the duwende framework's capabilities. Always consider the context of the resource you're implementing and adjust your approach accordingly.

## Example Implementation

Here's an example of a "User" resource that demonstrates many of the coding guidelines:

```javascript
import { Resource } from 'duwende';

/**
 * User resource for handling user-related operations.
 * @extends Resource
 */
export class User extends Resource {
  constructor(hostname, service, name, config) {
    super(hostname, service, name, config);
    this.fileSystemTool = Resource.tools['file_system'].tool;
    this.cacheTool = Resource.tools['cache'].tool;
  }

  /**
   * Handle GET request for a user.
   * @param {Request} request - The incoming request object.
   * @param {string} id - The user ID.
   * @returns {Promise<Response>} The response object.
   */
  async handleGet(request, id) {
    if (!id) {
      return this.createErrorResponse('User ID is required', 400);
    }

    try {
      const cacheInstance = new this.cacheTool({ ttl: 300 }); // 5 minutes TTL
      const cachedUser = await cacheInstance.use({ action: 'get', key: `user:${id}` });
      if (cachedUser.status === 200) {
        return this.createJsonResponse(cachedUser.content);
      }

      const user = await this.getUserById(id);
      if (!user) {
        return this.createErrorResponse('User not found', 404);
      }

      await cacheInstance.use({ action: 'set', key: `user:${id}`, value: user });
      return this.createJsonResponse(user);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Handle LIST request for users.
   * @param {Request} request - The incoming request object.
   * @returns {Promise<Response>} The response object.
   */
  async handleList(request) {
    try {
      const users = await this.getAllUsers();
      return this.createJsonResponse(users);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get a user by ID.
   * @param {string} id - The user ID.
   * @returns {Promise<Object|null>} The user object or null if not found.
   */
  async getUserById(id) {
    const fileSystemInstance = new this.fileSystemTool({ root: this.config.dataPath });
    const filePath = `users/${id}.json`;
    const result = await fileSystemInstance.use({ action: 'read', path: filePath });
    return result.status === 200 ? JSON.parse(result.content) : null;
  }

  /**
   * Get all users.
   * @returns {Promise<Array>} An array of user objects.
   */
  async getAllUsers() {
    const fileSystemInstance = new this.fileSystemTool({ root: this.config.dataPath });
    const listResult = await fileSystemInstance.use({ action: 'list', path: 'users' });
    if (listResult.status !== 200) {
      throw new Error('Failed to list user files');
    }
    
    const userPromises = listResult.content.map(file => 
      fileSystemInstance.use({ action: 'read', path: `users/${file}` })
    );
    const userContents = await Promise.all(userPromises);
    return userContents
      .filter(result => result.status === 200)
      .map(result => JSON.parse(result.content));
  }

  /**
   * Create a JSON response.
   * @param {Object|Array} data - The data to be sent in the response.
   * @param {number} [status=200] - The HTTP status code.
   * @returns {Response} The response object.
   */
  createJsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Create an error response.
   * @param {string} message - The error message.
   * @param {number} [status=500] - The HTTP status code.
   * @returns {Response} The response object.
   */
  createErrorResponse(message, status = 500) {
    return this.createJsonResponse({ error: message }, status);
  }

  /**
   * Handle errors and create appropriate responses.
   * @param {Error} error - The error object.
   * @returns {Response} The error response.
   */
  handleError(error) {
    console.error('Error in User resource:', error);
    return this.createErrorResponse('Internal Server Error');
  }
}

export const user = User;
```

This example demonstrates the following guidelines:

1. Proper class structure extending the Resource class from duwende.
2. Use of provided tools (file_system and cache) instead of external libraries.
3. Early returns for error cases (e.g., missing user ID).
4. Higher-order functions used in `getAllUsers` (map, filter).
5. Only `const` used for variable declarations.
6. Small, focused methods with descriptive names.
7. Correct HTTP status codes used in responses.
8. Error logging and handling.
9. Caching mechanism used to improve performance.
10. JSDoc comments for documentation.
11. No nested conditionals (maximum one level used).
12. Proper instantiation and use of tools with correct parameter structure.

Note that this example doesn't cover all aspects of resource implementation (e.g., POST, PUT, DELETE methods) but serves as a starting point to illustrate the coding guidelines in practice.
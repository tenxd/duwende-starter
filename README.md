# duwende-starter

A starter project template for building applications with the DUWENDE framework (Dynamic Unified Web-Enabled Network Development Engine). This template provides the basic structure and configuration needed to begin developing with DUWENDE, an ultra-lightweight, flexible, and extensible web application nano-framework built with Bun.

## Overview

DUWENDE follows a Resource-Oriented Architecture (ROA) where everything is modeled as a resource. This starter project includes:

- Pre-configured project structure
- Basic resource examples
- Common utility tools
- Testing setup
- Configuration templates

For detailed documentation:
- [Creating New Resources](docs/creating_new_resource.md)
- [Creating New Tools](docs/creating_new_tool.md)

## Project Structure

```
duwende-starter/
├── config.json         # Main configuration file
├── services/          # Service-specific resources
│   └── api/
│       └── resources/
│           └── user.js
├── tools/             # Utility tools
│   ├── file_system_tool.js
│   ├── greeting_tool.js
│   ├── jwt_tool.js
│   ├── mustache_tool.js
│   ├── postgresql_tool.js
│   └── sqlite_tool.js
├── views/             # Mustache templates
│   └── user/
│       └── greeting.mustache
└── test/              # Test files
    ├── user.test.js
    └── tools/
        └── ...
```

## Key Concepts

### Resource-Oriented Architecture (ROA)

DUWENDE follows a strict resource-oriented architecture where everything is modeled as a resource (noun) rather than actions (verbs). Resources map naturally to REST operations:

- GET: Retrieve a resource
- LIST: Special method for retrieving collections (GET without ID)
- POST: Create a new resource
  - Without ID: Create a new standalone resource
  - With ID: Create a new resource derived from an existing one
- PUT: Replace a resource
- PATCH: Update a resource
- DELETE: Remove a resource

Example: Instead of a "login" endpoint, you create a "login" resource:
- POST /login (create a login session)
- DELETE /login (logout/destroy session)

### Resources

Resources handle specific types of requests and are the core building blocks of your application. They:
- Must be pure in their implementation - no external imports allowed
- Use tools for any external interactions (databases, files, APIs)
- Can implement two types of methods for each HTTP operation:
  - `handleXXX()`: For API responses (returns JSON)
  - `renderXXX()`: For HTML responses (returns rendered content)

Example Resource:
```javascript
class UserResource extends Resource {
  // ... constructor and other methods ...

  async handleGet(request, id, path) {
    return new Response(JSON.stringify({
      id: id,
      name: "John Doe"
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async renderGet(request, id, path) {
    return new Response(`
      <html>
        <body>
          <h1>User Profile</h1>
          <p>ID: ${id}</p>
          <p>Name: John Doe</p>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ... other HTTP method handlers ...
}
```

## Demo Implementation

This starter project includes a demo implementation that showcases how to use multiple tools together in a resource. The demo consists of a User resource that combines the greeting_tool for generating personalized greetings and the mustache_tool for HTML rendering.

### Greeting Tool

The Greeting tool demonstrates how to create a reusable component that follows the tool schema:

```javascript
class GreetingTool extends Tool {
  constructor(params) {
    super(params);
    this.defaultGreeting = params.defaultGreeting || 'Hello';
  }

  async use(params) {
    try {
      const greeting = this.defaultGreeting;
      const name = params.name || 'World';
      
      return {
        status: 200,
        content: `${greeting}, ${name}!`
      };
    } catch (error) {
      return {
        status: 500,
        content: error.message
      };
    }
  }

  static init_schema() {
    return {
      defaultGreeting: { type: 'string', required: false }
    };
  }

  static in_schema() {
    return {
      name: { type: 'string', required: false }
    };
  }

  // ... out_schema and other methods ...
}
```

Key features demonstrated:
- Schema definitions for initialization and input parameters
- Default values for optional parameters
- Proper error handling
- Clear, focused functionality

### User Resource

The User resource shows how to use multiple tools and handle both API and HTML responses:

```javascript
class User extends Resource {
  constructor(hostname, service, name, config) {
    super(hostname, service, name, config);
    this.greetingTool = Resource.tools['greeting_tool'].tool;
    this.mustacheTool = Resource.tools['mustache_tool'].tool;
  }

  async handleGet(request, id) {
    try {
      const greeter = new this.greetingTool({ defaultGreeting: this.config.defaultGreeting });
      const user = { id, name: id };
      const greeting = await greeter.use({ name: user.name });
      
      return new Response(JSON.stringify({
        user,
        greeting: greeting.content
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async renderGet(request, id) {
    try {
      const greeter = new this.greetingTool({ defaultGreeting: this.config.defaultGreeting });
      const user = { id, name: id };
      const greeting = await greeter.use({ name: user.name });

      const renderer = new this.mustacheTool({ baseDir: 'views' });
      const result = await renderer.use({
        templatePath: 'user/greeting.mustache',
        data: { greeting: greeting.content }
      });
      
      return new Response(result.renderedContent, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    } catch (error) {
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  // ... handleList, renderList, and other methods ...
}
```

Key features demonstrated:
- Using multiple tools in a single resource (greeting_tool and mustache_tool)
- Resource-specific configuration usage
- Template-based HTML rendering with mustache
- Consistent behavior between API and HTML endpoints
- Error handling

### Template Structure

The views directory contains Mustache templates used by resources:

```
views/
└── user/
    └── greeting.mustache
```

The greeting template demonstrates:
- Simple, focused template design
- Separation of presentation from logic
- Reuse across different endpoints (GET and LIST)

### Configuration

The config.json shows how to provide resource-specific settings:

```json
{
  "global": {
    "resourcePath": "services/${service}/resources/${name}.js"
  },
  "resources": {
    "user": {
      "defaultGreeting": "Welcome"
    }
  }
}
```

This demonstrates:
- Global configuration for resource paths
- Resource-specific configuration
- Configuration inheritance and override patterns

### Resource Path Configuration
The `resourcePath` in `config.json` determines where your resource files are located. It supports dynamic path interpolation using variables:
```json
{
  "global": {
    "resourcePath": "services/${service}/resources/${name}.js"
  }
}
```
Variables that can be interpolated:
- `${hostname}`: The hostname from the request
- `${service}`: The service name
- `${name}`: The resource name

This allows for flexible organization of resources. For example, with the above configuration:
- A request to `/api/user` would look for a resource at `services/api/resources/user.js`
- You can customize this pattern to match your project's structure

### Tools
Tools provide reusable functionality for resources. They:
- Handle all external interactions (database connections, file operations, API calls)
- Are loaded at server startup and made available to resources
- Must implement specific schemas for initialization, input, and output
- Handle common operations like file system access, database operations, etc.

### Configuration
The `config.json` file contains both global and resource-specific settings:
```json
{
  "global": {
    "resourcePath": "services/${service}/resources/${name}.js"
  },
  "resources": {
    "resourceName": {
      // resource-specific configuration
    }
  }
}
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.2.21 or later

### Installation

1. Clone this repository:
```bash
git clone [repository-url] my-duwende-project
cd my-duwende-project
```

2. Install dependencies:
```bash
bun install
```

### CLI Commands

The framework provides several CLI commands to help you create new components:

```bash
# Create a new resource
bunx duwende resource <name> <service> [hostname]

# Create a new tool
bunx duwende tool <name>

# List installed tools
bunx duwende tools
```

### Running the Project

To start the server:
```bash
bun run index.js
```

### Running Tests

```bash
bun test
```

## Project Setup

1. Configure your application in `config.json`:
   - Set the `resourcePath` pattern for your resource files
   - Add any resource-specific configuration under `resources`
2. Add new resources using the CLI command or manually in the appropriate service directory
3. Create custom tools using the CLI command or manually in the `tools/` directory
4. Write tests for your resources and tools in the `test/` directory

## Best Practices

- Keep resources focused on single responsibilities
- Use provided tools instead of external libraries in resources
- Handle errors gracefully in both resources and tools
- Follow the defined schemas for tool inputs and outputs
- Write tests for new resources and tools
- Keep resources pure - use tools for external interactions

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

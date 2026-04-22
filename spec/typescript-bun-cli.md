# TypeScript CLI

Creating a CLI tool with Bun and TypeScript provides a highly optimized, fast-booting developer experience. While Python uses `uv` for environment/package management and `typer` for argument parsing, the TypeScript ecosystem uses Bun for the runtime/package management and libraries like `cac` or `cmd-ts` for parsing.

Bun executes TypeScript natively without a compilation step, and its startup time is typically under 20ms, making it ideal for command-line interfaces.

Here is the process to build, test, and compile a CLI tool using Bun and `cac` (a lightweight, zero-dependency argument parser).

### 1. Initialize the Project

Create a new directory and initialize an empty Bun project. Bun will automatically generate the `package.json` and `tsconfig.json` files.

```bash
mkdir my-bun-cli
cd my-bun-cli
bun init -y
```

### 2. Install the CLI Framework

Install `cac` (Command And Conquer). It is highly performant, weighs approximately 5kB, and provides a declarative API similar to Typer or Click.

```bash
bun add cac
```

*Note: If you require strict runtime type inference identical to Typer's Pydantic integration, use `bun add cmd-ts` instead.*

### 3. Write the CLI Logic

Open the generated `index.ts` file and replace its contents. You must include the shebang (`#!/usr/bin/env bun`) at the very top of the file so Unix-like systems know which interpreter to use.

```typescript
#!/usr/bin/env bun
import { cac } from 'cac';

const cli = cac('my-cli');

// Define a command, its arguments, and options
cli
  .command('greet <name>', 'Greet a user by name')
  .option('-u, --uppercase', 'Convert the name to uppercase')
  .option('-e, --exclamation <count>', 'Number of exclamation marks', { default: 1 })
  .action((name: string, options: { uppercase?: boolean; exclamation: number }) => {
    let outputName = options.uppercase ? name.toUpperCase() : name;
    let punctuation = '!'.repeat(options.exclamation);

    console.log(`Hello, ${outputName}${punctuation}`);
  });

// Display help message when no arguments or --help is passed
cli.help();

// Display version number from package.json
cli.version('1.0.0');

// Parse the raw process arguments
cli.parse();
```

### 4. Configure the Executable

Modify your `package.json` to register the CLI command globally when installed. Add the `"bin"` field mapping your desired command name to the entry file.

```json
{
  "name": "my-bun-cli",
  "version": "1.0.0",
  "module": "index.ts",
  "type": "module",
  "bin": {
    "mycli": "./index.ts"
  },
  "dependencies": {
    "cac": "^6.7.14"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

### 5. Link the Package Locally

To test the command globally on your machine without publishing it, use Bun's linking feature.

```bash
bun link
```

You can now run your CLI tool from anywhere in your terminal:

* `mycli greet Alice`
* `mycli greet Bob --uppercase --exclamation 3`
* `mycli --help`

### 6. Compile to a Standalone Binary (Optional)

Bun can compile your TypeScript code and the Bun runtime into a single, standalone executable. This eliminates the need for users to have Bun or Node.js installed on their machines.

```bash
bun build ./index.ts --compile --outfile mycli
```

This generates a single binary file (`mycli`) weighing roughly 40MB to 50MB (containing the embedded runtime). You can execute it directly: `./mycli greet Charlie`.

### Ecosystem Comparison Table

| Feature / Need | Python Ecosystem | Bun + TypeScript Ecosystem |
| :--- | :--- | :--- |
| **Runtime & Execution** | Python + Virtualenv | Bun (Executes TS natively) |
| **Package Manager** | `uv` or `pip` | `bun install` |
| **Argument Parsing** | `typer` | `cac` (Simple) or `cmd-ts` (Strictly Typed) |
| **Project Initialization**| `uv init` | `bun init` |
| **Standalone Binary** | PyInstaller / Nuitka | `bun build --compile` |

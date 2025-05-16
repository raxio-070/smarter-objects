// sobj-error.ts

export class SObjError {
  name: string = 'SObjError';
  code?: string;
  message: string;
  constructor(message: string, code?: string) {
    this.message = message;
    this.code = code;
  }
  toString() {
    return (
      '\n' +
      '==============================\n' +
      '        SOBJ ERROR\n' +
      '==============================\n' +
      (this.code ? `Code: ${this.code}\n` : '') +
      this.message +
      '\n==============================\n'
    );
  }
  print() {
    // Print to console with color if available
    if (typeof process !== 'undefined' && process.stdout) {
      // Node.js: use ANSI color codes
      console.error('\x1b[31m' + this.toString() + '\x1b[0m');
    } else {
      // Browser or unknown: plain
      console.error(this.toString());
    }
  }
}

export function throwTypeError(key: string, expected: string, actual: string, value: any): never {
  const err = new SObjError(
    `Type mismatch for property '${key}':\n  Expected: ${expected}\n  Received: ${actual} (${JSON.stringify(value)})`,
    'SOBJ_TYPE_ERROR'
  );
  err.print();
  process.exit(1); // Exit the process with an error code
}

export function throwParserError(message: string): never {
  const err = new SObjError("Parser error:\n  " + message, 'SOBJ_PARSER_ERROR');
  err.print();
  process.exit(1); // Exit the process with an error code
}

export function throwInterpreterError(message: string): never {
  const err = new SObjError("Interpreter error:\n  " + message, 'SOBJ_INTERPRETER_ERROR');
  err.print();
  process.exit(1); // Exit the process with an error code
}

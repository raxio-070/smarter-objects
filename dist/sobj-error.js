"use strict";
// sobj-error.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.SObjError = void 0;
exports.throwTypeError = throwTypeError;
exports.throwParserError = throwParserError;
exports.throwInterpreterError = throwInterpreterError;
class SObjError {
    name = 'SObjError';
    code;
    message;
    constructor(message, code) {
        this.message = message;
        this.code = code;
    }
    toString() {
        return ('\n' +
            '==============================\n' +
            '        SOBJ ERROR\n' +
            '==============================\n' +
            (this.code ? `Code: ${this.code}\n` : '') +
            this.message +
            '\n==============================\n');
    }
    print() {
        // Print to console with color if available
        if (typeof process !== 'undefined' && process.stdout) {
            // Node.js: use ANSI color codes
            console.error('\x1b[31m' + this.toString() + '\x1b[0m');
        }
        else {
            // Browser or unknown: plain
            console.error(this.toString());
        }
    }
}
exports.SObjError = SObjError;
function throwTypeError(key, expected, actual, value) {
    const err = new SObjError(`Type mismatch for property '${key}':\n  Expected: ${expected}\n  Received: ${actual} (${JSON.stringify(value)})`, 'SOBJ_TYPE_ERROR');
    err.print();
    process.exit(1); // Exit the process with an error code
}
function throwParserError(message) {
    const err = new SObjError("Parser error:\n  " + message, 'SOBJ_PARSER_ERROR');
    err.print();
    process.exit(1); // Exit the process with an error code
}
function throwInterpreterError(message) {
    const err = new SObjError("Interpreter error:\n  " + message, 'SOBJ_INTERPRETER_ERROR');
    err.print();
    process.exit(1); // Exit the process with an error code
}

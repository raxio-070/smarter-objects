"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpretSObj = interpretSObj;
// SOBJ Interpreter: Evaluates the AST produced by sobj-parser.ts
const sobj_lexer_1 = require("./sobj-lexer");
const sobj_parser_1 = require("./sobj-parser");
const sobj_error_1 = require("./sobj-error");
const sobj_types_1 = require("./sobj-types");
function evalRawJS(raw, context = {}) {
    // Evaluate JS code in a sandboxed context (very basic, not secure)
    // You can enhance this to use a real sandbox if needed
    return Function(...Object.keys(context), raw)(...Object.values(context));
}
function evalSObjValue(value, context = {}) {
    if (typeof value === 'string' || typeof value === 'number') {
        return value;
    }
    if (value.type === 'Object') {
        return evalSObjObject(value, context);
    }
    if (value.type === 'Function') {
        // Return a JS function that can be called
        return function (...args) {
            const fnContext = { ...context };
            value.params.forEach((param, i) => {
                fnContext[param] = args[i];
            });
            if (value.body.type === 'RawJS') {
                return evalRawJS(value.body.code, fnContext);
            }
            else if (value.body.type === 'Object') {
                return evalSObjObject(value.body, fnContext);
            }
        };
    }
    if (value.type === 'RawJS') {
        return evalRawJS(value.code, context);
    }
    (0, sobj_error_1.throwInterpreterError)(`Unknown value type: ${JSON.stringify(value)}`);
}
function evalSObjObject(obj, context = {}) {
    const keys = new Map();
    const functions = new Map();
    let onchangeFn = undefined;
    // Collect property values, types, and functions
    for (const prop of obj.properties) {
        if (prop.key === '$onchange') {
            onchangeFn = evalSObjValue(prop.value, context);
            continue;
        }
        if (prop.value && prop.value.type === 'Function') {
            functions.set(prop.key, evalSObjValue(prop.value, context));
        }
        else {
            // If value is a RawJS, try to evaluate as JS expression and return the result
            if (prop.value && prop.value.type === 'RawJS') {
                let val;
                try {
                    val = evalRawJS('return' + prop.value.code, context);
                }
                catch {
                    val = evalRawJS(prop.value.code, context);
                }
                keys.set(prop.key, val);
            }
            else {
                keys.set(prop.key, evalSObjValue(prop.value, context));
            }
        }
    }
    // Collect types
    let types = obj.types instanceof Map ? obj.types : new Map();
    if (types.size === 0 && obj.properties) {
        for (const prop of obj.properties) {
            if (prop.valueType) {
                types.set(prop.key, prop.valueType);
            }
            else if (prop.inferredType) {
                types.set(prop.key, prop.inferredType);
            }
            else if (typeof prop.value === 'string') {
                types.set(prop.key, 'string');
            }
            else if (typeof prop.value === 'number') {
                types.set(prop.key, 'number');
            }
            else if (prop.value && typeof prop.value === 'object' && prop.value.type === 'Function') {
                types.set(prop.key, 'function');
            }
            else if (prop.value && typeof prop.value === 'object' && prop.value.type === 'Object') {
                types.set(prop.key, 'object');
            }
            else if (prop.value && typeof prop.value === 'object' && prop.value.type === 'RawJS') {
                let val;
                let inferredType = undefined;
                try {
                    val = evalRawJS('return' + prop.value.code, context);
                }
                catch {
                    val = evalRawJS(prop.value.code, context);
                }
                if (val !== undefined && val !== null) {
                    if (Array.isArray(val)) {
                        inferredType = 'array';
                    }
                    else {
                        inferredType = typeof val;
                    }
                }
                else {
                    inferredType = 'any';
                }
                types.set(prop.key, inferredType);
            }
            else {
                types.set(prop.key, 'any');
            }
        }
    }
    let result = { keys, functions, types };
    if (onchangeFn) {
        result.$onchange = onchangeFn;
        // Compose type enforcement and onchange in a single Proxy for keys
        const keysProxy = new Proxy(keys, {
            set(target, prop, value, receiver) {
                const key = typeof prop === 'string' ? prop : String(prop);
                const expectedType = types.get(key);
                if (expectedType && !(expectedType === 'any') && typeof value !== expectedType) {
                    (0, sobj_error_1.throwInterpreterError)(`Type mismatch for property '${key}': expected ${expectedType}, got ${typeof value}`);
                }
                const old = target.get(key);
                const isChanged = old !== value;
                target.set(key, value);
                if (isChanged && key !== '$onchange' && onchangeFn) {
                    onchangeFn(key, { old, new: value });
                }
                return true;
            },
            get(target, prop, receiver) {
                const key = typeof prop === 'string' ? prop : String(prop);
                return target.get(key);
            }
        });
        result.keys = keysProxy;
        // Also proxy the result object itself for direct property access
        return new Proxy(result, {
            set(target, prop, value, receiver) {
                const key = typeof prop === 'string' ? prop : String(prop);
                const expectedType = types.get(key);
                if (expectedType && !(expectedType === 'any') && typeof value !== expectedType) {
                    (0, sobj_error_1.throwInterpreterError)(`Type mismatch for property '${key}': expected ${expectedType}, got ${typeof value}`);
                }
                const keysMap = keys;
                const old = keysMap.has(key) ? keysMap.get(key) : undefined;
                const isChanged = old !== value;
                keysMap.set(key, value);
                if (isChanged && key !== '$onchange' && onchangeFn) {
                    onchangeFn(key, { old, new: value });
                }
                return true;
            },
            get(target, prop, receiver) {
                const key = typeof prop === 'string' ? prop : String(prop);
                const keysMap = keys;
                if (keysMap.has(key)) {
                    return keysMap.get(key);
                }
                return Reflect.get(target, prop, receiver);
            }
        });
    }
    result.types = types;
    return result;
}
function interpretSObj(input, context = {}) {
    const tokens = (0, sobj_lexer_1.tokenize)(input);
    const ast = (0, sobj_parser_1.parseSObj)(tokens);
    const result = evalSObjObject(ast, context);
    // Only wrap with enforceTypes if $onchange is not present (to avoid double-proxy)
    if (result.$onchange) {
        return result;
    }
    else {
        return (0, sobj_types_1.enforceTypes)(result);
    }
}
/*
// Example usage:
//
const result = interpretSObj(`{
  key1: string = "hello",
  key2 = 42,
  $onchange (key, value) => {
    [*njs]
    if (key == "key1") {
      console.log("key1 changed from", "'" + value.old + "'", "to", "'" + value.new + "'");
    }
    [njs*]
  }
}`);

console.dir(result, { depth: null });

// Test onchange
result.key1 = "hello";
// Should trigger
setTimeout(() => {
  result.key1 = "world";
}, 1000);
setTimeout(() => {
  result.key1 = 10; // Should not trigger, type mismatch, throw error
}, 2000);
result.key2 = 100;
// Show that $onchange is present and callable
if (typeof result.$onchange === 'function') {
  result.$onchange('manual', { old: 'foo', new: 'bar' });
}
*/

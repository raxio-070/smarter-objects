// SOBJ Interpreter: Evaluates the AST produced by sobj-parser.ts
import { tokenize } from './sobj-lexer';
import { parseSObj } from './sobj-parser';
import { SmarterObject } from './smarter-object';
import { throwInterpreterError } from './sobj-error';
import { enforceTypes } from './sobj-types';

// Types from parser
// type SObjValue = string | number | SObjObject | SObjFunction | SObjRawJS;
// interface SObjObject { type: 'Object'; properties: SObjProperty[]; }
// interface SObjProperty { key: string; value: SObjValue; valueType?: string; }
// interface SObjFunction { type: 'Function'; name: string; params: string[]; body: SObjRawJS | SObjObject; }
// interface SObjRawJS { type: 'RawJS'; code: string; }

export type SObjRuntimeValue = any;

function evalRawJS(raw: string, context: any = {}) {
  // Evaluate JS code in a sandboxed context (very basic, not secure)
  // You can enhance this to use a real sandbox if needed
  return Function(...Object.keys(context), raw)(...Object.values(context));
}

function evalSObjValue(value: any, context: any = {}): SObjRuntimeValue {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (value.type === 'Object') {
    return evalSObjObject(value, context);
  }
  if (value.type === 'Function') {
    // Return a JS function that can be called
    return function (...args: any[]) {
      const fnContext = { ...context };
      value.params.forEach((param: string, i: number) => {
        fnContext[param] = args[i];
      });
      if (value.body.type === 'RawJS') {
        return evalRawJS(value.body.code, fnContext);
      } else if (value.body.type === 'Object') {
        return evalSObjObject(value.body, fnContext);
      }
    };
  }
  if (value.type === 'RawJS') {
    return evalRawJS(value.code, context);
  }
  throwInterpreterError(`Unknown value type: ${JSON.stringify(value)}`);
}

function evalSObjObject(obj: any, context: any = {}): SmarterObject {
  const keys = new Map<string, any>();
  const functions = new Map<string, (...args: any[]) => any>();
  let onchangeFn: ((key: string, value: { old: any; new: any }) => void) | undefined = undefined;
  // Collect property values, types, and functions
  for (const prop of obj.properties) {
    if (prop.key === '$onchange') {
      onchangeFn = evalSObjValue(prop.value, context);
      continue;
    }
    if (prop.value && prop.value.type === 'Function') {
      functions.set(prop.key, evalSObjValue(prop.value, context));
    } else {
      // If value is a RawJS, try to evaluate as JS expression and return the result
      if (prop.value && prop.value.type === 'RawJS') {
        let val;
        try {
          val = evalRawJS('return' + prop.value.code, context);
        } catch {
          val = evalRawJS(prop.value.code, context);
        }
        keys.set(prop.key, val);
      } else {
        keys.set(prop.key, evalSObjValue(prop.value, context));
      }
    }
  }
  // Collect types
  let types = obj.types instanceof Map ? obj.types : new Map<string, string>();
  if (types.size === 0 && obj.properties) {
    for (const prop of obj.properties) {
      if (prop.valueType) {
        types.set(prop.key, prop.valueType);
      } else if (prop.inferredType) {
        types.set(prop.key, prop.inferredType);
      } else if (typeof prop.value === 'string') {
        types.set(prop.key, 'string');
      } else if (typeof prop.value === 'number') {
        types.set(prop.key, 'number');
      } else if (prop.value && typeof prop.value === 'object' && prop.value.type === 'Function') {
        types.set(prop.key, 'function');
      } else if (prop.value && typeof prop.value === 'object' && prop.value.type === 'Object') {
        types.set(prop.key, 'object');
      } else if (prop.value && typeof prop.value === 'object' && prop.value.type === 'RawJS') {
        let val;
        let inferredType = undefined;
        try {
          val = evalRawJS('return' + prop.value.code, context);
        } catch {
          val = evalRawJS(prop.value.code, context);
        }
        if (val !== undefined && val !== null) {
          if (Array.isArray(val)) {
            inferredType = 'array';
          } else {
            inferredType = typeof val;
          }
        } else {
          inferredType = 'any';
        }
        types.set(prop.key, inferredType);
      } else {
        types.set(prop.key, 'any');
      }
    }
  }
  let result: SmarterObject = { keys, functions, types };
  if (onchangeFn) {
    result.$onchange = onchangeFn;
    // Compose type enforcement and onchange in a single Proxy for keys
    const keysProxy = new Proxy(keys, {
      set(target, prop, value, receiver) {
        const key = typeof prop === 'string' ? prop : String(prop);
        const expectedType = types.get(key);
        if (expectedType && !(expectedType === 'any') && typeof value !== expectedType) {
          throwInterpreterError(`Type mismatch for property '${key}': expected ${expectedType}, got ${typeof value}`);
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
          throwInterpreterError(`Type mismatch for property '${key}': expected ${expectedType}, got ${typeof value}`);
        }
        const keysMap: Map<string, any> = keys;
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
        const keysMap: Map<string, any> = keys;
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

export function interpretSObj(input: string, context: any = {}): any {
  const tokens = tokenize(input);
  const ast = parseSObj(tokens);
  const result = evalSObjObject(ast, context);
  // Only wrap with enforceTypes if $onchange is not present (to avoid double-proxy)
  if (result.$onchange) {
    return result;
  } else {
    return enforceTypes(result);
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

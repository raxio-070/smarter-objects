import { SmarterObject } from './smarter-object';
import { throwTypeError } from './sobj-error';

export function checkType(value: any, type: string): boolean {
  if (type === 'any') return true;
  if (type === 'array') return Array.isArray(value);
  if (type === 'number') return typeof value === 'number' && isFinite(value);
  if (type === 'string') return typeof value === 'string';
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'function') return typeof value === 'function';
  // Strict fallback: do not allow number->string or string->number coercion
  return typeof value === type;
}

export function enforceTypes(obj: SmarterObject): SmarterObject {
  const types = obj.types;
  const keys = obj.keys;
  // Wrap keys Map in a Proxy for type enforcement
  const keysProxy = new Proxy(keys, {
    set(target, prop, value, receiver) {
      const key = typeof prop === 'string' ? prop : String(prop);
      const expectedType = types.get(key);
      if (expectedType && !checkType(value, expectedType)) {
        // If expectedType is 'string' and value is a number, disallow (even if JS would coerce)
        throwTypeError(key, expectedType, typeof value, value);
      }
      // Only set if type matches
      target.set(key, value);
      return true;
    },
    get(target, prop, receiver) {
      const key = typeof prop === 'string' ? prop : String(prop);
      return target.get(key);
    }
  });
  obj.keys = keysProxy;
  // Also wrap the object itself for direct property access
  return new Proxy(obj, {
    set(target, prop, value, receiver) {
      const key = typeof prop === 'string' ? prop : String(prop);
      const expectedType = types.get(key);
      if (expectedType && !checkType(value, expectedType)) {
        throwTypeError(key, expectedType, typeof value, value);
      }
      if (target.keys instanceof Map) {
        target.keys.set(key, value);
        return true;
      }
      return Reflect.set(target, prop, value, receiver);
    },
    get(target, prop, receiver) {
      const key = typeof prop === 'string' ? prop : String(prop);
      if (target.keys instanceof Map && target.keys.has(key)) {
        return target.keys.get(key);
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

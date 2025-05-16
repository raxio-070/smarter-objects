export interface SmarterObject {
  keys: Map<string, any>;
  functions: Map<string, (...args: any[]) => any>;
  types: Map<string, string>;
  $onchange?: (key: string, value: { old: any; new: any }) => void;
}

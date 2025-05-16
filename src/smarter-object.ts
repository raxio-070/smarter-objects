export interface SmarterObject {
  keys: Map<string, any>;
  $onchange?: (key: string, value: { old: any; new: any }) => void;
}

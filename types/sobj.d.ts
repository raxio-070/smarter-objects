import { interpretSObj } from "../src/sobj-interpreter";

/**
 * Handler type for property changes in the SObj.
 */
export type SObjOnChangeHandler = (key: string, value: { old: any; new: any }) => void;

/**
 * Interface representing the structure of the object returned by sobj.
 */
export interface SObj {
  name: string;
  age: number;
  city: string;
  $onchange?: SObjOnChangeHandler;
}

/**
 * The sobj template tag function.
 * Accepts a template string and returns a strongly-typed object.
 */
export declare function sobj(
  obj: TemplateStringsArray
): SObj;

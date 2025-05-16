import { interpretSObj } from "./sobj-interpreter";

export function sobj(obj: TemplateStringsArray): any {
  const code = obj[0];
  return interpretSObj(code);
}

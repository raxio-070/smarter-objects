import { SmarterObject } from './smarter-object';

export function sobj(obj: string): SmarterObject {
  const code = obj[0];
  const finalSobj: SmarterObject = {};
  return finalSobj;
}

/* syntax:
import { sobj } from 'smarter-objects';
const myObj = sobj`{
  name: "John",
  age: 30,
  city: "New York"
}`;
*/

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sobj = sobj;
function sobj(obj) {
    const code = obj[0];
    const finalSobj = { keys: new Map() };
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

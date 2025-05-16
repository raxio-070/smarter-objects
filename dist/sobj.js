"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sobj = sobj;
const sobj_interpreter_1 = require("./sobj-interpreter");
function sobj(obj) {
    const code = obj[0];
    return (0, sobj_interpreter_1.interpretSObj)(code);
}
const myObj = sobj `{
  name: string = "John",
  age: number = 30,
  city: string = "New York",
  $onchange (key, value) => {
    [*njs]
    console.log(\`Property \${key} changed from "\${value.old}" to "\${value.new}"\`);
    [njs*]
  }
}`;
myObj.name = "Jane"; // Should trigger onchange
setTimeout(() => {
    myObj.age = 31; // Should trigger onchange
}, 1000);
setTimeout(() => {
    myObj.city = "Los Angeles"; // Should trigger onchange
}, 2000);
setTimeout(() => {
    myObj.age = "thirty"; // Should throw type error
}, 3000);

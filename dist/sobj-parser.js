"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSObj = parseSObj;
// SOBJ Parser: Parses tokens from sobj-lexer.ts into an AST
const sobj_lexer_1 = require("./sobj-lexer");
const sobj_error_1 = require("./sobj-error");
// Parser implementation
class Parser {
    tokens;
    pos = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    peek(offset = 0) {
        return this.tokens[this.pos + offset];
    }
    next() {
        return this.tokens[this.pos++];
    }
    expect(type) {
        const token = this.next();
        if (token.type !== type) {
            throw new Error(`Expected token ${type}, got ${token.type} at line ${token.line}, column ${token.column}`);
        }
        return token;
    }
    parse() {
        this.expect(sobj_lexer_1.TokenType.ObjectStart);
        const properties = this.parseProperties();
        this.expect(sobj_lexer_1.TokenType.ObjectEnd);
        return { type: 'Object', properties };
    }
    parseProperties() {
        const properties = [];
        while (this.peek() && this.peek().type !== sobj_lexer_1.TokenType.ObjectEnd && this.peek().type !== sobj_lexer_1.TokenType.CloseBracket) {
            if (this.peek().type === sobj_lexer_1.TokenType.Comma) {
                this.next(); // skip comma
                continue;
            }
            // Skip NJS blocks at the property level (for function bodies)
            if (this.peek().type === sobj_lexer_1.TokenType.NJSBlockStart) {
                this.next(); // skip NJSBlockStart
                if (this.peek() && this.peek().type === sobj_lexer_1.TokenType.RawJS) {
                    this.next(); // skip RawJS
                }
                if (this.peek() && this.peek().type === sobj_lexer_1.TokenType.NJSBlockEnd) {
                    this.next(); // skip NJSBlockEnd
                }
                continue;
            }
            properties.push(this.parseProperty());
        }
        return properties;
    }
    parseProperty() {
        let keyToken = this.next();
        let key;
        let valueType = undefined;
        let inferredType = undefined;
        if (keyToken.type === sobj_lexer_1.TokenType.Identifier || keyToken.type === sobj_lexer_1.TokenType.FunctionName) {
            key = keyToken.value;
        }
        else {
            (0, sobj_error_1.throwParserError)(`Expected property key, got ${keyToken.type}`);
        }
        // Optional type annotation
        if (this.peek() && this.peek().type === sobj_lexer_1.TokenType.Colon) {
            this.next(); // skip :
            const typeToken = this.expect(sobj_lexer_1.TokenType.Identifier);
            valueType = typeToken.value;
        }
        // Assignment or function
        if (this.peek() && this.peek().type === sobj_lexer_1.TokenType.Equals) {
            this.next(); // skip =
            const value = this.parseValue();
            // Infer type if not explicitly set
            if (!valueType) {
                if (typeof value === 'string')
                    inferredType = 'string';
                else if (typeof value === 'number')
                    inferredType = 'number';
                else if (value && value.type === 'Object')
                    inferredType = 'object';
                else if (value && value.type === 'RawJS')
                    inferredType = 'any';
            }
            return { key, value, valueType, inferredType };
        }
        else if (this.peek() && this.peek().type === sobj_lexer_1.TokenType.OpenParenthesis) {
            // Function property
            const func = this.parseFunction(key);
            return { key, value: func, valueType: 'function' };
        }
        else {
            (0, sobj_error_1.throwParserError)(`Unexpected token after property key: ${this.peek()?.type}`);
        }
    }
    parseValue() {
        const token = this.peek();
        if (!token)
            (0, sobj_error_1.throwParserError)('Unexpected end of input while parsing value');
        if (token.type === sobj_lexer_1.TokenType.String) {
            this.next();
            return token.value;
        }
        else if (token.type === sobj_lexer_1.TokenType.Number) {
            this.next();
            return Number(token.value);
        }
        else if (token.type === sobj_lexer_1.TokenType.RawJS) {
            this.next();
            return { type: 'RawJS', code: token.value };
        }
        else if (token.type === sobj_lexer_1.TokenType.OpenBracket || token.type === sobj_lexer_1.TokenType.ObjectStart) {
            return this.parseObject();
        }
        else {
            (0, sobj_error_1.throwParserError)(`Unexpected token type for value: ${token.type}`);
        }
    }
    parseObject() {
        // Accept both OpenBracket and ObjectStart for nested objects
        if (this.peek().type === sobj_lexer_1.TokenType.OpenBracket) {
            this.next();
        }
        else if (this.peek().type === sobj_lexer_1.TokenType.ObjectStart) {
            this.next();
        }
        const properties = this.parseProperties();
        // Collect types and functions
        const types = new Map();
        const functions = new Map();
        for (const prop of properties) {
            // Only check .type if value is an object
            if (prop.valueType === 'function' &&
                typeof prop.value === 'object' &&
                prop.value !== null &&
                'type' in prop.value &&
                prop.value.type === 'Function') {
                functions.set(prop.key, prop.value);
            }
            if (prop.valueType) {
                types.set(prop.key, prop.valueType);
            }
            else if (prop.inferredType) {
                types.set(prop.key, prop.inferredType);
            }
        }
        if (this.peek().type === sobj_lexer_1.TokenType.CloseBracket) {
            this.next();
        }
        else if (this.peek().type === sobj_lexer_1.TokenType.ObjectEnd) {
            this.next();
        }
        return { type: 'Object', properties, types, functions };
    }
    parseFunction(name) {
        this.expect(sobj_lexer_1.TokenType.OpenParenthesis);
        const params = [];
        while (this.peek() && this.peek().type !== sobj_lexer_1.TokenType.CloseParenthesis) {
            const paramToken = this.expect(sobj_lexer_1.TokenType.Identifier);
            params.push(paramToken.value);
            if (this.peek() && this.peek().type === sobj_lexer_1.TokenType.Comma) {
                this.next();
            }
        }
        this.expect(sobj_lexer_1.TokenType.CloseParenthesis);
        this.expect(sobj_lexer_1.TokenType.ArrowFunction);
        // Function body can be a block or NJS block
        let body;
        if (this.peek().type === sobj_lexer_1.TokenType.NJSBlockStart) {
            this.next(); // skip NJSBlockStart
            const rawjsToken = this.expect(sobj_lexer_1.TokenType.RawJS);
            this.expect(sobj_lexer_1.TokenType.NJSBlockEnd);
            body = { type: 'RawJS', code: rawjsToken.value };
        }
        else if (this.peek().type === sobj_lexer_1.TokenType.OpenBracket || this.peek().type === sobj_lexer_1.TokenType.ObjectStart) {
            // Try to parse a block, but if it only contains a single NJS block, treat as RawJS
            const startPos = this.pos;
            this.next(); // consume the bracket
            if (this.peek() && this.peek().type === sobj_lexer_1.TokenType.NJSBlockStart) {
                this.next(); // skip NJSBlockStart
                const rawjsToken = this.expect(sobj_lexer_1.TokenType.RawJS);
                this.expect(sobj_lexer_1.TokenType.NJSBlockEnd);
                if (this.peek() && (this.peek().type === sobj_lexer_1.TokenType.CloseBracket || this.peek().type === sobj_lexer_1.TokenType.ObjectEnd)) {
                    this.next(); // consume closing bracket
                    body = { type: 'RawJS', code: rawjsToken.value };
                    return { type: 'Function', name, params, body };
                }
                else {
                    // Not a single NJS block, fallback to object parsing
                    this.pos = startPos; // rewind
                }
            }
            else {
                this.pos = startPos; // rewind
            }
            body = this.parseObject();
        }
        else {
            (0, sobj_error_1.throwParserError)('Expected function body after =>');
        }
        return { type: 'Function', name, params, body };
    }
}
// Exported parse function
function parseSObj(tokens) {
    const parser = new Parser(tokens);
    return parser.parse();
}
// Example usage (for testing):
/*const ast = parseSObj(tokenize(`{
  key1: string = "hello",
  key2 = 42,
  $onchange (key, value) => {
    [*njs]
    if (key == "key1") {
      console.log("key1 changed from ", value.old, " to ", value.new);
    }
    [njs*]
  }
}`));
console.dir(ast, { depth: null });
*/

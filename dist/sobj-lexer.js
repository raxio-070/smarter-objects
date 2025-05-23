"use strict";
/*
End goal to lex:
{
  key1: string = "hello",
  key2 = 42, // Inferred type number
  $onchange (key, value) => { // key: string, value: object {old: any, new: any}
  [*njs]
    if (key == "key1") {
      console.log("key1 changed from ", value.old, " to ", value.new);
    }
  [njs*]
  }
}
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenType = void 0;
exports.tokenize = tokenize;
var TokenType;
(function (TokenType) {
    TokenType["ObjectStart"] = "ObjectStart";
    TokenType["ObjectEnd"] = "ObjectEnd";
    TokenType["OpenBracket"] = "OpenBracket";
    TokenType["CloseBracket"] = "CloseBracket";
    TokenType["Identifier"] = "Identifier";
    TokenType["FunctionName"] = "FunctionName";
    TokenType["String"] = "String";
    TokenType["Number"] = "Number";
    TokenType["Colon"] = "Colon";
    TokenType["Comma"] = "Comma";
    TokenType["Equals"] = "Equals";
    TokenType["ArrowFunction"] = "ArrowFunction";
    TokenType["OpenParenthesis"] = "OpenParenthesis";
    TokenType["CloseParenthesis"] = "CloseParenthesis";
    TokenType["NJSBlockStart"] = "NJSBlockStart";
    TokenType["NJSBlockEnd"] = "NJSBlockEnd";
    //Comment = 'Comment', // //
    TokenType["RawJS"] = "RawJS";
})(TokenType || (exports.TokenType = TokenType = {}));
function isWhitespace(char) {
    return char == ' ' || char == '\t' || char == '\n' || char == '\r';
}
function isIdentifier(char) {
    return char != undefined && (/[a-zA-Z_$]/.test(char));
}
function isAlphanumeric(char) {
    return char != undefined && (/[a-zA-Z0-9_$]/.test(char));
}
function isNumber(char) {
    return char != undefined && (/[0-9]/.test(char));
}
function tokenize(srcObj) {
    const src = srcObj.split("");
    const tokens = [];
    let line = 1;
    let column = 1;
    while (src.length > 0) {
        const char = src.shift();
        if (isWhitespace(char)) {
            if (char == "\n" || char == "\r") {
                if (char == "\r" && src[0] == "\n") {
                    src.shift(); // Consume \n after \r
                }
                line++;
                column = 1;
            }
            else {
                column++;
            }
            continue;
        }
        else if (char == "{") {
            if (tokens.length == 0) {
                tokens.push({ type: TokenType.ObjectStart, value: char, line, column });
            }
            else {
                tokens.push({ type: TokenType.OpenBracket, value: char, line, column });
            }
        }
        else if (char == "}") {
            if (src.length == 0) {
                tokens.push({ type: TokenType.ObjectEnd, value: char, line, column });
            }
            else {
                tokens.push({
                    type: TokenType.CloseBracket,
                    value: char,
                    line,
                    column,
                });
            }
        }
        else if (char == "[") {
            if (src.length >= 5 && src.slice(0, 5).join("") == "*njs]") {
                src.shift(); // Consume the '*'
                src.shift(); // Consume 'n'
                src.shift(); // Consume 'j'
                src.shift(); // Consume 's'
                src.shift(); // Consume ']'
                tokens.push({
                    type: TokenType.NJSBlockStart,
                    value: "[*njs]",
                    line,
                    column,
                });
                column += 5; // Adjust column for the consumed characters
                let rawjs = "";
                while (src.length >= 6 && src.slice(0, 6).join("") != "[njs*]") {
                    const nextChar = src.shift();
                    if (nextChar == "\n" || nextChar == "\r") {
                        if (nextChar == "\r" && src[0] == "\n") {
                            src.shift(); // Consume \n after \r
                        }
                        line++;
                        column = 1;
                    }
                    else if (nextChar == undefined) {
                        throw new Error(`Unexpected end of input while lexing SOBJ at line ${line}, column ${column}.`);
                    }
                    else {
                        column++;
                    }
                    rawjs += nextChar;
                }
                if (rawjs.trim()) {
                    tokens.push({ type: TokenType.RawJS, value: rawjs, line, column });
                }
                // Always consume [njs*] and push NJSBlockEnd
                if (src.length >= 6 && src.slice(0, 6).join("") == "[njs*]") {
                    src.shift(); // [
                    src.shift(); // n
                    src.shift(); // j
                    src.shift(); // s
                    src.shift(); // *
                    src.shift(); // ]
                    tokens.push({
                        type: TokenType.NJSBlockEnd,
                        value: "[njs*]",
                        line,
                        column,
                    });
                    column += 6; // Adjust column for the consumed characters
                }
            }
            else {
                tokens.push({ type: TokenType.OpenBracket, value: char, line, column });
            }
        }
        else if (char == "]") {
            tokens.push({ type: TokenType.CloseBracket, value: char, line, column });
        }
        else if (char == ":") {
            tokens.push({ type: TokenType.Colon, value: char, line, column });
        }
        else if (char == ",") {
            tokens.push({ type: TokenType.Comma, value: char, line, column });
        }
        else if (char == "=") {
            if (src[0] == ">") {
                src.shift();
                column++; // Adjust column for the consumed '>'
                tokens.push({
                    type: TokenType.ArrowFunction,
                    value: "=>",
                    line,
                    column,
                });
            }
            else {
                tokens.push({ type: TokenType.Equals, value: char, line, column });
                let rawjs = "";
                while (src.length > 0 && src[0] != ",") {
                    const nextChar = src.shift();
                    if (nextChar == "\n" || nextChar == "\r") {
                        if (nextChar == "\r" && src[0] == "\n") {
                            src.shift(); // Consume \n after \r
                        }
                        line++;
                        column = 1;
                    }
                    else if (nextChar == undefined) {
                        throw new Error(`Unexpected end of input while lexing SOBJ at line ${line}, column ${column}.`);
                    }
                    else {
                        column++;
                    }
                    rawjs += nextChar;
                }
                if (rawjs.trim()) {
                    tokens.push({ type: TokenType.RawJS, value: rawjs, line, column });
                    tokens.push({ type: TokenType.Comma, value: ",", line, column });
                }
            }
        }
        else if (char == "(") {
            tokens.push({
                type: TokenType.OpenParenthesis,
                value: char,
                line,
                column,
            });
        }
        else if (char == ")") {
            tokens.push({
                type: TokenType.CloseParenthesis,
                value: char,
                line,
                column,
            });
        }
        else if (char == "/") {
            if (src[0] == "/") {
                src.shift(); // Consume the second /
                //let comment: string = '';
                column++; // Adjust column for the consumed /
                while (src.length > 0 && ["\n", "\r"].includes(src[0]) === false) {
                    /*comment += */ src.shift();
                    column++;
                }
                //tokens.push({ type: TokenType.Comment, value: comment, line, column });
            }
            else if (src[0] == "*") {
                src.shift(); // Consume the *
                //let comment: string = '/*';
                column++; // Adjust column for the consumed *
                while (src.length > 0 && !(src[0] == "*" && src[1] == "/")) {
                    /*comment += */
                    const nextChar = src.shift();
                    if (nextChar == "\n" || nextChar == "\r") {
                        if (nextChar == "\r" && ["\n"].includes(src[0])) {
                            src.shift(); // Consume \n after \r
                        }
                        line++;
                        column = 1;
                    }
                    else if (nextChar == undefined) {
                        throw new Error(`Unexpected end of input while lexing SOBJ at line ${line}, column ${column}.`);
                    }
                    else {
                        column++;
                    }
                }
                if (src.length > 1) {
                    /*comment += */ src.shift(); // Consume the *
                    /*comment += */ src.shift(); // Consume the /
                    column += 2; // Adjust column for the closing */
                }
                //tokens.push({ type: TokenType.Comment, value: comment, line, column });
            }
        }
        else if (isIdentifier(char)) {
            let identifier = char ?? "";
            while (src.length > 0 && isAlphanumeric(src[0])) {
                identifier += src.shift();
            }
            if (identifier == "$onchange") {
                tokens.push({
                    type: TokenType.FunctionName,
                    value: identifier,
                    line,
                    column,
                });
            }
            else {
                tokens.push({
                    type: TokenType.Identifier,
                    value: identifier,
                    line,
                    column,
                });
            }
            column += identifier.length - 1; // Adjust column for the length of the identifier
        }
        else if (isNumber(char)) {
            let number = char ?? "";
            while (src.length > 0 && isNumber(src[0])) {
                number += src.shift();
            }
            tokens.push({ type: TokenType.Number, value: number, line, column });
            column += number.length - 1; // Adjust column for the length of the number
        }
        else if (char == '"') {
            let string = "";
            while (src.length > 0 && src[0] != '"') {
                string += src.shift();
            }
            src.shift(); // Consume the closing "
            tokens.push({ type: TokenType.String, value: string, line, column });
            column += string.length + 1; // Adjust column for the length of the string and the closing "
        }
        else if (char == "'") {
            let string = "";
            while (src.length > 0 && src[0] != "'") {
                string += src.shift();
            }
            src.shift(); // Consume the closing '
            tokens.push({ type: TokenType.String, value: string, line, column });
            column += string.length + 1; // Adjust column for the length of the string and the closing '
        }
        else {
            console.log(tokens
                .map((token) => `${token.type} (${token.value}) at line ${token.line}, column ${token.column}`)
                .join("\n"));
            throw new Error(`Unexpected character '${char}' at line ${line}, column ${column} while lexing SOBJ.`);
        }
        column++;
    }
    return tokens;
}
/*
const tokens = tokenize(`{
  key1: string = "hello",
  key2 = 42, // Inferred type number
  $onchange (key, value) => { // key: string, value: object {old: any, new: any}
  [*njs]
    if (key == "key1") {
      console.log("key1 changed from ", value.old, " to ", value.new);
    }
  [njs*]
  }
}`);
console.log(tokens);
*/

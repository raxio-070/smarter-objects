/*
End goal to lex:
{
  key1: string = "hello",
  key2: 42, // Inferred type number
  $onchange (key, value) => {\njs // key: string, value: object {old: any, new: any}
    if (key == "key1") {
      console.log("key1 changed from ", value.old, " to ", value.new);
    }
  \njs}
}
*/

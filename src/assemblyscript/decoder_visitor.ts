import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { read, isReference } from "./helpers";

export class DecoderVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitObjectFieldsBefore(context: Context): void {
    super.triggerObjectFieldsBefore(context);
    this.write(
      `    static decodeNullable(decoder: Decoder): ${
        context.object!.name.value
      } | null {
    if (decoder.isNextNil()) return null;
    return ${context.object!.name.value}.decode(decoder);
  }

  // decode
  static decode(decoder: Decoder): ${context.object!.name.value} {
    const o = new ${context.object!.name.value}();
    o.decode(decoder);
    return o;
  }
    
  decode(decoder: Decoder): void {
    var numFields = decoder.readMapSize();

    while (numFields > 0) {
      numFields--;
      const field = decoder.readString();\n\n`
    );
  }

  visitObjectField(context: Context): void {
    const field = context.field!;
    this.write(`      `);
    if (context.fieldIndex! > 0) {
      this.write(`} else `);
    }
    this.write(`if (field == "${field.name.value}") {\n`);
    this.write(
      read(
        `this.${field.name.value}`,
        field.type,
        false,
        isReference(field.annotations)
      )
    );
    super.triggerObjectField(context);
  }

  visitObjectFieldsAfter(context: Context): void {
    if (context.fields!.length > 0) {
      this.write(`      } else {
        decoder.skip();
      }\n`);
    }
    this.write(`    }\n`);
    this.write(`  }\n`);
    super.triggerObjectFieldsAfter(context);
  }
}

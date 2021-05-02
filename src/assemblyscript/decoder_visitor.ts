import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { read, isReference } from "./helpers";

export class DecoderVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitTypeFieldsBefore(context: Context): void {
    super.triggerTypeFieldsBefore(context);
    this.write(
      `    static decodeNullable(decoder: Decoder): ${
        context.type!.name.value
      } | null {
    if (decoder.isNextNil()) return null;
    return ${context.type!.name.value}.decode(decoder);
  }

  // decode
  static decode(decoder: Decoder): ${context.type!.name.value} {
    const o = new ${context.type!.name.value}();
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

  visitTypeField(context: Context): void {
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
    super.triggerTypeField(context);
  }

  visitTypeFieldsAfter(context: Context): void {
    if (context.fields!.length > 0) {
      this.write(`      } else {
        decoder.skip();
      }\n`);
    }
    this.write(`    }\n`);
    this.write(`  }\n`);
    super.triggerTypeFieldsAfter(context);
  }
}

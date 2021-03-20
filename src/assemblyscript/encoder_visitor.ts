import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { encode, isReference, strQuote } from "./helpers";

export class EncoderVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitObjectFieldsBefore(context: Context): void {
    super.triggerObjectFieldsBefore(context);
    this.write(
      `  encode(encoder: Writer): void {
    encoder.writeMapSize(${context.fields!.length});\n`
    );
  }

  visitObjectField(context: Context): void {
    const field = context.field!;
    this.write(`encoder.writeString(${strQuote(field.name.value)});\n`);
    this.write(
      encode(
        "this." + field.name.value,
        field.type,
        isReference(field.annotations)
      )
    );
    super.triggerObjectField(context);
  }

  visitObjectFieldsAfter(context: Context): void {
    this.write(`  }\n`);
    super.triggerObjectFieldsAfter(context);
  }
}

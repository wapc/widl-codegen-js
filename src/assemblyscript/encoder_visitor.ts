import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { encode, isReference, strQuote } from "./helpers";

export class EncoderVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitTypeFieldsBefore(context: Context): void {
    super.triggerTypeFieldsBefore(context);
    this.write(
      `  encode(encoder: Writer): void {
    encoder.writeMapSize(${context.fields!.length});\n`
    );
  }

  visitTypeField(context: Context): void {
    const field = context.field!;
    this.write(`encoder.writeString(${strQuote(field.name.value)});\n`);
    this.write(
      encode(
        "this." + field.name.value,
        field.type,
        isReference(field.annotations)
      )
    );
    super.triggerTypeField(context);
  }

  visitTypeFieldsAfter(context: Context): void {
    this.write(`  }\n`);
    super.triggerTypeFieldsAfter(context);
  }
}

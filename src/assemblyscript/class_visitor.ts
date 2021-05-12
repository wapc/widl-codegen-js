import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { expandType, defValue, isReference } from "./helpers";
import { DecoderVisitor } from "./decoder_visitor";
import { EncoderVisitor } from "./encoder_visitor";
import { formatComment } from "../utils";

export class ClassVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitTypeBefore(context: Context): void {
    super.triggerTypeBefore(context);
    this.write(formatComment("// ", context.type!.description));
    this.write(`export class ${context.type!.name.value} implements Codec {\n`);
  }

  visitTypeField(context: Context): void {
    const field = context.field!;
    this.write(formatComment("  // ", field.description));
    this.write(
      `  ${field.name.value}: ${expandType(
        field.type!,
        true,
        isReference(field.annotations)
      )} = ${defValue(field)};\n`
    );
    super.triggerTypeField(context);
  }

  visitTypeFieldsAfter(context: Context): void {
    this.write(`\n`);
    const decoder = new DecoderVisitor(this.writer);
    context.type!.accept(context, decoder);
    this.write(`\n`);
    const encoder = new EncoderVisitor(this.writer);
    context.type!.accept(context, encoder);
    this.write(`\n`);

    this.write(`  toBuffer(): ArrayBuffer {
      let sizer = new Sizer();
      this.encode(sizer);
      let buffer = new ArrayBuffer(sizer.length);
      let encoder = new Encoder(buffer);
      this.encode(encoder);
      return buffer;
    }\n`);
    super.triggerTypeFieldsAfter(context);
  }

  visitTypeAfter(context: Context): void {
    this.write(`}\n\n`);
    super.triggerTypeAfter(context);
  }
}

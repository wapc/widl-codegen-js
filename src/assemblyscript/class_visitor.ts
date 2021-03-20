import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { expandType, defValue, isReference } from "./helpers";
import { DecoderVisitor } from "./decoder_visitor";
import { EncoderVisitor } from "./encoder_visitor";
import { formatComment } from "../utils";

export class ClassVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitObjectBefore(context: Context): void {
    super.triggerObjectBefore(context);
    this.write(formatComment("// ", context.object!.description));
    this.write(
      `export class ${context.object!.name.value} implements Codec {\n`
    );
  }

  visitObjectField(context: Context): void {
    const field = context.field!;
    this.write(formatComment("  // ", field.description));
    this.write(
      `  ${field.name.value}: ${expandType(
        field.type!,
        true,
        isReference(field.annotations)
      )} = ${defValue(field)};\n`
    );
    super.triggerObjectField(context);
  }

  visitObjectFieldsAfter(context: Context): void {
    this.write(`\n`);
    const decoder = new DecoderVisitor(this.writer);
    context.object!.accept(context, decoder);
    this.write(`\n`);
    const encoder = new EncoderVisitor(this.writer);
    context.object!.accept(context, encoder);
    this.write(`\n`);

    this.write(`  toBuffer(): ArrayBuffer {
      let sizer = new Sizer();
      this.encode(sizer);
      let buffer = new ArrayBuffer(sizer.length);
      let encoder = new Encoder(buffer);
      this.encode(encoder);
      return buffer;
    }\n`);
    super.triggerObjectFieldsAfter(context);
  }

  visitObjectAfter(context: Context): void {
    this.write(`}\n\n`);
    super.triggerObjectAfter(context);
  }
}

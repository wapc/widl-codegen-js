import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { expandType, fieldName, isReference } from "./helpers";
import { DecoderVisitor } from "./decoder_visitor";
import { EncoderVisitor } from "./encoder_visitor";
import { formatComment } from "../utils";

export class StructVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitTypeBefore(context: Context): void {
    super.triggerTypeBefore(context);
    this.write(formatComment("    // ", context.type!.description));
    this.write(`type ${context.type!.name.value} struct {\n`);
  }

  visitTypeField(context: Context): void {
    const field = context.field!;
    this.write(formatComment("    // ", field.description));
    this.write(
      `\t${fieldName(field.name.value)} ${expandType(
        field.type!,
        undefined,
        true,
        isReference(field.annotations)
      )}\n`
    );
    super.triggerTypeField(context);
  }

  visitTypeAfter(context: Context): void {
    this.write(`}\n\n`);
    super.triggerTypeAfter(context);
    const type = context.type!;
    const decoder = new DecoderVisitor(this.writer);
    type.accept(context, decoder);
    const encoder = new EncoderVisitor(this.writer);
    type.accept(context, encoder);
    this.write(`\n`);
  }
}

import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { expandType, fieldName, isReference } from "./helpers";
import { DecoderVisitor } from "./decoder_visitor";
import { EncoderVisitor } from "./encoder_visitor";
import { formatComment } from "../utils";

export class StructVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitObjectBefore(context: Context): void {
    super.triggerObjectBefore(context);
    this.write(formatComment("    // ", context.object!.description));
    this.write(`type ${context.object!.name.value} struct {\n`);
  }

  visitObjectField(context: Context): void {
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
    super.triggerObjectField(context);
  }

  visitObjectAfter(context: Context): void {
    this.write(`}\n\n`);
    super.triggerObjectAfter(context);
    const object = context.object!;
    const decoder = new DecoderVisitor(this.writer);
    object.accept(context, decoder);
    const encoder = new EncoderVisitor(this.writer);
    object.accept(context, encoder);
    this.write(`\n`);
  }
}

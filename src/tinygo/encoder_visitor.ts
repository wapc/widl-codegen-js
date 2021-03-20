import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import {
  capitalize,
  encode,
  fieldName,
  isReference,
  strQuote,
} from "./helpers";

export class EncoderVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitObjectFieldsBefore(context: Context): void {
    super.triggerObjectFieldsBefore(context);
    this.write(
      `func (o *${capitalize(
        context.object!.name.value
      )}) Encode(encoder msgpack.Writer) error {
    if o == nil {
      encoder.WriteNil()
      return nil
    }
    encoder.WriteMapSize(${context.fields!.length})\n`
    );
  }

  visitObjectField(context: Context): void {
    const field = context.field!;
    this.write(`encoder.WriteString(${strQuote(field.name.value)})\n`);
    this.write(
      encode(
        false,
        "o." + fieldName(field.name.value),
        field.type,
        isReference(field.annotations)
      )
    );
    super.triggerObjectField(context);
  }

  visitObjectFieldsAfter(context: Context): void {
    this.write(`
    return nil
  }\n\n`);
    super.triggerObjectFieldsAfter(context);
  }
}

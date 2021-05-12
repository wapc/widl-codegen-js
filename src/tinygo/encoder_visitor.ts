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

  visitTypeFieldsBefore(context: Context): void {
    super.triggerTypeFieldsBefore(context);
    this.write(
      `func (o *${capitalize(
        context.type!.name.value
      )}) Encode(encoder msgpack.Writer) error {
    if o == nil {
      encoder.WriteNil()
      return nil
    }
    encoder.WriteMapSize(${context.fields!.length})\n`
    );
  }

  visitTypeField(context: Context): void {
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
    super.triggerTypeField(context);
  }

  visitTypeFieldsAfter(context: Context): void {
    this.write(`
    return nil
  }\n\n`);
    super.triggerTypeFieldsAfter(context);
  }
}

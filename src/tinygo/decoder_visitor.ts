import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { read, isReference, fieldName } from "./helpers";

export class DecoderVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitTypeFieldsBefore(context: Context): void {
    super.triggerTypeFieldsBefore(context);
    const type = context.type!;
    this.write(
      `func Decode${type.name.value}Nullable(decoder *msgpack.Decoder) (*${
        type.name.value
      }, error) {
      if isNil, err := decoder.IsNextNil(); isNil || err != nil {
        return nil, err
      }
    decoded, err := Decode${type.name.value}(decoder)
    return &decoded, err
  }

  func Decode${type.name.value}(decoder *msgpack.Decoder) (${
        context.type!.name.value
      }, error) {
    var o ${context.type!.name.value}
    err := o.Decode(decoder)
    return o, err
  }

  func (o *${type.name.value}) Decode(decoder *msgpack.Decoder) error {
    numFields, err := decoder.ReadMapSize()
    if err != nil {
      return err
    }

    for numFields > 0 {
      numFields--;
      field, err := decoder.ReadString()
      if err != nil {
        return err
      }
      switch field {\n`
    );
  }

  visitTypeField(context: Context): void {
    const field = context.field!;
    this.write(`case "${field.name.value}":\n`);
    this.write(
      read(
        false,
        `o.${fieldName(field.name.value)}`,
        true,
        "",
        field.type,
        false,
        isReference(field.annotations)
      )
    );
    super.triggerTypeField(context);
  }

  visitTypeFieldsAfter(context: Context): void {
    if (context.fields!.length > 0) {
      this.write(`default:
        err = decoder.Skip()
      }\n`);
    }
    this.write(`if err != nil {
      return err
    }
  }\n`);
    this.write(`
    return nil
  }\n\n`);
    super.triggerTypeFieldsAfter(context);
  }
}

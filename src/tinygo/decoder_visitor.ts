import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { read, isReference, fieldName } from "./helpers";

export class DecoderVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitObjectFieldsBefore(context: Context): void {
    super.triggerObjectFieldsBefore(context);
    const object = context.object!;
    this.write(
      `func Decode${object.name.value}Nullable(decoder *msgpack.Decoder) (*${
        object.name.value
      }, error) {
      if isNil, err := decoder.IsNextNil(); isNil || err != nil {
        return nil, err
      }
    decoded, err := Decode${object.name.value}(decoder)
    return &decoded, err
  }

  func Decode${object.name.value}(decoder *msgpack.Decoder) (${
        context.object!.name.value
      }, error) {
    var o ${context.object!.name.value}
    err := o.Decode(decoder)
    return o, err
  }

  func (o *${object.name.value}) Decode(decoder *msgpack.Decoder) error {
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

  visitObjectField(context: Context): void {
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
    super.triggerObjectField(context);
  }

  visitObjectFieldsAfter(context: Context): void {
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
    super.triggerObjectFieldsAfter(context);
  }
}

import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { expandType, fieldName, isReference } from "./helpers";
import { formatComment } from "../utils";

export class StructVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitTypeBefore(context: Context): void {
    super.triggerTypeBefore(context);
    this.write(formatComment("// ", context.type!.description));
    this.write(`type ${context.type!.name.value} struct {\n`);
  }

  visitTypeField(context: Context): void {
    const field = context.field!;
    this.write(formatComment("// ", field.description));
    this.write(
      `\t${fieldName(field.name.value)} ${expandType(
        field.type!,
        undefined,
        true,
        isReference(field.annotations)
      )} \`json:"${field.name.value}" msgpack:"${field.name.value}"\`\n`
    );
    super.triggerTypeField(context);
  }

  visitTypeAfter(context: Context): void {
    this.write(`}\n\n`);
    super.triggerTypeAfter(context);
  }
}

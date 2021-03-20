import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { expandType, fieldName, isReference } from "./helpers";
import { formatComment } from "../utils";

export class StructVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitObjectBefore(context: Context): void {
    super.triggerObjectBefore(context);
    this.write(formatComment("// ", context.object!.description));
    this.write(`type ${context.object!.name.value} struct {\n`);
  }

  visitObjectField(context: Context): void {
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
    super.triggerObjectField(context);
  }

  visitObjectAfter(context: Context): void {
    this.write(`}\n\n`);
    super.triggerObjectAfter(context);
  }
}

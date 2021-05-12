import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { expandType, isReference, capitalize } from "./helpers";

export class BuilderVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitTypeBefore(context: Context): void {
    super.triggerTypeBefore(context);
    const className = context.type!.name.value;
    this.write(`export class ${className}Builder {
  instance: ${className} = new ${className}();\n`);
  }

  visitTypeField(context: Context): void {
    const className = context.type!.name.value;
    const field = context.field!;
    this.write(`\n`);
    this.write(`with${capitalize(field.name.value)}(${
      field.name.value
    }: ${expandType(
      field.type!,
      true,
      isReference(field.annotations)
    )}): ${className}Builder {
    this.instance.${field.name.value} = ${field.name.value};
    return this;
  }\n`);
    super.triggerTypeField(context);
  }

  visitTypeFieldsAfter(context: Context): void {
    this.write(`\n`);
    this.write(`  build(): ${context.type!.name.value} {
      return this.instance;
    }`);
    super.triggerTypeFieldsAfter(context);
  }

  visitTypeAfter(context: Context): void {
    this.write(`}\n\n`);
    super.triggerTypeAfter(context);
  }
}

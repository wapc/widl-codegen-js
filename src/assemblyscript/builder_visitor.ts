import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { expandType, isReference, capitalize } from "./helpers";

export class BuilderVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitObjectBefore(context: Context): void {
    super.triggerObjectBefore(context);
    const className = context.object!.name.value;
    this.write(`export class ${className}Builder {
  instance: ${className} = new ${className}();\n`);
  }

  visitObjectField(context: Context): void {
    const className = context.object!.name.value;
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
    super.triggerObjectField(context);
  }

  visitObjectFieldsAfter(context: Context): void {
    this.write(`\n`);
    this.write(`  build(): ${context.object!.name.value} {
      return this.instance;
    }`);
    super.triggerObjectFieldsAfter(context);
  }

  visitObjectAfter(context: Context): void {
    this.write(`}\n\n`);
    super.triggerObjectAfter(context);
  }
}

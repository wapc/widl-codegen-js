import {
  Context,
  Writer,
  OperationDefinition,
  ObjectDefinition,
  FieldDefinition,
  Name,
} from "@wapc/widl/ast";
import { capitalize } from "./helpers";
import { ClassVisitor } from "./class_visitor";
import { HostVisitor } from "./host_visitor";
import { HandlersVisitor } from "./handlers_visitor";
import { WrappersVisitor } from "./wrappers_visitor";
import { BuilderVisitor } from "./builder_visitor";

export class ModuleVisitor extends ClassVisitor {
  constructor(writer: Writer) {
    super(writer);
    this.setCallback(
      "AllOperationsBefore",
      "host",
      (context: Context): void => {
        const host = new HostVisitor(writer);
        context.document!.accept(context, host);
      }
    );
    this.setCallback(
      "AllOperationsBefore",
      "handlers",
      (context: Context): void => {
        const handlers = new HandlersVisitor(this.writer);
        context.document!.accept(context, handlers);
      }
    );
    this.setCallback(
      "AllOperationsBefore",
      "wrappers",
      (context: Context): void => {
        const wrappers = new WrappersVisitor(this.writer);
        context.document!.accept(context, wrappers);
      }
    );
  }

  visitDocumentBefore(context: Context): void {
    this.write(
      `import { Decoder, Writer, Encoder, Sizer, Codec } from "@wapc/as-msgpack";\n\n`
    );
    super.triggerDocumentBefore(context);
  }

  visitInterface(context: Context): void {
    this.write(`\n`);
    super.triggerInterface(context);
  }

  visitOperation(context: Context): void {
    if (context.operation!.isUnary()) {
      return;
    }
    const argObject = this.convertOperationToObject(context.operation!);
    const args = new ClassVisitor(this.writer);
    argObject.accept(context.clone({ object: argObject }), args);
    super.triggerOperation(context);
  }

  private convertOperationToObject(
    operation: OperationDefinition
  ): ObjectDefinition {
    var fields = operation.arguments.map((arg) => {
      return new FieldDefinition(
        arg.loc,
        arg.name,
        arg.description,
        arg.type,
        arg.default,
        arg.annotations
      );
    });
    return new ObjectDefinition(
      operation.loc,
      new Name(operation.name.loc, capitalize(operation.name.value) + "Args"),
      undefined,
      [],
      operation.annotations,
      fields
    );
  }

  visitObjectFieldsAfter(context: Context): void {
    var object = context.object!;
    super.visitObjectFieldsAfter(context);
    this.write(`\n`);
    this.write(`  static newBuilder(): ${object.name.value}Builder {
      return new ${object.name.value}Builder();
    }\n`);
    super.triggerObjectFieldsAfter(context);
  }

  visitObjectAfter(context: Context): void {
    this.write(`}\n\n`);

    const builder = new BuilderVisitor(this.writer);
    context.object!.accept(context, builder);
    super.triggerObjectAfter(context);
  }
}

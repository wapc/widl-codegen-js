import {
  Context,
  Writer,
  OperationDefinition,
  TypeDefinition,
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
    const operation = context.operation!;
    if (operation.parameters.length == 0 || operation.isUnary()) {
      return;
    }
    const argObject = this.convertOperationToType(operation);
    const args = new ClassVisitor(this.writer);
    argObject.accept(context.clone({ type: argObject }), args);
    super.triggerOperation(context);
  }

  private convertOperationToType(
    operation: OperationDefinition
  ): TypeDefinition {
    var fields = operation.parameters.map((arg) => {
      return new FieldDefinition(
        arg.loc,
        arg.name,
        arg.description,
        arg.type,
        arg.default,
        arg.annotations
      );
    });
    return new TypeDefinition(
      operation.loc,
      new Name(operation.name.loc, capitalize(operation.name.value) + "Args"),
      undefined,
      [],
      operation.annotations,
      fields
    );
  }

  visitTypeFieldsAfter(context: Context): void {
    var type = context.type!;
    super.visitTypeFieldsAfter(context);
    this.write(`\n`);
    this.write(`  static newBuilder(): ${type.name.value}Builder {
      return new ${type.name.value}Builder();
    }\n`);
    super.triggerTypeFieldsAfter(context);
  }

  visitTypeAfter(context: Context): void {
    this.write(`}\n\n`);

    const builder = new BuilderVisitor(this.writer);
    context.type!.accept(context, builder);
    super.triggerTypeAfter(context);
  }
}

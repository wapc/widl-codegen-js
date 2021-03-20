import {
  BaseVisitor,
  Context,
  FieldDefinition,
  Name,
  ObjectDefinition,
  OperationDefinition,
  Writer,
} from "@wapc/widl/ast";
import { capitalize } from "./helpers";
import { StructVisitor } from "./struct_visitor";
import { HostVisitor } from "./host_visitor";

export class ModuleVisitor extends BaseVisitor {
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
      "OperationAfter",
      "arguments",
      (context: Context): void => {
        if (context.operation!.isUnary()) {
          return;
        }
        const argObject = this.convertOperationToObject(context.operation!);
        const struct = new StructVisitor(this.writer);
        argObject.accept(context.clone({ object: argObject }), struct);
      }
    );
    this.setCallback("Object", "struct", (context: Context): void => {
      const struct = new StructVisitor(this.writer);
      context.object!.accept(context, struct);
    });
  }

  visitDocumentBefore(context: Context): void {
    this.write(`package module\n`);
    this.write(`\n`);
    this.write(`import (\n`);
    this.write(`"context"\n`);
    this.write(`\n`);
    this.write(`\t"github.com/wapc/wapc-go"\n`);
    this.write(`\t"github.com/vmihailenco/msgpack/v4"\n`);
    this.write(`)\n\n`);
    super.triggerDocumentBefore(context);
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
}

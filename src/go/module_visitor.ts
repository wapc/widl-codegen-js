import {
  BaseVisitor,
  Context,
  FieldDefinition,
  Name,
  TypeDefinition,
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
        const type = this.convertOperationToType(context.operation!);
        const struct = new StructVisitor(this.writer);
        type.accept(context.clone({ type: type }), struct);
      }
    );
    this.setCallback("Type", "struct", (context: Context): void => {
      const struct = new StructVisitor(this.writer);
      context.type!.accept(context, struct);
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

  private convertOperationToType(
    operation: OperationDefinition
  ): TypeDefinition {
    var fields = operation.parameters.map((param) => {
      return new FieldDefinition(
        param.loc,
        param.name,
        param.description,
        param.type,
        param.default,
        param.annotations
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
}

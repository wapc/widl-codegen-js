import {
  BaseVisitor,
  Context,
  Writer,
  OperationDefinition,
  TypeDefinition,
  FieldDefinition,
  Name,
} from "@wapc/widl/ast";
import { capitalize } from "./helpers";
import { StructVisitor } from "./struct_visitor";
import { HostVisitor } from "./host_visitor";
import { HandlersVisitor, RegisterVisitor } from "./handlers_visitor";
import { WrapperVarsVisitor, WrapperFuncsVisitor } from "./wrappers_visitor";

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
      "AllOperationsBefore",
      "handlers",
      (context: Context): void => {
        const handlers = new HandlersVisitor(this.writer);
        context.document!.accept(context, handlers);
        const register = new RegisterVisitor(this.writer);
        context.document!.accept(context, register);
      }
    );
    this.setCallback(
      "AllOperationsBefore",
      "wrappers",
      (context: Context): void => {
        const wrapperVars = new WrapperVarsVisitor(this.writer);
        context.document!.accept(context, wrapperVars);
        const wrapperFuncs = new WrapperFuncsVisitor(this.writer);
        context.document!.accept(context, wrapperFuncs);
      }
    );
    this.setCallback(
      "OperationAfter",
      "arguments",
      (context: Context): void => {
        const operation = context.operation!;
        if (operation.parameters.length == 0 || operation.isUnary()) {
          return;
        }
        const type = this.convertOperationToType(operation!);
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
    const packageName = context.config["package"] || "module";
    this.write(`package ${packageName}\n`);
    this.write(`\n`);
    this.write(`import (\n`);
    this.write(`\twapc "github.com/wapc/wapc-guest-tinygo"\n`);
    this.write(`\tmsgpack "github.com/wapc/tinygo-msgpack"\n`);
    this.write(`)\n\n`);
    super.triggerDocumentBefore(context);
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
}

import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import {
  capitalize,
  defaultValueForType,
  expandType,
  isReference,
  isVoid,
  mapArgs,
} from "./helpers";
import { shouldIncludeHandler } from "../utils";

export class ScaffoldVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitDocumentBefore(context: Context): void {
    const importPath =
      context.config.import || "github.com/myorg/mymodule/pkg/module";
    let module = context.config.module || "";
    if (module.length > 0) {
      module += " ";
    }
    super.visitDocumentBefore(context);
    this.write(`package main

    import (
      ${module}"${importPath}"
    )\n\n`);
  }

  visitAllOperationsBefore(context: Context): void {
    this.write(`\n`);
    const registration = new HandlerRegistrationVisitor(this.writer);
    context.document!.accept(context, registration);
  }

  visitOperation(context: Context): void {
    if (!shouldIncludeHandler(context)) {
      return;
    }
    const packageName = context.config["package"] || "module";
    const operation = context.operation!;
    this.write(`\n`);
    this.write(
      `func ${operation.name.value}(${mapArgs(
        operation.parameters,
        packageName
      )})`
    );
    if (!isVoid(operation.type)) {
      this.write(
        ` (${expandType(
          operation.type,
          packageName,
          true,
          isReference(operation.annotations)
        )}, error)`
      );
    } else {
      this.write(` error`);
    }
    this.write(` {\n`);
    if (!isVoid(operation.type)) {
      const dv = defaultValueForType(operation.type, packageName);
      this.write(`  return ${dv}, nil`);
    } else {
      this.write(`  return nil`);
    }
    this.write(` // TODO: Provide implementation.\n`);
    this.write(`}\n`);
  }
}

class HandlerRegistrationVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitAllOperationsBefore(context: Context): void {
    this.write(`func main() {
      module.Handlers{\n`);
  }

  visitOperation(context: Context): void {
    if (!shouldIncludeHandler(context)) {
      return;
    }
    const operation = context.operation!;
    this.write(
      `\t\t${capitalize(operation.name.value)}: ${operation.name.value},\n`
    );
  }

  visitAllOperationsAfter(context: Context): void {
    this.write(`}.Register()
  }\n`);
  }
}

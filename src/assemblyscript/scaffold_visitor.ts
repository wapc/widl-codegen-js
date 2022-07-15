import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import {
  expandType,
  isReference,
  capitalize,
  isVoid,
  mapArgs,
  defaultValueForType,
} from "./helpers";
import { shouldIncludeHandler } from "../utils";

export class ScaffoldVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitDocumentBefore(context: Context): void {
    super.visitDocumentBefore(context);
    const typesVisitor = new TypesVisitor(this.writer);
    context.document?.accept(context, typesVisitor);
    this.write(`import { Result } from "@wapc/as-guest";\n\n`);
  }

  visitAllOperationsBefore(context: Context): void {
    const registration = new HandlerRegistrationVisitor(this.writer);
    context.document!.accept(context, registration);
  }

  visitOperation(context: Context): void {
    if (!shouldIncludeHandler(context)) {
      return;
    }
    const operation = context.operation!;
    this.write(`\n`);
    const expanded = expandType(
      operation.type,
      true,
      isReference(operation.annotations)
    );
    this.write(
      `function ${operation.name.value}(${mapArgs(
        operation.parameters
      )}):`
    );
    if (isVoid(operation.type)) {
      this.write(`Error | null\n`);
    } else {
      this.write(`Result<${expanded}>`)
    }
    this.write(` {\n`);
    if (!isVoid(operation.type)) {
      const dv = defaultValueForType(operation.type);
      this.write(`  return Result.error<${expanded}>(new Error("not implemented"));\n`);
    } else {
      this.write(`return null\n`);
    }
    this.write(`}\n`);
  }

  visitDocumentAfter(context: Context): void {
    this.write(`\n`);
    this.write(`// Boilerplate code for waPC.  Do not remove.\n\n`);
    this.write(`import { handleCall, handleAbort } from "@wapc/as-guest";\n\n`);
    this
      .write(`export function __guest_call(operation_size: usize, payload_size: usize): bool {
  return handleCall(operation_size, payload_size);
}

// Abort function
function abort(
  message: string | null,
  fileName: string | null,
  lineNumber: u32,
  columnNumber: u32
): void {
  handleAbort(message, fileName, lineNumber, columnNumber);
}\n`);
  }
}

class HandlerRegistrationVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitAllOperationsBefore(context: Context): void {
    this.write(`export function wapc_init(): void {\n`);
  }

  visitOperation(context: Context): void {
    if (!shouldIncludeHandler(context)) {
      return;
    }
    const operation = context.operation!;
    this.write(
      `  Handlers.register${capitalize(operation.name.value)}(${
        operation.name.value
      });\n`
    );
  }

  visitAllOperationsAfter(context: Context): void {
    this.write(`}\n`);
  }
}

class TypesVisitor extends BaseVisitor {
  hasOperations: boolean = false;
  hasObjects: boolean = false;

  visitOperation(context: Context): void {
    if (shouldIncludeHandler(context)) {
      this.hasOperations = true;
    }
  }

  visitType(context: Context): void {
    if (!this.hasObjects) {
      this.write(`import { `);
      this.hasObjects = true;
    } else {
      this.write(`, `);
    }
    this.write(`${context.type!.name.value}`);
  }

  visitTypesAfter(context: Context): void {
    if (this.hasOperations) {
      if (!this.hasObjects) {
        this.write(`import { `);
      }
      const className = context.config.handlersClassName || "Handlers";
      if (this.hasObjects) {
        this.write(`, `);
      }
      this.write(`${className}`);
      this.hasObjects = true;
    }

    if (this.hasObjects || this.hasOperations) {
      const packageName = context.config.package || "./module";
      this.write(` } from "${packageName}";\n`);
    }
  }
}

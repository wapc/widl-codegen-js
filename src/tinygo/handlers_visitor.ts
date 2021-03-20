import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import {
  expandType,
  isReference,
  mapArgs,
  mapArg,
  capitalize,
  uncapitalize,
  isVoid,
  strQuote,
} from "./helpers";
import { formatComment, shouldIncludeHandler } from "../utils";

export class HandlersVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitOperation(context: Context): void {
    if (!shouldIncludeHandler(context)) {
      return;
    }
    if (context.config.handlerPreamble != true) {
      const className = context.config.handlersClassName || "Handlers";
      this.write(`type ${className} struct {\n`);
      context.config.handlerPreamble = true;
    }
    const operation = context.operation!;
    this.write(formatComment("    // ", operation.description));
    this.write(`${capitalize(operation.name.value)} func(`);
    if (operation.isUnary()) {
      this.write(mapArg(operation.unaryOp()));
    } else {
      this.write(mapArgs(operation.arguments));
    }
    this.write(`)`);
    if (!isVoid(operation.type)) {
      this.write(
        ` (${expandType(
          operation.type,
          undefined,
          true,
          isReference(operation.annotations)
        )}, error)`
      );
    } else {
      this.write(` error`);
    }
    this.write(`\n`);
    super.triggerOperation(context);
  }

  visitAllOperationsAfter(context: Context): void {
    if (context.config.handlerPreamble == true) {
      this.write(`}\n\n`);
    }
    super.triggerAllOperationsAfter(context);
  }
}

export class RegisterVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitAllOperationsBefore(context: Context): void {
    super.triggerAllOperationsBefore(context);
    if (context.config.handlerPreamble == true) {
      const className = context.config.handlersClassName || "Handlers";
      this.write(`func (h ${className}) Register() {\n`);
    }
  }

  visitOperation(context: Context): void {
    if (!shouldIncludeHandler(context)) {
      return;
    }
    const operation = context.operation!;
    this.write(`if h.${capitalize(operation.name.value)} != nil {
      ${uncapitalize(operation.name.value)}Handler = h.${capitalize(
      operation.name.value
    )}
      wapc.RegisterFunction(${strQuote(operation.name.value)}, ${uncapitalize(
      operation.name.value
    )}Wrapper)
    }\n`);
    super.triggerOperation(context);
  }

  visitAllOperationsAfter(context: Context): void {
    if (context.config.handlerPreamble == true) {
      this.write(`}\n\n`);
      delete context.config.handlerPreamble;
    }
    super.triggerAllOperationsAfter(context);
  }
}

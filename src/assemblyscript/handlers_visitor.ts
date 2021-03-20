import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import {
  expandType,
  isReference,
  strQuote,
  mapArgs,
  mapArg,
  capitalize,
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
      this.write(`
      import { register } from "@wapc/as-guest";
      export class ${className} {\n`);
      context.config.handlerPreamble = true;
    }
    this.write(`\n`);
    const operation = context.operation!;
    let opVal = "";
    this.write(formatComment("  // ", operation.description));
    opVal += `static register${capitalize(operation.name.value)}(handler: (`;
    if (operation.isUnary()) {
      opVal += mapArg(operation.unaryOp());
    } else {
      opVal += mapArgs(operation.arguments);
    }
    opVal += `) => ${expandType(
      operation.type,
      true,
      isReference(operation.annotations)
    )}): void {\n`;
    opVal += `${operation.name.value}Handler = handler;\n`;
    opVal += `register(${strQuote(operation.name.value)}, ${
      operation.name.value
    }Wrapper);\n}\n`;
    this.write(opVal);
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

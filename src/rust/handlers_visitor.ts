import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import { expandType, isReference, functionName, isVoid } from "./helpers";
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
      this.write(`#[cfg(feature = "guest")]
pub struct ${className} {}

#[cfg(feature = "guest")]
impl ${className} {\n`);
      context.config.handlerPreamble = true;
    }
    const operation = context.operation!;
    this.write(formatComment("    /// ", operation.description));
    this.write(`pub fn register_${functionName(operation.name.value)}(f: fn(`);
    operation.parameters.forEach((param, i) => {
      if (i > 0) {
        this.write(`, `);
      }
      this.write(
        expandType(param.type, undefined, true, isReference(param.annotations))
      );
    });
    this.write(`) -> HandlerResult<`);
    if (!isVoid(operation.type)) {
      this.write(
        `${expandType(
          operation.type,
          undefined,
          true,
          isReference(operation.annotations)
        )}`
      );
    } else {
      this.write(`()`);
    }
    this.write(`>) {
        *${functionName(
          operation.name.value
        ).toUpperCase()}.write().unwrap() = Some(f);
        register_function(&"${operation.name.value}", ${functionName(
      operation.name.value
    )}_wrapper);
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

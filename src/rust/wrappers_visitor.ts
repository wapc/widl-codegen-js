import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import {
  expandType,
  isReference,
  capitalize,
  isVoid,
  varAccessArg,
  functionName,
} from "./helpers";
import { shouldIncludeHandler } from "../utils";

export class WrapperVarsVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitOperation(context: Context): void {
    if (!shouldIncludeHandler(context)) {
      return;
    }
    if (context.config.handlerPreamble != true) {
      this.write(`#[cfg(feature = "guest")]
lazy_static::lazy_static! {\n`);
      context.config.handlerPreamble = true;
    }
    const operation = context.operation!;
    this.write(
      `static ref ${functionName(
        operation.name.value
      ).toUpperCase()}: std::sync::RwLock<Option<fn(`
    );
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
    this.write(`>>> = std::sync::RwLock::new(None);\n`);
  }

  visitAllOperationsAfter(context: Context): void {
    if (context.config.handlerPreamble == true) {
      this.write(`}\n\n`);
    }
    super.triggerAllOperationsAfter(context);
  }
}

export class WrapperFuncsVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitOperation(context: Context): void {
    if (!shouldIncludeHandler(context)) {
      return;
    }
    const operation = context.operation!;
    this.write(
      `#[cfg(feature = "guest")]
fn ${functionName(
        operation.name.value
      )}_wrapper(input_payload: &[u8]) -> CallResult {\n`
    );
    if (operation.isUnary()) {
      this.write(`let input = deserialize::<${expandType(
        operation.unaryOp().type,
        undefined,
        false,
        isReference(operation.annotations)
      )}>(input_payload)?;
      let lock = ${functionName(
        operation.name.value
      ).toUpperCase()}.read().unwrap().unwrap();
      let result = lock(input)?;\n`);
    } else {
      this.write(`let input = deserialize::<${capitalize(
        operation.name.value
      )}Args>(input_payload)?;
      let lock = ${functionName(
        operation.name.value
      ).toUpperCase()}.read().unwrap().unwrap();\n`);
      this.write(
        `let result = lock(${varAccessArg("input", operation.parameters)})?;\n`
      );
    }
    this.write(`serialize(result)\n`);
    this.write(`}\n\n`);
  }

  visitWrapperBeforeReturn(context: Context): void {
    this.triggerCallbacks(context, "WrapperBeforeReturn");
  }
}

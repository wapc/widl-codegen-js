import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import {
  expandType,
  size,
  encode,
  isReference,
  capitalize,
  isVoid,
  isObject,
  mapArgs,
  varAccessArg,
  uncapitalize,
  read,
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
      this.write(`var (\n`);
      context.config.handlerPreamble = true;
    }
    const operation = context.operation!;
    this.write(
      `\t${uncapitalize(operation.name.value)}Handler func (${mapArgs(
        operation.parameters
      )}) `
    );
    if (!isVoid(operation.type)) {
      this.write(
        `(${expandType(
          operation.type,
          undefined,
          true,
          isReference(operation.annotations)
        )}, error)`
      );
    } else {
      this.write(`error`);
    }
    this.write(`\n`);
  }

  visitAllOperationsAfter(context: Context): void {
    if (context.config.handlerPreamble == true) {
      this.write(`)\n\n`);
      delete context.config.handlerPreamble;
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
      `func ${uncapitalize(
        operation.name.value
      )}Wrapper(payload []byte) ([]byte, error) {\n`
    );
    if (operation.parameters.length > 0) {
      this.write(`decoder := msgpack.NewDecoder(payload)\n`);
    }
    if (operation.isUnary()) {
      const unaryParam = operation.parameters[0];
      if (isObject(unaryParam.type)) {
        this.write(`var request ${expandType(
          operation.unaryOp().type,
          undefined,
          false,
          isReference(operation.annotations)
        )}
        if err := request.Decode(&decoder); err != nil {
          return nil, err
        }\n`);
      } else {
        this.write(
          `${read(false, "request", true, "", unaryParam.type, false, false)}`
        );
        this.write(`if err != nil {
          return nil, err
        }\n`);
      }
      this.write(isVoid(operation.type) ? "err := " : "response, err := ");
      this.write(`${uncapitalize(operation.name.value)}Handler(request)\n`);
    } else {
      if (operation.parameters.length > 0) {
        this.write(`var inputArgs ${capitalize(operation.name.value)}Args
        inputArgs.Decode(&decoder)\n`);
      }
      this.write(isVoid(operation.type) ? "err := " : "response, err := ");
      this.write(
        `${uncapitalize(operation.name.value)}Handler(${varAccessArg(
          "inputArgs",
          operation.parameters
        )})\n`
      );
    }
    this.write(`if err != nil {
      return nil, err
    }\n`);
    if (isVoid(operation.type)) {
      this.visitWrapperBeforeReturn(context);
      this.write(`return []byte{}, nil\n`);
    } else if (isObject(operation.type)) {
      this.visitWrapperBeforeReturn(context);
      this.write(`return msgpack.ToBytes(&response)\n`);
    } else {
      this.write(`var sizer msgpack.Sizer
      ${size(
        true,
        "response",
        operation.type,
        isReference(operation.annotations)
      )}
      ua := make([]byte, sizer.Len());
      encoder := msgpack.NewEncoder(ua);
      ${encode(
        true,
        "response",
        operation.type,
        isReference(operation.annotations)
      )}\n`);
      this.visitWrapperBeforeReturn(context);
      this.write(`return ua, nil\n`);
    }
    this.write(`}\n\n`);
  }

  visitWrapperBeforeReturn(context: Context): void {
    this.triggerCallbacks(context, "WrapperBeforeReturn");
  }
}

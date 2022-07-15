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
  read,
} from "./helpers";
import { shouldIncludeHandler } from "../utils";

export class WrappersVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitOperation(context: Context): void {
    if (!shouldIncludeHandler(context)) {
      return;
    }
    const operation = context.operation!;
    this.write(
      `var ${operation.name.value}Handler: (${mapArgs(
        operation.parameters
      )}) => `
    );
    if (isVoid(operation.type)) {
      this.write(`Error | null;\n`);
    } else {
      this.write(
        `Result<${expandType(
          operation.type,
          true,
          isReference(operation.annotations)
        )}>;\n`
      );
    }
    this
      .write(`function ${operation.name.value}Wrapper(payload: ArrayBuffer): Result<ArrayBuffer> {
      const decoder = new Decoder(payload)\n`);
    if (operation.isUnary()) {
      const unaryParam = operation.parameters[0];
      if (isObject(unaryParam.type)) {
        this.write(`const request = new ${expandType(
          operation.unaryOp().type,
          false,
          isReference(operation.annotations)
        )}();
      request.decode(decoder);\n`);
        this.write(isVoid(operation.type) ? "" : "const result = ");
        this.write(`${operation.name.value}Handler(request);\n`);
      } else {
        this.write(`const ${read("val", unaryParam.type, false, false)}`);
        this.write(isVoid(operation.type) ? "" : "const result = ");
        this.write(`${operation.name.value}Handler(val);\n`);
      }
    } else {
      if (operation.parameters.length > 0) {
        this.write(`const inputArgs = new ${capitalize(
          operation.name.value
        )}Args();
        inputArgs.decode(decoder);
        if (decoder.error()) {
          return Result.error<ArrayBuffer>(decoder.error()!)
        }\n`);
      }
      this.write(
        `const result = ${operation.name.value}Handler(${varAccessArg(
          "inputArgs",
          operation.parameters
        )});\n`
      );
      if (isVoid(operation.type)) {
        this.write(`if (result) {
            return Result.error<ArrayBuffer>(result);
          }\n`);
      } else {
        this.write(`if (!result.isOk) {
            return Result.error<ArrayBuffer>(result.error()!);
          }\n`);
      }
    }
    if (!isVoid(operation.type)) {
      this.write(`const response = result.get();\n`);
    }
    if (isVoid(operation.type)) {
      this.visitWrapperBeforeReturn(context);
      this.write(`return Result.ok(new ArrayBuffer(0));\n`);
    } else if (isObject(operation.type)) {
      this.visitWrapperBeforeReturn(context);
      this.write(`return Result.ok(response.toBuffer());\n`);
    } else {
      this.write(`const sizer = new Sizer();\n`);
      this.write(
        size("response", operation.type, isReference(operation.annotations))
      );
      this.write(`const ua = new ArrayBuffer(sizer.length);
      const encoder = new Encoder(ua);
      ${encode(
        "response",
        operation.type,
        isReference(operation.annotations)
      )};\n`);
      this.visitWrapperBeforeReturn(context);
      this.write(`return Result.ok(ua);\n`);
    }
    this.write(`}\n\n`);
  }

  visitWrapperBeforeReturn(context: Context): void {
    this.triggerCallbacks(context, "WrapperBeforeReturn");
  }
}

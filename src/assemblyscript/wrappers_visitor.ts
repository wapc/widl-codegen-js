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
      )}) => ${expandType(
        operation.type,
        true,
        isReference(operation.annotations)
      )};\n`
    );
    this
      .write(`function ${operation.name.value}Wrapper(payload: ArrayBuffer): ArrayBuffer {
      const decoder = new Decoder(payload)\n`);
    if (operation.isUnary()) {
      this.write(`const request = new ${expandType(
        operation.unaryOp().type,
        false,
        isReference(operation.annotations)
      )}();
      request.decode(decoder);\n`);
      this.write(isVoid(operation.type) ? "" : "const response = ");
      this.write(`${operation.name.value}Handler(request);\n`);
    } else {
      this.write(`const inputArgs = new ${capitalize(
        operation.name.value
      )}Args();
      inputArgs.decode(decoder);\n`);
      this.write(isVoid(operation.type) ? "" : "const response = ");
      this.write(
        `${operation.name.value}Handler(${varAccessArg(
          "inputArgs",
          operation.parameters
        )});\n`
      );
    }
    if (isVoid(operation.type)) {
      this.visitWrapperBeforeReturn(context);
      this.write(`return new ArrayBuffer(0);\n`);
    } else if (isObject(operation.type)) {
      this.visitWrapperBeforeReturn(context);
      this.write(`return response.toBuffer();\n`);
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
      this.write(`return ua;\n`);
    }
    this.write(`}\n\n`);
  }

  visitWrapperBeforeReturn(context: Context): void {
    this.triggerCallbacks(context, "WrapperBeforeReturn");
  }
}

import { Context, Writer, BaseVisitor, Optional } from "@wapc/widl/ast";
import {
  expandType,
  read,
  isReference,
  strQuote,
  capitalize,
  isVoid,
  isObject,
  write,
} from "./helpers";
import { camelCase, formatComment, shouldIncludeHostCall } from "../utils";

export class HostVisitor extends BaseVisitor {
  constructor(writer: Writer) {
    super(writer);
  }

  visitOperation(context: Context): void {
    if (!shouldIncludeHostCall(context)) {
      return;
    }
    if (context.config.hostPreamble != true) {
      const className = context.config.hostClassName || "Host";
      this.write(`
      import { hostCall, Result } from "@wapc/as-guest";
      export class ${className} {
      binding: string;
  
      constructor(binding: string = "default") {
        this.binding = binding;
      }\n`);
      context.config.hostPreamble = true;
    }
    this.write(`\n`);
    const operation = context.operation!;
    this.write(formatComment("  // ", operation.description));
    this.write(`  ${camelCase(operation.name.value)}(`);
    operation.parameters.map((param, index) => {
      if (index > 0) {
        this.write(`, `);
      }
      this.write(`${param.name.value}: ${expandType(param.type, true, false)}`);
    });
    const returnType = expandType(operation.type, true, false);
    this.write(`): `);
    const retVoid = isVoid(operation.type);
    if (retVoid) {
      this.write(`Error | null {\n`);
    } else {
      this.write(`Result<${returnType}> {\n`);
    }

    this.write(`  `);
    if (operation.parameters.length == 0) {
      this.write(
        `const result = hostCall(this.binding, ${strQuote(
          context.namespace.name.value
        )}, ${strQuote(operation.name.value)}, new ArrayBuffer(0));\n`
      );
    } else if (operation.isUnary()) {
      const unaryParam = operation.parameters[0];
      if (isObject(unaryParam.type)) {
        this.write(
          `const result = hostCall(this.binding, ${strQuote(
            context.namespace.name.value
          )}, ${strQuote(operation.name.value)}, ${
            operation.unaryOp().name.value
          }.toBuffer());\n`
        );
      } else {
        this.write(`const sizer = new Sizer();
        ${write(
          "sizer",
          "",
          "",
          unaryParam.name.value,
          unaryParam.type,
          false,
          isReference(operation.annotations)
        )}const ua = new ArrayBuffer(sizer.length);
        const encoder = new Encoder(ua);
        ${write(
          "encoder",
          "",
          "",
          unaryParam.name.value,
          unaryParam.type,
          false,
          isReference(operation.annotations)
        )}`);
        this.write(
          `const result = hostCall(this.binding, ${strQuote(
            context.namespace.name.value
          )}, ${strQuote(operation.name.value)}, ua);\n`
        );
      }      
    } else {
      this.write(
        `const inputArgs = new ${capitalize(operation.name.value)}Args();\n`
      );
      operation.parameters.map((param) => {
        const paramName = param.name.value;
        this.write(`  inputArgs.${paramName} = ${paramName};\n`);
      });
      this.write(`const result = hostCall(
      this.binding,
      ${strQuote(context.namespace.name.value)},
      ${strQuote(operation.name.value)},
      inputArgs.toBuffer()
    );\n`);
    }
    if (retVoid) {
      this.write(`return result.error()\n`);
    } else {
      this.write(`if (!result.isOk) {
        return Result.error<${returnType}>(result.error()!);
      }\n`);
    }
    if (!retVoid) {
      if (isObject(operation.type)) {
        this.write(`    const decoder = new Decoder(result.get());\n`);
        this.write(
          `    const ret = ${expandType(
            operation.type,
            false,
            isReference(operation.annotations)
          )}.decode(decoder);\n`
        );
        this.write(`if (decoder.error()) {
          return Result.error<${returnType}>(decoder.error()!)
        }
        return Result.ok(ret);\n`);
      } else {
        this.write(`    const decoder = new Decoder(result.get());\n`);
        this.write(
          `const ${read(
            "payload",
            operation.type,
            false,
            isReference(operation.annotations)
          )}`
        );
        this.write(`if (decoder.error()) {
          return Result.error<${returnType}>(decoder.error()!)
        }\n`);
        this.write(`  return Result.ok(payload);\n`);
      }
    }
    this.write(`  }\n`);
    super.triggerOperation(context);
  }

  visitAllOperationsAfter(context: Context): void {
    if (context.config.hostPreamble == true) {
      this.write(`}\n\n`);
      delete context.config.hostPreamble;
    }
    super.triggerAllOperationsAfter(context);
  }
}

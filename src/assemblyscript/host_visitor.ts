import { Context, Writer, BaseVisitor, Optional } from "@wapc/widl/ast";
import {
  expandType,
  read,
  isReference,
  strQuote,
  capitalize,
  isVoid,
  isObject,
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
      import { hostCall } from "@wapc/as-guest";
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
      this.write(
        `${param.name.value}: ${expandType(param.type, true, false)}`
      );
    });
    this.write(`): ${expandType(operation.type, true, false)} {\n`);

    this.write(`  `);
    const retVoid = isVoid(operation.type);

    if (operation.parameters.length == 0) {
      if (!retVoid) {
        this.write(`const payload = `);
      }
      this.write(
        `hostCall(this.binding, ${strQuote(
          context.namespace.name.value
        )}, ${strQuote(operation.name.value)}, new ArrayBuffer(0));\n`
      );
    } else if (operation.isUnary()) {
      if (!retVoid) {
        this.write(`const payload = `);
      }
      this.write(
        `hostCall(this.binding, ${strQuote(
          context.namespace.name.value
        )}, ${strQuote(operation.name.value)}, ${operation.unaryOp().name.value
        }.toBuffer());\n`
      );
    } else {
      this.write(
        `const inputArgs = new ${capitalize(operation.name.value)}Args();\n`
      );
      operation.parameters.map((param) => {
        const paramName = param.name.value;
        this.write(`  inputArgs.${paramName} = ${paramName};\n`);
      });
      if (!retVoid) {
        this.write(`const payload = `);
      }
      this.write(`hostCall(
      this.binding,
      ${strQuote(context.namespace.name.value)},
      ${strQuote(operation.name.value)},
      inputArgs.toBuffer()
    );\n`);
    }
    if (!retVoid) {
      this.write(`    const decoder = new Decoder(payload);\n`);
      if (isObject(operation.type)) {
        this.write(
          `    return ${expandType(
            operation.type,
            false,
            isReference(operation.annotations)
          )}.decode(decoder);\n`
        );
      } else {
        var resultVar = "";
        if (operation.type instanceof Optional) {
          resultVar = "result";
          this.write(
            `var result: ${expandType(
              operation.type,
              true,
              isReference(operation.annotations)
            )};\n`
          );
        }
        this.write(
          `${read(
            resultVar,
            operation.type,
            false,
            isReference(operation.annotations)
          )}`
        );
        if (resultVar != "") {
          this.write(`  return ${resultVar};\n`);
        }
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

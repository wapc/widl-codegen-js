import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import {
  expandType,
  read,
  isReference,
  strQuote,
  capitalize,
  isVoid,
  isObject,
} from "./helpers";
import { formatComment, shouldIncludeHostCall } from "../utils";

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
    this.write(`  ${operation.name.value}(`);
    operation.arguments.map((arg, index) => {
      if (index > 0) {
        this.write(`, `);
      }
      this.write(`${arg.name.value}: ${expandType(arg.type, false, false)}`);
    });
    this.write(`): ${expandType(operation.type, false, false)} {\n`);

    this.write(`  `);
    const retVoid = isVoid(operation.type);

    if (operation.isUnary()) {
      if (!retVoid) {
        this.write(`const payload = `);
      }
      this.write(
        `hostCall(this.binding, ${strQuote(
          context.namespace.name.value
        )}, ${strQuote(operation.name.value)}, ${
          operation.unaryOp().name.value
        }.toBuffer());\n`
      );
    } else {
      this.write(
        `const inputArgs = new ${capitalize(operation.name.value)}Args();\n`
      );
      operation.arguments.map((arg) => {
        const argName = arg.name.value;
        this.write(`  inputArgs.${argName} = ${argName};\n`);
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
        this.write(
          `    const ${read(
            "ret",
            operation.type,
            false,
            isReference(operation.annotations)
          )}`
        );
        this.write(`    return ret;\n`);
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

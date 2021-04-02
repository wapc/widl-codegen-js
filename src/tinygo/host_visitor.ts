import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import {
  expandType,
  read,
  isReference,
  strQuote,
  capitalize,
  parameterName,
  fieldName,
  isVoid,
  isObject,
  defaultValueForType,
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
      this.write(`type ${className} struct {
\tbinding string
}

func New${className}(binding string) *${className} {
\treturn &${className}{
\t\tbinding: binding,
\t}
}\n`);
      context.config.hostPreamble = true;
    }
    const className = context.config.hostClassName || "Host";
    this.write(`\n`);
    const operation = context.operation!;
    this.write(formatComment("    // ", operation.description));
    this.write(`func (h *${className}) ${capitalize(operation.name.value)}(`);
    operation.arguments.map((arg, index) => {
      if (index > 0) {
        this.write(`, `);
      }
      this.write(
        `${parameterName(arg.name.value)} ${expandType(arg.type, undefined, true, false)}`
      );
    });
    this.write(`) `);
    const retVoid = isVoid(operation.type);
    if (!retVoid) {
      this.write(
        `(${expandType(operation.type, undefined, false, false)}, error)`
      );
    } else {
      this.write(`error`);
    }
    this.write(` {\n`);

    let defaultVal = "";
    let defaultValWithComma = "";
    if (!retVoid) {
      defaultVal = defaultValueForType(operation.type);
      defaultValWithComma = defaultVal + ", ";
    }
    if (operation.isUnary()) {
      this.write(`inputBytes, err := msgpack.ToBytes(&${
        operation.unaryOp().name.value
      })
      if err != nil {
        return ${defaultValWithComma}err
      }\n`);
      if (!retVoid) {
        this.write(`payload, err := `);
      } else {
        this.write(`_, err = `);
      }
      this.write(
        `wapc.HostCall(h.binding, ${strQuote(
          context.namespace.name.value
        )}, ${strQuote(operation.name.value)}, inputBytes)\n`
      );
    } else {
      this.write(`inputArgs := ${fieldName(operation.name.value)}Args{\n`);
      operation.arguments.map((arg) => {
        const argName = arg.name.value;
        this.write(`  ${fieldName(argName)}: ${parameterName(argName)},\n`);
      });
      this.write(`}\n`);
      this.write(`inputBytes, err := msgpack.ToBytes(&inputArgs)
      if err != nil {
        return ${defaultValWithComma}err
      }\n`);
      if (!retVoid) {
        this.write(`payload, err := `);
      } else {
        this.write(`_, err = `);
      }
      this.write(`wapc.HostCall(
      h.binding,
      ${strQuote(context.namespace.name.value)},
      ${strQuote(operation.name.value)},
      inputBytes,
    )\n`);
    }
    if (!retVoid) {
      this.write(`if err != nil {
        return ${defaultValWithComma}err
      }\n`);
      this.write(`decoder := msgpack.NewDecoder(payload)\n`);
      if (isObject(operation.type)) {
        this.write(
          `return Decode${expandType(
            operation.type,
            undefined,
            false,
            isReference(operation.annotations)
          )}(&decoder)\n`
        );
      } else {
        this.write(
          `${read(
            true,
            "ret",
            true,
            defaultVal,
            operation.type,
            false,
            isReference(operation.annotations)
          )}`
        );
        this.write(`return ret, err\n`);
      }
    } else {
      this.write(`return err\n`);
    }
    this.write(`}\n`);
    super.triggerOperation(context);
  }

  visitAllOperationsAfter(context: Context): void {
    if (context.config.hostPreamble == true) {
      delete context.config.hostPreamble;
    }
    super.triggerAllOperationsAfter(context);
  }
}

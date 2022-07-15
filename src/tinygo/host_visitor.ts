import { Context, Writer, BaseVisitor, Optional, Named } from "@wapc/widl/ast";
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
import { codecFuncs } from "./constant";

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
    operation.parameters.map((param, index) => {
      if (index > 0) {
        this.write(`, `);
      }
      this.write(
        `${parameterName(param.name.value)} ${expandType(
          param.type,
          undefined,
          true,
          false
        )}`
      );
    });
    this.write(`) `);
    const retVoid = isVoid(operation.type);
    if (!retVoid) {
      this.write(
        `(${expandType(operation.type, undefined, true, false)}, error)`
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
    if (operation.parameters.length == 0) {
      if (!retVoid) {
        this.write(`payload, err := `);
      } else {
        this.write(`_, err := `);
      }
      this.write(
        `wapc.HostCall(h.binding, ${strQuote(
          context.namespace.name.value
        )}, ${strQuote(operation.name.value)}, []byte{})\n`
      );
    } else if (operation.isUnary()) {
      const unaryParam = operation.unaryOp();
      if (isObject(unaryParam.type)) {
        this.write(
          `inputBytes, err := msgpack.ToBytes(&${unaryParam.name.value})\n`
        );
      } else {
        const codecFunc = codecFuncs.get((unaryParam.type as Named).name.value);
        this.write(
          `inputBytes, err := msgpack.${codecFunc}(${unaryParam.name.value})\n`
        );
      }
      this.write(`if err != nil {
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
      operation.parameters.map((param) => {
        const paramName = param.name.value;
        this.write(`  ${fieldName(paramName)}: ${parameterName(paramName)},\n`);
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
        var resultVar = "";
        if (operation.type instanceof Optional) {
          resultVar = "result";
          this.write(
            `var result ${expandType(
              operation.type,
              undefined,
              true,
              isReference(operation.annotations)
            )}\n`
          );
        }
        this.write(
          `${read(
            true,
            resultVar,
            true,
            defaultVal,
            operation.type,
            false,
            isReference(operation.annotations)
          )}`
        );
        if (resultVar != "") {
          this.write(`return ${resultVar}, err\n`);
        }
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

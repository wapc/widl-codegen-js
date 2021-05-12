import { Context, Writer, BaseVisitor, Optional, Kind } from "@wapc/widl/ast";
import {
  expandType,
  isReference,
  strQuote,
  capitalize,
  fieldName,
  isVoid,
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
    const className = context.config.hostClassName || "Host";
    if (context.config.hostPreamble != true) {
      this.write(`type ${className} struct {
  \tinstance *wapc.Instance
  }
  
  func New(instance *wapc.Instance) *${className} {
  \treturn &${className}{
  \t\instance: instance,
  \t}
  }\n`);
      context.config.hostPreamble = true;
    }
    this.write(`\n`);
    const operation = context.operation!;
    this.write(formatComment("// ", operation.description));
    this.write(
      `func (m *${className}) ${capitalize(
        operation.name.value
      )}(ctx context.Context`
    );
    operation.parameters.map((param, index) => {
      this.write(
        `, ${param.name.value} ${expandType(
          param.type,
          undefined,
          false,
          false
        )}`
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
    if (!retVoid) {
      defaultVal = "ret, ";
      this.write(
        `var ret ${expandType(
          operation.type,
          undefined,
          false,
          isReference(operation.annotations)
        )}\n`
      );
    }
    if (operation.isUnary()) {
      this.write(`inputPayload, err := msgpack.Marshal(${
        operation.parameters[0].type.isKind(Kind.Optional) ? "" : "&"
      }${operation.parameters[0].name.value})
      if err != nil {
        return ret, err
      }\n`);
      if (!retVoid) {
        this.write(`payload, `);
      } else {
        this.write(`_, `);
      }
      this.write(
        `err := m.instance.Invoke(ctx, ${strQuote(
          operation.name.value
        )}, inputPayload)\n`
      );
    } else {
      this.write(`inputArgs := ${fieldName(operation.name.value)}Args{\n`);
      operation.parameters.map((param) => {
        const argName = param.name.value;
        this.write(`  ${fieldName(argName)}: ${argName},\n`);
      });
      this.write(`}\n`);
      this.write(`inputPayload, err := msgpack.Marshal(&inputArgs)
      if err != nil {
          return ${defaultVal}err
      }\n`);
      if (!retVoid) {
        this.write(`payload, `);
      } else {
        this.write(`_, `);
      }
      this.write(`err := m.instance.Invoke(
      ctx,
      ${strQuote(operation.name.value)},
      inputPayload,
    )\n`);
    }
    if (!retVoid) {
      this.write(`if err != nil {
        return ret, err
      }
	err = msgpack.Unmarshal(payload, &ret)
    return ret, err\n`);
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

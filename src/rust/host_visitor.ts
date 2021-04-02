import { Context, Writer, BaseVisitor } from "@wapc/widl/ast";
import {
  expandType,
  isReference,
  strQuote,
  capitalize,
  fieldName,
  isVoid,
  functionName,
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
      this.write(`#[cfg(feature = "guest")]
pub struct ${className} {
      binding: String,
  }
  
  #[cfg(feature = "guest")]
  impl Default for ${className} {
      fn default() -> Self {
        ${className} {
              binding: "default".to_string(),
          }
      }
  }
  
  /// Creates a named host binding
  #[cfg(feature = "guest")]
  pub fn host(binding: &str) -> ${className} {
    ${className} {
          binding: binding.to_string(),
      }
  }
  
  /// Creates the default host binding
  #[cfg(feature = "guest")]
  pub fn default() -> ${className} {
    ${className}::default()
  }
  
  #[cfg(feature = "guest")]
  impl ${className} {`);
      context.config.hostPreamble = true;
    }
    const operation = context.operation!;
    this.write(formatComment("  /// ", operation.description));
    this.write(`\npub fn ${functionName(operation.name.value)}(&self`);
    operation.arguments.map((arg, index) => {
      this.write(
        `, ${fieldName(arg.name.value)}: ${expandType(
          arg.type,
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
        `-> HandlerResult<${expandType(
          operation.type,
          undefined,
          true,
          false
        )}>`
      );
    } else {
      this.write(`-> HandlerResult<()>`);
    }
    this.write(` {\n`);

    if (operation.arguments.length == 0) {
      this.write(
        `host_call(
        &self.binding, 
        ${strQuote(context.namespace.name.value)},
        ${strQuote(operation.name.value)},
        &vec![],
        )\n`
      );
    } else if (operation.isUnary()) {
      this.write(
        `host_call(
        &self.binding, 
        ${strQuote(context.namespace.name.value)},
        ${strQuote(operation.name.value)},
        &serialize(${operation.unaryOp().name.value})?,
        )\n`
      );
    } else {
      this.write(`let input_args = ${capitalize(operation.name.value)}Args{\n`);
      operation.arguments.map((arg) => {
        const argName = arg.name.value;
        this.write(`  ${fieldName(argName)},\n`);
      });
      this.write(`};\n`);
      this.write(`host_call(
      &self.binding, 
      ${strQuote(context.namespace.name.value)},
      ${strQuote(operation.name.value)},
      &serialize(input_args)?,
    )\n`);
    }
    if (!retVoid) {
      this.write(`.map(|vec| {
        let resp = deserialize::<${expandType(
          operation.type,
          undefined,
          false,
          isReference(operation.annotations)
        )}>(vec.as_ref()).unwrap();
        resp
      })\n`);
    } else {
      this.write(`.map(|_vec| ())\n`);
    }
    this.write(`.map_err(|e| e.into())
    }\n`);
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

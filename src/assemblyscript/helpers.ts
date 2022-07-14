import {
  Named,
  MapType,
  ListType,
  Optional,
  FieldDefinition,
  Type,
  Annotation,
  ValuedDefinition,
  OperationDefinition,
  ParameterDefinition,
  TypeDefinition,
  Kind,
} from "@wapc/widl/ast";
import { translations, primitives, decodeFuncs, encodeFuncs } from "./constant";

/**
 * Takes an array of ValuedDefintions and returns a string based on supplied params.
 * @param sep seperator between name and type
 * @param joinOn string that each ValuedDefintion is joined on
 * @returns string of format <name> <sep> <type><joinOn>...
 */
export function mapVals(
  vd: ValuedDefinition[],
  sep: string,
  joinOn: string
): string {
  return vd
    .map(
      (vd) =>
        `${vd.name.value}${sep} ${expandType(
          vd.type,
          true,
          isReference(vd.annotations)
        )};`
    )
    .join(joinOn);
}

/**
 * Creates string that is an msgpack size code block
 * @param variable variable that is being size
 * @param t the type node to encode
 * @param isReference if the type that is being expanded has a `@ref` annotation
 */
export function size(variable: string, t: Type, isReference: boolean): string {
  return write("sizer", "Writer", "encode", variable, t, false, isReference);
}

/**
 * Creates string that is an msgpack encode code block
 * @param variable variable that is being encode
 * @param t the type node to encode
 * @param isReference if the type that is being expanded has a `@ref` annotation
 */
export function encode(
  variable: string,
  t: Type,
  isReference: boolean
): string {
  return write("encoder", "Writer", "encode", variable, t, false, isReference);
}

/**
 * Return default value for a FieldDefinition. Default value of objects are instantiated.
 * @param fieldDef FieldDefinition Node to get default value of
 */
export function defValue(fieldDef: FieldDefinition): string {
  const name = fieldDef.name.value;
  const type = fieldDef.type;
  if (fieldDef.default) {
    let returnVal = fieldDef.default.getValue();
    if (fieldDef.type.isKind(Kind.Named)) {
      returnVal =
        (fieldDef.type as Named).name.value == "string"
          ? strQuote(returnVal)
          : returnVal;
    }
    return returnVal;
  }

  switch (type.constructor) {
    case Optional:
      return "null";
    case ListType:
    case MapType:
      return `new ${expandType(
        type,
        false,
        isReference(fieldDef.annotations)
      )}()`;
    case Named:
      switch ((type as Named).name.value) {
        case "ID":
        case "string":
          return '""';
        case "bool":
          return "false";
        case "i8":
        case "u8":
        case "i16":
        case "u16":
        case "i32":
        case "u32":
        case "i64":
        case "u64":
        case "f32":
        case "f64":
          return "0";
        case "bytes":
          return "new ArrayBuffer(0)";
        default:
          return `new ${capitalize((type as Named).name.value)}()`; // reference to something else
      }
  }
  return `???${expandType(type, false, isReference(fieldDef.annotations))}???`;
}

export function defaultValueForType(type: Type): string {
  switch (type.constructor) {
    case Optional:
      return "null";
    case ListType:
    case MapType:
      return `new ${expandType(type, false, false)}()`;
    case Named:
      switch ((type as Named).name.value) {
        case "ID":
        case "string":
          return '""';
        case "bool":
          return "false";
        case "i8":
        case "u8":
        case "i16":
        case "u16":
        case "i32":
        case "u32":
        case "i64":
        case "u64":
        case "f32":
        case "f64":
          return "0";
        case "bytes":
          return "new ArrayBuffer(0)";
        default:
          return `new ${capitalize((type as Named).name.value)}()`; // reference to something else
      }
  }
  return "???";
}

/**
 * returns string in quotes
 * @param s string to have quotes
 */
export const strQuote = (s: string) => {
  return `\"${s}\"`;
};

/**
 * returns string of the expanded type of a node
 * @param type the type node that is being expanded
 * @param useOptional if the type that is being expanded is optional
 * @param isReference if the type that is being expanded has a `@ref` annotation
 */
export const expandType = (
  type: Type,
  useOptional: boolean,
  isReference: boolean
): string => {
  switch (true) {
    case type.isKind(Kind.Named):
      if (isReference) {
        return "string";
      }
      const namedValue = (type as Named).name.value;
      const translation = translations.get(namedValue);
      if (translation != undefined) {
        return translation!;
      }
      return namedValue;
    case type.isKind(Kind.MapType):
      return `MapType<${expandType(
        (type as MapType).keyType,
        true,
        isReference
      )},${expandType((type as MapType).valueType, true, isReference)}>`;
    case type.isKind(Kind.ListType):
      return `Array<${expandType((type as ListType).type, true, isReference)}>`;
    case type.isKind(Kind.Optional):
      let expanded = expandType((type as Optional).type, true, isReference);
      if (useOptional) {
        return `${expanded} | null`;
      }
      return expanded;
    default:
      return "unknown";
  }
};

/**
 * Creates string that is an msgpack read code block
 * @param variable variable that is being read
 * @param t the type node to write
 * @param prevOptional if type is being expanded and the parent type is optional
 * @param isReference if the type that is being expanded has a `@ref` annotation
 */
export function read(
  variable: string,
  t: Type,
  prevOptional: boolean,
  isReference: boolean
): string {
  let prefix = "return ";
  if (variable != "") {
    prefix = variable + " = ";
  }
  switch (true) {
    case t.isKind(Kind.Named):
      if (isReference) {
        return prefix + "decoder.readString()";
      }
      let namedNode = t as Named;
      if (decodeFuncs.has(namedNode.name.value)) {
        if (prevOptional) {
          if (primitives.has(namedNode.name.value))
            return `${prefix}decoder.${decodeFuncs.get(
              namedNode.name.value
            )}();\n`;
        }
        return `${prefix}decoder.${decodeFuncs.get(namedNode.name.value)}();\n`;
      }
      return `${prefix}${namedNode.name.value}.decode(decoder);`;
    case t.isKind(Kind.MapType):
      let code = `${prefix}decoder.read`;
      if (prevOptional) {
        code += "Nullable";
      }
      code += "MapType(\n";
      code += `(decoder: Decoder): ${expandType(
        (t as MapType).keyType,
        true,
        isReference
      )} => {\n`;
      code += read("", (t as MapType).keyType, false, isReference);
      code += "},\n";
      code += `(decoder: Decoder): ${expandType(
        (t as MapType).valueType,
        true,
        isReference
      )} => {\n`;
      code += read("", (t as MapType).valueType, false, isReference);
      code += "});\n";
      return code;
    case t.isKind(Kind.ListType):
      let listCode = "";
      listCode += `${prefix}decoder.read`;
      if (prevOptional) {
        listCode += "Nullable";
      }
      listCode += `Array((decoder: Decoder): ${expandType(
        (t as ListType).type,
        true,
        isReference
      )} => {\n`;
      listCode += read("", (t as ListType).type, false, isReference);
      listCode += "});\n";
      return listCode;
    case t.isKind(Kind.Optional):
      const optNode = t as Optional;
      optNode.type;
      switch (true) {
        case optNode.type.isKind(Kind.ListType):
        case optNode.type.isKind(Kind.MapType):
          return prefix + read(variable, optNode.type, true, isReference);
      }
      let optCode = "";
      optCode += "if (decoder.isNextNil()) {\n";
      optCode += prefix + "null;\n";
      optCode += "} else {\n";
      optCode += read(variable, optNode.type, true, isReference);
      optCode += "}\n";
      return optCode;
    default:
      return "unknown";
  }
}

/**
 * Creates string that is an msgpack write code block
 * @param typeInst name of variable which object that is writting is assigning to
 * @param typeClass class that is being written
 * @param typeMeth method that is being called
 * @param variable variable that is being written
 * @param t the type node to write
 * @param prevOptional if type is being expanded and the parent type is optional
 * @param isReference if the type that is being expanded has a `@ref` annotation
 */
export function write(
  typeInst: string,
  typeClass: string,
  typeMeth: string,
  variable: string,
  t: Type,
  prevOptional: boolean,
  isReference: boolean
): string {
  let code = "";
  switch (true) {
    case t.isKind(Kind.Named):
      if (isReference) {
        return `${typeInst}.writeString(${variable});`;
      }
      const namedNode = t as Named;
      if (encodeFuncs.has(namedNode.name.value)) {
        return `${typeInst}.${encodeFuncs.get(
          namedNode.name.value
        )}(${variable});\n`;
      }
      return `${variable}.${typeMeth}(${typeInst});\n`;
    case t.isKind(Kind.MapType):
      const mappedNode = t as MapType;
      code += typeInst + ".write";
      if (prevOptional) {
        code += "Nullable";
      }
      code += "MapType(" + variable + ",\n";
      code +=
        "(" +
        typeInst +
        ": " +
        typeClass +
        ", key: " +
        expandType(mappedNode.keyType, true, isReference) +
        " ): void => {\n";
      code += write(
        typeInst,
        typeClass,
        typeMeth,
        "key",
        mappedNode.keyType,
        false,
        isReference
      );
      code += "},\n";
      code +=
        "(" +
        typeInst +
        ": " +
        typeClass +
        ", value: " +
        expandType(mappedNode.valueType, true, isReference) +
        " ): void => {\n";
      code += write(
        typeInst,
        typeClass,
        typeMeth,
        "value",
        mappedNode.valueType,
        false,
        isReference
      );
      code += "});\n";
      return code;
    case t.isKind(Kind.ListType):
      const listNode = t as ListType;
      code += typeInst + ".write";
      if (prevOptional) {
        code += "Nullable";
      }
      code +=
        "Array(" +
        variable +
        ", (" +
        typeInst +
        ": " +
        typeClass +
        ", item: " +
        expandType(listNode.type, true, isReference) +
        " ): void => {\n";
      code += write(
        typeInst,
        typeClass,
        typeMeth,
        "item",
        listNode.type,
        false,
        isReference
      );
      code += "});\n";
      return code;
    case t.isKind(Kind.Optional):
      const optionalNode = t as Optional;
      switch (true) {
        case (t as Optional).type.isKind(Kind.ListType):
        case (t as Optional).type.isKind(Kind.MapType):
          return write(
            typeInst,
            typeClass,
            typeMeth,
            variable,
            optionalNode.type,
            true,
            isReference
          );
      }
      code += "if (" + variable + " === null) {\n";
      code += typeInst + ".writeNil()\n";
      code += "} else {\n";
      code += write(
        typeInst,
        typeClass,
        typeMeth,
        variable + "!",
        optionalNode.type,
        true,
        isReference
      );
      code += "}\n";
      return code;
    default:
      return "unknown";
  }
}

/**
 * Determines if a node is a void node
 * @param t Node that is a Type node
 */
export function isVoid(t: Type): boolean {
  if (t.isKind(Kind.Named)) {
    return (t as Named).name.value == "void";
  }
  return false;
}

/**
 * Determines if a node is a bytes node
 * @param t Node that is a Type node
 */
 export function isBytes(t: Type): boolean {
  if (t.isKind(Kind.Named)) {
    return (t as Named).name.value == "bytes";
  }
  return false;
}

/**
 * Determines if Type Node is a Named node and if its type is not one of the base translation types.
 * @param t Node that is a Type node
 */
export function isObject(t: Type): boolean {
  if (t.isKind(Kind.Named)) {
    return !primitives.has((t as Named).name.value);
  }
  return false;
}

/**
 * Determines if one of the annotations provided is a reference
 * @param annotations array of Directives
 */
export function isReference(annotations: Annotation[]): boolean {
  for (let annotation of annotations) {
    if (
      annotation.name.value == "ref" ||
      annotation.name.value == "reference"
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Capitlizes a given string
 * @param str string to be capitlized
 * @returns string with first character capitalized. If empty string returns empty string.
 */
export function capitalize(str: string): string {
  if (str.length == 0) return str;
  if (str.length == 1) return str[0].toUpperCase();
  return str[0].toUpperCase() + str.slice(1);
}

/**
 * Given an array of OperationDefintion returns them as functions with their arguments
 * @param ops
 */
export function opsAsFns(ops: OperationDefinition[]): string {
  return ops
    .map((op) => {
      return `function ${op.name.value}(${mapArgs(
        op.parameters
      )}): ${expandType(op.type, true, isReference(op.annotations))} {\n}`;
    })
    .join("\n");
}

/**
 * returns string of args mapped to their type
 * @param args ParameterDefinition array which is an array of the arguments
 */
export function mapArgs(params: ParameterDefinition[]): string {
  return params
    .map((param) => {
      return mapArg(param);
    })
    .join(", ");
}

export function mapArg(param: ParameterDefinition): string {
  return `${param.name.value}: ${expandType(
    param.type,
    true,
    isReference(param.annotations)
  )}`;
}

/**
 * returns if a widl type is a node
 * @param o TypeDefinition which correlates to a widl Type
 */
export function isNode(o: TypeDefinition): boolean {
  for (const field of o.fields) {
    if (field.name.value.toLowerCase() == "id") {
      return true;
    }
  }
  return false;
}

export function varAccessArg(
  variable: string,
  params: ParameterDefinition[]
): string {
  return params
    .map((param) => {
      return `${variable}.${param.name.value}`;
    })
    .join(", ");
}

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
import { camelCase, pascalCase } from "../utils";
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
          undefined,
          true,
          isReference(vd.annotations)
        )}`
    )
    .join(joinOn);
}

/**
 * Creates string that is an msgpack size code block
 * @param variable variable that is being size
 * @param t the type node to encode
 * @param isReference if the type that is being expanded has a `@ref` annotation
 */
export function size(
  typeInstRef: boolean,
  variable: string,
  t: Type,
  isReference: boolean
): string {
  return write(
    "sizer",
    typeInstRef,
    "Writer",
    "Encode",
    variable,
    t,
    false,
    isReference
  );
}

/**
 * Creates string that is an msgpack encode code block
 * @param variable variable that is being encode
 * @param t the type node to encode
 * @param isReference if the type that is being expanded has a `@ref` annotation
 */
export function encode(
  typeInstRef: boolean,
  variable: string,
  t: Type,
  isReference: boolean
): string {
  return write(
    "encoder",
    typeInstRef,
    "Writer",
    "Encode",
    variable,
    t,
    false,
    isReference
  );
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
      return "nil";
    case ListType:
    case MapType:
      return `new ${expandType(
        type,
        undefined,
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
          return "[]byte{}";
        default:
          return `${capitalize(name)}()`; // reference to something else
      }
  }
  return `???${expandType(
    type,
    undefined,
    false,
    isReference(fieldDef.annotations)
  )}???`;
}

export function defaultValueForType(type: Type, packageName?: string): string {
  switch (type.constructor) {
    case Optional:
      return "nil";
    case ListType:
    case MapType:
      return `${expandType(type, packageName, false, false)}{}`;
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
          return "[]byte{}";
        default:
          const prefix =
            packageName != undefined && packageName != ""
              ? packageName + "."
              : "";
          return `${prefix}${capitalize((type as Named).name.value)}{}`; // reference to something else
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
  packageName: string | undefined,
  useOptional: boolean,
  isReference: boolean
): string => {
  switch (true) {
    case type.isKind(Kind.Named):
      if (isReference) {
        return "string";
      }
      var namedValue = (type as Named).name.value;
      const translation = translations.get(namedValue);
      if (translation != undefined) {
        return (namedValue = translation!);
      }
      if (isObject(type) && packageName != undefined && packageName != "") {
        return packageName + "." + namedValue;
      }
      return namedValue;
    case type.isKind(Kind.MapType):
      return `map[${expandType(
        (type as MapType).keyType,
        packageName,
        true,
        isReference
      )}]${expandType(
        (type as MapType).valueType,
        packageName,
        true,
        isReference
      )}`;
    case type.isKind(Kind.ListType):
      return `[]${expandType(
        (type as ListType).type,
        packageName,
        true,
        isReference
      )}`;
    case type.isKind(Kind.Optional):
      const nestedType = (type as Optional).type;
      let expanded = expandType(nestedType, packageName, true, isReference);
      if (
        useOptional &&
        !(
          nestedType.isKind(Kind.MapType) ||
          nestedType.isKind(Kind.ListType) ||
          expanded == "[]byte"
        )
      ) {
        return `*${expanded}`;
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
  typeInstRef: boolean,
  variable: string,
  errorHandling: boolean,
  defaultVal: string,
  t: Type,
  prevOptional: boolean,
  isReference: boolean
): string {
  const returnPrefix = defaultVal == "" ? "" : `${defaultVal}, `;
  let prefix = "return ";
  if (variable != "") {
    if (
      variable == "item" ||
      variable == "key" ||
      variable == "value" ||
      variable == "ret"
    ) {
      if (errorHandling) {
        prefix = variable + ", err := ";
      } else {
        prefix = variable + " := ";
      }
    } else {
      if (errorHandling) {
        prefix = variable + ", err = ";
      } else {
        prefix = variable + " = ";
      }
    }
  }
  switch (true) {
    case t.isKind(Kind.Named):
      let namedNode = t as Named;
      const amp = typeInstRef ? "&" : "";
      let decodeFn = `Decode${namedNode.name.value}(${amp}decoder)`;
      if (isReference) {
        decodeFn = `decoder.ReadString()`;
      } else if (decodeFuncs.has(namedNode.name.value)) {
        decodeFn = `decoder.${decodeFuncs.get(namedNode.name.value)}()`;
      }
      if (prevOptional) {
        return `nonNil, err = ${decodeFn}
        ${prefix}${namedNode.name.value == "bytes" ? "" : "&"}nonNil\n`;
      }
      return `${prefix}${decodeFn}\n`;
    case t.isKind(Kind.MapType):
      let mapCode = `mapSize, err := decoder.ReadMapSize()
      if err != nil {
        return ${returnPrefix}err
      }\n`;
      if (variable == "ret") {
        mapCode += "ret :=";
      } else {
        mapCode += `${variable} = `;
      }
      mapCode += `make(map[${expandType(
        (t as MapType).keyType,
        undefined,
        true,
        isReference
      )}]${expandType(
        (t as MapType).valueType,
        undefined,
        true,
        isReference
      )}, mapSize)\n`;
      mapCode += `for mapSize > 0 {
        mapSize--\n`;
      mapCode += read(
        typeInstRef,
        "key",
        true,
        defaultVal,
        (t as MapType).keyType,
        false,
        isReference
      );
      if (!mapCode.endsWith(`\n`)) {
        mapCode += `\n`;
      }
      mapCode += `if err != nil {
          return ${returnPrefix}err
        }\n`;
      mapCode += read(
        typeInstRef,
        "value",
        true,
        defaultVal,
        (t as MapType).valueType,
        false,
        isReference
      );
      if (!mapCode.endsWith(`\n`)) {
        mapCode += `\n`;
      }
      mapCode += `if err != nil {
          return ${returnPrefix}err
        }\n`;
      mapCode += `${variable}[key] = value
      }\n`;
      return mapCode;
    case t.isKind(Kind.ListType):
      let listCode = `listSize, err := decoder.ReadArraySize()
      if err != nil {
        return ${returnPrefix}err
      }\n`;
      if (variable == "ret") {
        listCode += "ret :=";
      } else {
        listCode += `${variable} = `;
      }
      listCode += `make([]${expandType(
        (t as ListType).type,
        undefined,
        true,
        isReference
      )}, 0, listSize)\n`;
      listCode += `for listSize > 0 {
        listSize--
        var nonNilItem ${
          (t as ListType).type.isKind(Kind.Optional) ? "*" : ""
        }${expandType((t as ListType).type, undefined, false, isReference)}\n`;
      listCode += read(
        typeInstRef,
        "nonNilItem",
        true,
        defaultVal,
        (t as ListType).type,
        false,
        isReference
      );
      if (!listCode.endsWith(`\n`)) {
        listCode += `\n`;
      }
      listCode += `if err != nil {
          return ${returnPrefix}err
        }\n`;
      listCode += `${variable} = append(${variable}, nonNilItem)
      }\n`;
      return listCode;
    case t.isKind(Kind.Optional):
      const optNode = t as Optional;
      optNode.type;
      switch (true) {
        case optNode.type.isKind(Kind.ListType):
        case optNode.type.isKind(Kind.MapType):
          return (
            prefix +
            read(
              typeInstRef,
              variable,
              false,
              defaultVal,
              optNode.type,
              true,
              isReference
            )
          );
      }
      let optCode = "";
      optCode += "isNil, err := decoder.IsNextNil()\n";
      optCode += "if err == nil {\n";
      optCode += "if isNil {\n";
      optCode += prefix.replace(", err", "") + "nil;\n";
      optCode += "} else {\n";
      optCode += `var nonNil ${expandType(
        optNode.type,
        "",
        false,
        isReference
      )}\n`;
      optCode += read(
        typeInstRef,
        variable,
        false,
        defaultVal,
        optNode.type,
        true,
        isReference
      );
      optCode += "}\n";
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
  typeInstRef: boolean,
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
        return `${typeInst}.WriteString(${variable})`;
      }
      const namedNode = t as Named;
      if (encodeFuncs.has(namedNode.name.value)) {
        return `${typeInst}.${encodeFuncs.get(
          namedNode.name.value
        )}(${variable})\n`;
      }
      const amp = typeInstRef ? "&" : "";
      return `${variable}.${typeMeth}(${amp}${typeInst})\n`;
    case t.isKind(Kind.MapType):
      const mappedNode = t as MapType;
      code +=
        typeInst +
        `.WriteMapSize(uint32(len(${variable})))
      if ${variable} != nil { // TinyGo bug: ranging over nil maps panics.
      for k, v := range ${variable} {
        ${write(
          typeInst,
          typeInstRef,
          typeClass,
          typeMeth,
          "k",
          mappedNode.keyType,
          false,
          isReference
        )}${write(
          typeInst,
          typeInstRef,
          typeClass,
          typeMeth,
          "v",
          mappedNode.valueType,
          false,
          isReference
        )}}
      }\n`;
      return code;
    case t.isKind(Kind.ListType):
      const listNode = t as ListType;
      code +=
        typeInst +
        `.WriteArraySize(uint32(len(${variable})))
      for _, v := range ${variable} {
        ${write(
          typeInst,
          typeInstRef,
          typeClass,
          typeMeth,
          "v",
          listNode.type,
          false,
          isReference
        )}}\n`;
      return code;
    case t.isKind(Kind.Optional):
      const optionalNode = t as Optional;
      switch (true) {
        case (t as Optional).type.isKind(Kind.ListType):
        case (t as Optional).type.isKind(Kind.MapType):
          return write(
            typeInst,
            typeInstRef,
            typeClass,
            typeMeth,
            variable,
            optionalNode.type,
            true,
            isReference
          );
      }
      code += "if " + variable + " == nil {\n";
      code += typeInst + ".WriteNil()\n";
      code += "} else {\n";
      let vprefix = "";
      if (!isObject(optionalNode.type)) {
        vprefix = "*";
      }
      code += write(
        typeInst,
        typeInstRef,
        typeClass,
        typeMeth,
        vprefix + variable,
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

export function uncapitalize(str: string): string {
  if (str.length == 0) return str;
  if (str.length == 1) return str[0].toLowerCase();
  return str[0].toLowerCase() + str.slice(1);
}

export function parameterName(str: string): string {
  str = camelCase(str);
  if (str.endsWith("Id")) {
    str = str.substring(0, str.length - 2) + "ID";
  }
  return str;
}

export function fieldName(str: string): string {
  str = pascalCase(str);
  if (str.endsWith("Id")) {
    str = str.substring(0, str.length - 2) + "ID";
  }
  return str;
}

/**
 * Given an array of OperationDefintion returns them as functions with their arguments
 * @param ops
 */
export function opsAsFns(ops: OperationDefinition[]): string {
  return ops
    .map((op) => {
      return `func ${op.name.value}(${mapArgs(op.parameters)}) ${expandType(
        op.type,
        undefined,
        true,
        isReference(op.annotations)
      )} {\n}`;
    })
    .join("\n");
}

/**
 * returns string of args mapped to their type
 * @param args InputValueDefintion array which is an array of the arguments
 */
export function mapArgs(
  args: ParameterDefinition[],
  packageName?: string
): string {
  return args
    .map((arg) => {
      return mapArg(arg, packageName);
    })
    .join(", ");
}

export function mapArg(arg: ParameterDefinition, packageName?: string): string {
  return `${parameterName(arg.name.value)} ${expandType(
    arg.type,
    packageName,
    true,
    isReference(arg.annotations)
  )}`;
}

/**
 * returns if a widl type is a node
 * @param o ObjectDefintion which correlates to a widl Type
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
  args: ParameterDefinition[]
): string {
  return args
    .map((arg) => {
      return `${variable}.${fieldName(arg.name.value)}`;
    })
    .join(", ");
}

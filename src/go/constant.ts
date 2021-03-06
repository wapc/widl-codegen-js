export const translations = new Map<string, string>([
  ["ID", "string"],
  ["bytes", "[]byte"],
  ["i8", "int8"],
  ["i16", "int16"],
  ["i32", "int32"],
  ["i64", "int64"],
  ["u8", "uint8"],
  ["u16", "uint16"],
  ["u32", "uint32"],
  ["u64", "uint64"],
  ["f32", "float32"],
  ["f64", "float64"],
]);

export const primitives = new Set([
  "bool",
  "i8",
  "i16",
  "i32",
  "i64",
  "u8",
  "u16",
  "u32",
  "u64",
  "f32",
  "f64",
  "string",
]);

export const decodeFuncs = new Map<string, string>([
  ["ID", "ReadString"],
  ["bool", "ReadBool"],
  ["string", "ReadString"],
  ["i8", "ReadInt8"],
  ["u8", "ReadUint8"],
  ["i16", "ReadInt16"],
  ["u16", "ReadUint16"],
  ["i32", "ReadInt32"],
  ["u32", "ReadUint32"],
  ["i64", "ReadInt64"],
  ["u64", "ReadUint64"],
  ["f32", "ReadFloat32"],
  ["f64", "ReadFloat64"],
  ["bytes", "ReadByteArray"],
]);

export const encodeFuncs = new Map<string, string>([
  ["ID", "WriteString"],
  ["bool", "WriteBool"],
  ["string", "WriteString"],
  ["i8", "WriteInt8"],
  ["u8", "WriteUint8"],
  ["i16", "WriteInt16"],
  ["u16", "WriteUint16"],
  ["i32", "WriteInt32"],
  ["u32", "WriteUint32"],
  ["i64", "WriteInt64"],
  ["u64", "WriteUint64"],
  ["f32", "WriteFloat32"],
  ["f64", "WriteFloat64"],
  ["bytes", "WriteByteArray"],
]);

export const translations = new Map<string, string>([
  ["ID", "string"],
  ["bytes", "ArrayBuffer"],
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
  ["ID", "readString"],
  ["bool", "readBool"],
  ["string", "readString"],
  ["i8", "readInt8"],
  ["u8", "readUInt8"],
  ["i16", "readInt16"],
  ["u16", "readUInt16"],
  ["i32", "readInt32"],
  ["u32", "readUInt32"],
  ["i64", "readInt64"],
  ["u64", "readUInt64"],
  ["f32", "readFloat32"],
  ["f64", "readFloat64"],
  ["bytes", "readByteArray"],
]);

export const encodeFuncs = new Map<string, string>([
  ["ID", "writeString"],
  ["bool", "writeBool"],
  ["string", "writeString"],
  ["i8", "writeInt8"],
  ["u8", "writeUInt8"],
  ["i16", "writeInt16"],
  ["u16", "writeUInt16"],
  ["i32", "writeInt32"],
  ["u32", "writeUInt32"],
  ["i64", "writeInt64"],
  ["u64", "writeUInt64"],
  ["f32", "writeFloat32"],
  ["f64", "writeFloat64"],
  ["bytes", "writeByteArray"],
]);

// Expose `widl.codegen.assemblyscript` for the browser
import * as assemblyscriptAll from "./assemblyscript";
export const assemblyscript = assemblyscriptAll;

// Expose `widl.codegen.go` for the browser
import * as goAll from "./go";
export const go = goAll;

// Expose `widl.codegen.rust` for the browser
import * as rustAll from "./rust";
export const rust = rustAll;

// Expose `widl.codegen.tinygo` for the browser
import * as tinygoAll from "./tinygo";
export const tinygo = tinygoAll;

// Expose `widl.codegen.utils` for the browser
import * as utilsAll from "./utils";
export const utils = utilsAll;

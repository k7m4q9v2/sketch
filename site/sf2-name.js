// SF2 name fields end at the first NUL, not at the end of the fixed-width field.
// Some banks leave binary bytes (including line breaks) after that terminator.
export function cleanSf2Name(value){return String(value??'').split('\0',1)[0].trimEnd();}
export function readSf2Name(bytes){const end=bytes.indexOf(0);return new TextDecoder().decode(end<0?bytes:bytes.subarray(0,end)).trimEnd();}

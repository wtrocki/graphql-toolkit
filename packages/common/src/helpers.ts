import { parse } from 'graphql';
export const asArray = <T>(fns: T | T[]) => (Array.isArray(fns) ? fns : [fns]);

export function chainFunctions(funcs: any[]) {
  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce((a, b) => (...args: any[]) => a(b(...args)));
}

export function isEqual<T>(a: T, b: T): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;

    for (var index = 0; index < a.length; index++) {
      if (a[index] !== b[index]) {
        return false;
      }
    }

    return true;
  }

  return a === b || (!a && !b);
}

export function isNotEqual<T>(a: T, b: T): boolean {
  return !isEqual(a, b);
}

export function isDocumentString(str: string): boolean {
  // XXX: is-valid-path or is-glob treat SDL as a valid path
  // (`scalar Date` for example)
  // this why checking the extension is fast enough
  // and prevent from parsing the string in order to find out
  // if the string is a SDL
  if (/\.[a-z0-9]+$/i.test(str)) {
    return false;
  }

  try {
    parse(str);

    return true;
  } catch (e) {
    return false;
  }
}

const invalidPathRegex = /[‘“!#$%&+^<=>`]/;
export function isValidPath(str: string): boolean {
  return typeof str === 'string' && !invalidPathRegex.test(str);
}

export async function resolveBuiltinModule<Module>(moduleName: string, option?: Module | string): Promise<Module> {
  if (typeof option === 'object') {
    return option;
  } else {
    try {
      if (typeof option === 'string') {
        return await import(option);
      } else {
        return await import(moduleName);
      }
    } catch (e) {
      console.warn(`
        ${option || moduleName} module couldn't be found for built-in ${moduleName}.
        Please provide a working module in your loader options!
      `);
      return null;
    }
  }
}

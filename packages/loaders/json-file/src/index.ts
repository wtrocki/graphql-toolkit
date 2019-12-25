import { extname, isAbsolute, resolve as resolvePath } from 'path';
import { IntrospectionQuery, buildClientSchema, parse } from 'graphql';
import { Source, printSchemaWithDirectives, SchemaPointerSingle, DocumentLoader, isValidPath } from '@graphql-toolkit/common';
import { existsSync, readFileSync } from 'fs';

function stripBOM(content: string): string {
  content = content.toString();
  // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
  // because the buffer-to-string conversion in `fs.readFileSync()`
  // translates it to FEFF, the UTF-16 BOM.
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  return content;
}

function parseBOM(content: string): any {
  return JSON.parse(stripBOM(content));
}

export function parseGraphQLJSON(pointer: string, jsonContent: string): Source {
  let parsedJson = parseBOM(jsonContent);

  if (parsedJson['data']) {
    parsedJson = parsedJson['data'];
  }

  if (parsedJson.kind === 'Document') {
    const document = parsedJson;
    return {
      location: pointer,
      document,
    };
  } else if (parsedJson.__schema) {
    const schema = buildClientSchema(parsedJson, options as any);
    return {
      location: pointer,
      document: parse(printSchemaWithDirectives(schema)),
      schema,
    };
  }
  throw new Error(`Not valid content`);
}

export interface JsonFileLoaderOptions {
  cwd?: string;
}

export class JsonFileLoader implements DocumentLoader {
  loaderId(): string {
    return 'json-file';
  }

  async canLoad(pointer: SchemaPointerSingle, options: JsonFileLoaderOptions): Promise<boolean> {
    if (isValidPath(pointer)) {
      const extension = extname(pointer).toLowerCase();
      if (extension === '.json') {
        const normalizedFilePath = isAbsolute(pointer) ? pointer : resolvePath(options.cwd || process.cwd(), pointer);
        if (existsSync(normalizedFilePath)) {
          return true;
        }
      }
    }

    return false;
  }

  async load(pointer: SchemaPointerSingle, options: JsonFileLoaderOptions): Promise<Source> {
    const normalizedFilepath = isAbsolute(pointer) ? pointer : resolvePath(options.cwd || process.cwd(), pointer);

    try {
      const jsonContent = readFileSync(normalizedFilepath, 'utf8');
      return parseGraphQLJSON(pointer, jsonContent);
    } catch (e) {
      throw new Error(`Unable to read JSON file: ${normalizedFilepath}`);
    }
  }
}

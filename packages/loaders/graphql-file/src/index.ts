import { Source, UniversalLoader, DocumentPointerSingle, SchemaPointerSingle, isValidPath } from '@graphql-toolkit/common';
import { parse, Source as GraphQLSource, Kind, DocumentNode, ParseOptions } from 'graphql';
import { extname, isAbsolute, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

export type GraphQLFileLoaderOptions = { skipGraphQLImport?: boolean; cwd?: string } & ParseOptions;

const GQL_EXTENSIONS = ['.gql', '.graphql', '.graphqls'];

export function parseGraphQLSDL(location: string, rawSDL: string, options: ParseOptions) {
  let document: DocumentNode;
  try {
    document = parse(new GraphQLSource(rawSDL, location), options);
  } catch (e) {
    if (e.message.includes('EOF')) {
      document = {
        kind: Kind.DOCUMENT,
        definitions: [],
      };
    } else {
      throw e;
    }
  }
  return {
    location,
    document,
    rawSDL,
  };
}

export class GraphQLFileLoader implements UniversalLoader<GraphQLFileLoaderOptions> {
  loaderId(): string {
    return 'graphql-file';
  }

  async canLoad(pointer: SchemaPointerSingle | DocumentPointerSingle, options: GraphQLFileLoaderOptions): Promise<boolean> {
    if (isValidPath(pointer)) {
      const extension = extname(pointer).toLowerCase();
      if (GQL_EXTENSIONS.includes(extension)) {
        const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd || process.cwd(), pointer);
        if (existsSync(normalizedFilePath)) {
          return true;
        }
      }
    }

    return false;
  }

  async load(pointer: SchemaPointerSingle | DocumentPointerSingle, options: GraphQLFileLoaderOptions): Promise<Source> {
    const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd || process.cwd(), pointer);
    const rawSDL = readFileSync(normalizedFilePath, 'utf-8').trim();

    return parseGraphQLSDL(pointer, rawSDL, options);
  }
}

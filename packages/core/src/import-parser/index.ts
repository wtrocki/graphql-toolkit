import { DefinitionNode } from 'graphql';
import { groupBy, includes } from 'lodash';
import resolveFrom from 'resolve-from';

import { ValidDefinitionNode } from './definition';
import { dirname, join } from 'path';
import { realpathSync } from 'fs';

/**
 * Describes the information from a single import line
 *
 */
export interface RawModule {
  imports: string[];
  from: string;
}

const gqlExt = /\.g(raph)?ql$/;
function isGraphQLFile(f: string) {
  return gqlExt.test(f);
}

/**
 * Parse a single import line and extract imported types and schema filename
 *
 * @param importLine Import line
 * @returns Processed import line
 */
export function parseImportLine(importLine: string): RawModule {
  // Apply regex to import line
  const matches = importLine.match(/^import\s+(\*|(.*))\s+from\s+('|")(.*)('|");?$/);
  if (!matches || matches.length !== 6 || !matches[4]) {
    throw new Error(`Too few regex matches: ${matches}`);
  }

  // Extract matches into named variables
  const [, wildcard, importsString, , from] = matches;

  // Extract imported types
  const imports = wildcard === '*' ? ['*'] : importsString.split(',').map(d => d.trim());

  // Return information about the import line
  return { imports, from };
}

/**
 * Parse a schema and analyze all import lines
 *
 * @param sdl Schema to parse
 * @returns Array with collection of imports per import line (file)
 */
export function parseSDL(sdl: string): RawModule[] {
  return sdl
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('# import ') || l.startsWith('#import '))
    .map(l => l.replace('#', '').trim())
    .map(parseImportLine);
}

/**
 * Check if a schema contains any type definitions at all.
 *
 * @param sdl Schema to parse
 * @returns True if SDL only contains comments and/or whitespaces
 */
export function isEmptySDL(sdl: string): boolean {
  return (
    sdl
      .split('\n')
      .map(l => l.trim())
      .filter(l => !(l.length === 0 || l.startsWith('#'))).length === 0
  );
}

/**
 * Resolve the path of an import.
 * First it will try to find a file relative from the file the import is in, if that fails it will try to resolve it as a module so imports from packages work correctly.
 *
 * @param filePath Path the import was made from
 * @param importFrom Path given for the import
 * @returns Full resolved path to a file
 */
export function resolveModuleFilePath(filePath: string, importFrom: string): string {
  const dirName = dirname(filePath);
  if (isGraphQLFile(filePath) && isGraphQLFile(importFrom)) {
    try {
      return realpathSync(join(dirName, importFrom));
    } catch (e) {
      if (e.code === 'ENOENT') {
        const addedExtensions = new Array<string>();
        for (const graphqlFileExtension of ['.gql', '.gqls', '.graphql', '.graphqls']) {
          if (!(graphqlFileExtension in require.extensions)) {
            require.extensions[graphqlFileExtension] = () => ({});
            addedExtensions.push(graphqlFileExtension);
          }
        }
        function cleanRequireExtensions() {
          for (const extension of addedExtensions) {
            delete require.extensions[extension];
          }
        }
        try {
          const resolvedPath = resolveFrom(dirName, importFrom);
          cleanRequireExtensions();
          return resolvedPath;
        } catch (e) {
          cleanRequireExtensions();
          throw e;
        }
      }
    }
  }

  return importFrom;
}

/**
 * Filter the types loaded from a schema, first by relevant types,
 * then by the types specified in the import statement.
 *
 * @param imports Types specified in the import statement
 * @param typeDefinitions All definitions from a schema
 * @returns Filtered collection of type definitions
 */
export function filterImportedDefinitions(imports: string[], typeDefinitions: ReadonlyArray<DefinitionNode>) {
  // This should do something smart with fields

  if (includes(imports, '*')) {
    return typeDefinitions;
  } else {
    const result = typeDefinitions.filter(d => {
      if ('name' in d) {
        return includes(
          imports.map(i => i.split('.')[0]),
          d.name.value
        );
      }
      return true;
    });
    const fieldImports = imports.filter(i => i.split('.').length > 1);
    const groupedFieldImports = groupBy(fieldImports, x => x.split('.')[0]);

    for (const rootType in groupedFieldImports) {
      const fields = groupedFieldImports[rootType].map(x => x.split('.')[1]);
      const objectTypeDefinition: any = typeDefinitions.find(def => 'name' in def && def.name.value === rootType);

      if ('fields' in objectTypeDefinition) {
        objectTypeDefinition.fields = objectTypeDefinition.fields.filter((f: any) => includes(fields, f.name.value) || includes(fields, '*'));
      }
    }

    return result;
  }
}

/**
 * Filter relevant definitions from schema
 *
 * @param definitions All definitions from a schema
 * @returns Relevant type definitions
 */
export function filterTypeDefinitions(definitions: ReadonlyArray<DefinitionNode>): ValidDefinitionNode[] {
  const validKinds = ['DirectiveDefinition', 'ScalarTypeDefinition', 'ObjectTypeDefinition', 'ObjectTypeExtension', 'InterfaceTypeDefinition', 'EnumTypeDefinition', 'UnionTypeDefinition', 'InputObjectTypeDefinition'];
  return definitions.filter(d => includes(validKinds, d.kind)).map(d => d as ValidDefinitionNode);
}

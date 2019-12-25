import { buildClientSchema, printSchema, parse, DocumentNode, Source as GraphQLSource, Kind, ParseOptions } from 'graphql';
import { UniversalLoader, parseGraphQLSDL, parseGraphQLJSON } from '@graphql-toolkit/common';
import simplegit from 'simple-git/promise';
import { GraphQLSchemaValidationOptions } from 'graphql/type/schema';

// git:branch:path/to/file
function extractData(
  pointer: string
): {
  ref: string;
  path: string;
} {
  const parts = pointer.replace(/^git\:/i, '').split(':');

  if (!parts || parts.length !== 2) {
    throw new Error('Schema pointer should match "git:branchName:path/to/file"');
  }

  return {
    ref: parts[0],
    path: parts[1],
  };
}

export type GitLoaderOptions = ParseOptions & GraphQLSchemaValidationOptions;

export class GitLoader implements UniversalLoader {
  loaderId() {
    return 'git-loader';
  }
  async canLoad(pointer: string) {
    return typeof pointer === 'string' && pointer.toLowerCase().startsWith('git:');
  }
  async load(pointer: string, options: GitLoaderOptions) {
    const { ref, path } = extractData(pointer);
    const git = simplegit();

    let content: string;

    try {
      content = await git.show([`${ref}:${path}`]);
    } catch (error) {
      throw new Error('Unable to load schema from git: ' + error);
    }

    if (/\.(gql|graphql)s?$/i.test(path)) {
      return parseGraphQLSDL(pointer, content, options);
    }

    if (/\.json$/i.test(path)) {
      return parseGraphQLJSON(pointer, content, options);
    }

    throw new Error(`Invalid file extension: ${path}`);
  }
}

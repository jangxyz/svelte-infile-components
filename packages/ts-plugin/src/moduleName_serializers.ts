import { createHash } from 'node:crypto';
import { split } from './utils.js';
import { decodeBase64, encodeBase64 } from './utils/base64.js';

type TS = typeof import('typescript/lib/tsserverlibrary');

export function createModuleNameSerializer_query(ts: TS) {
  function serializeModuleName(containingFile: string, moduleName: string) {
    return ts.server.toNormalizedPath(
      `${moduleName}?from=${encodeURIComponent(containingFile)}`,
    );
  }

  function deserializeModuleName(
    resolvedModuleName: string,
  ): readonly [moduleName: string, containingFile: string] {
    const [moduleName, paramString] = split(resolvedModuleName, '?', 2);
    const md = paramString.match(/from=([^&]*)/);
    // cannot find from= param
    if (!md) {
      console.error(
        'ERROR cannot extract containing file name from module name. Missing from= param',
        JSON.stringify(resolvedModuleName),
      );
      throw new Error('wrong module name');
    }

    const containingFile = decodeURIComponent(md[1]);
    return [moduleName, containingFile] as const;
  }

  return [serializeModuleName, deserializeModuleName] as const;
}

export function createModuleNameSerializer_hash(ts: TS) {
  function serializeModuleName(containingFile: string, moduleName: string) {
    const hashedContainingFile = hashFilePath(containingFile);
    const serializedName = `${hashedContainingFile}__${moduleName}`;
    return serializedName;
  }

  function deserializeModuleName(
    resolvedModuleName: string,
  ): [moduleName: string, containingFile: string] {
    const [hashedContainingFile, moduleName] = split(
      resolvedModuleName,
      '__',
      2,
    );
    return [moduleName, hashedContainingFile];
  }

  function hashFilePath(filePath: string): string {
    return createHash('md5').update(filePath).digest('hex'); // Use a short hash for uniqueness
  }

  return [serializeModuleName, deserializeModuleName] as const;
}

export function createModuleNameSerializer_base64(ts: TS) {
  function serializeModuleName(containingFile: string, moduleName: string) {
    const containingFile_encoded = encodeBase64(containingFile);
    const serializedName = `${containingFile_encoded}__${moduleName}`;
    return serializedName;
  }

  function deserializeModuleName(
    resolvedModuleName: string,
  ): [moduleName: string, containingFile: string] {
    const [containingFile_encoded, moduleName] = split(
      resolvedModuleName,
      '__',
      2,
    );
    return [moduleName, decodeBase64(containingFile_encoded)];
  }

  return [serializeModuleName, deserializeModuleName] as const;
}

import { inspect, type InspectOptions } from 'node:util';
import { replace } from './utils.js';
import type { Diagnostic } from 'typescript';

export function buildPrint(prefix = '', suffix = '') {
  return (...args: unknown[]) => {
    //console.log(`[${PLUGIN_NAME}]`, args.map((x) => tryStringify(x)).join(' '));
    const content = args.map((x) => tryStringify(x)).join(' ');
    console.log(prefix, content, suffix);
  };
}

export function tryRunning<T>(f: () => T, onError?: (err: unknown) => void) {
  try {
    return [f(), null] as const;
  } catch (err) {
    onError?.(err);
    return [undefined, err] as const;
  }
}

export function tryStringify(s: unknown, options?: InspectOptions) {
  //try {
  //  return JSON.stringify(s);
  //} catch (err) {
  //  //console.warn(err);
  //  return inspect(s);
  //}
  return inspect(s, options);
}

export function serializeDiagnostic(diagEntry: Diagnostic) {
  return replace(diagEntry, 'file', diagEntry.file?.fileName);
}

export function hasNumericStart<T extends object>(
  obj: T,
): obj is T & { start: number } {
  return 'start' in obj && typeof obj.start === 'number';
}

export function hasNumericProperty<T extends object, K extends string>(
  obj: T,
  key: K,
): obj is T & { [k in K]: number } {
  return key in obj && typeof (obj as any)[key] === 'number';
}

export function hasStringProperty<T extends object, K extends string>(
  obj: T,
  key: K,
): obj is T & { [k in K]: string } {
  return key in obj && typeof (obj as any)[key] === 'string';
}

export function proxy_languageServiceHost(serviceHost: ts.LanguageServiceHost) {
  return {
    getCompilationSettings: () => serviceHost.getCompilationSettings(),
    getScriptFileNames: () => serviceHost.getScriptFileNames(),
    getScriptVersion: (fileName) => serviceHost.getScriptVersion(fileName),
    getScriptSnapshot: (fileName) => serviceHost.getScriptSnapshot(fileName),
    getCurrentDirectory: () => serviceHost.getCurrentDirectory(),
    getDefaultLibFileName: (options) =>
      serviceHost.getDefaultLibFileName(options),
    readFile: (path, encoding) => serviceHost.readFile?.(path, encoding),
    fileExists: (path) => serviceHost.fileExists?.(path) ?? false,
    readDirectory: serviceHost.readDirectory?.bind(serviceHost),
    directoryExists: serviceHost.directoryExists?.bind(serviceHost),
    getDirectories: serviceHost.getDirectories?.bind(serviceHost),
    resolveModuleNames: serviceHost.resolveModuleNames?.bind(serviceHost),
  } as ts.LanguageServiceHost;
}

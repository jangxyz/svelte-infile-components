import * as path from 'node:path';
import { inspect, type InspectOptions } from 'node:util';

import {
  commands,
  Diagnostic,
  ExtensionContext,
  languages,
  Range,
  window,
  workspace,
  type CancellationToken,
  type FoldingContext,
  type FoldingRange,
  type LogOutputChannel,
  type ProviderResult,
  type TextDocument,
  type Uri,
} from 'vscode';
import {
  LanguageClientOptions,
  vsdiag,
  type ProvideFoldingRangeSignature,
  type ProvideDiagnosticSignature,
} from 'vscode-languageclient';
import {
  LanguageClient,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import { TsPlugin } from './tsplugin';
//import { setupSvelteKit } from './sveltekit';
//import { activateSvelteLanguageServer } from './activateSvelteLanguageServer';

let svelteLsApi: { getLS(): LanguageClient } | undefined;
let tsLsApi: { getLS(): LanguageClient } | undefined;

const name = 'Svelte Infile Components';

let console: ReturnType<typeof getLogger>;

export function activate(context: ExtensionContext) {
  console = getLogger(`${name} (extension)`);
  console.log(
    '🚀 ~ file: infile-components/extension.ts:44 ~ activate:',
    //context,
  );

  // The extension is activated on TS/JS/Svelte files because else it might be too late to configure the TS plugin:
  // If we only activate on Svelte file and the user opens a TS file first, the configuration command is issued too late.
  // We wait until there's a Svelte file open and only then start the actual language client.
  const tsPlugin = new TsPlugin(context);
  if (workspace.textDocuments.some((doc) => doc.languageId === 'svelte')) {
    svelteLsApi = activateCustomSvelteLanguageServer(context);
    tsLsApi = activateCustomTypeScriptLanguageServer(context);
    console.log(
      '🚀 ~ file: extension.ts:56 ~ tsLsApi:',
      workspace.textDocuments.map(({ fileName }) => fileName),
      tsLsApi,
    );
    tsPlugin.askToEnable();
  } else {
    const onTextDocumentListener = workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === 'svelte') {
        svelteLsApi = activateCustomSvelteLanguageServer(context);
        tsLsApi = activateCustomTypeScriptLanguageServer(context);
        console.log('🚀 ~ file: extension.ts:66 ~ tsLsApi:', doc, tsLsApi);
        tsPlugin.askToEnable();
        onTextDocumentListener.dispose();
      }
    });

    context.subscriptions.push(onTextDocumentListener);
  }

  //setupSvelteKit(context);

  // separate diagnostic collection approach

  const myDiagnostics = languages.createDiagnosticCollection('myExtension');
  let isUpdatingDiagnostics = false;
  context.subscriptions.push(myDiagnostics);
  languages.onDidChangeDiagnostics((change) => {
    if (isUpdatingDiagnostics) return;

    console.log(
      '🚀 ~ file: infile-extension/extension.ts:86 ~ change:',
      Date.now() / 1000,
      change.uris.map((uri) => uri.path),
      { isUpdatingDiagnostics },
    );
    type DiagEntry = [Uri, Diagnostic[]];

    isUpdatingDiagnostics = true;

    function filterDiagnostics(diagnostics: Diagnostic[], uri: Uri) {
      if (!uri.path.endsWith('.svelte')) {
        return diagnostics;
      }

      return diagnostics
        .filter((diag) => {
          return !(
            diag.code === 2307 &&
            diag.message.startsWith("Cannot find module 'infile:")
          );
        })
        .concat([
          //{ message: `I'm just here, don't bother.`, range: diagnostics[0].range, severity: 0, source: 'typescript', },
          new Diagnostic(new Range(0, 0, 1, 0), `I'm just here, don't bother.`),
        ]);
    }

    try {
      change.uris.forEach((uri) => {
        const diagnostics = languages.getDiagnostics(uri);
        //const filteredDiagnostics = filterDiagnostics(diagnostics);
        const filtered = filterDiagnostics(diagnostics, uri);
        if (filtered.length !== diagnostics.length) {
          console.log(
            '🚀 ~ file: extension.ts:101 ~ uri:',
            uri.path,
            diagnostics.length,
            '=>',
            filtered.length,
            filtered.map((entry) => `${entry.message} (${entry.code})`),
            { filtered, diagnostics },
          );

          myDiagnostics.set(uri, filtered);
        } else {
          console.log(
            '🚀 ~ file: extension.ts:101 ~ uri:',
            uri.path,
            diagnostics.length,
            { diagnostics },
          );
        }

        //return [uri, filtered] as DiagEntry;
      });
      //console.log('🚀 ~ file: extension.ts:117 ~ myDiagnostics:');
      //for (const [uri, diagnostics] of uriDiagTuples) {
      //  console.log('  ', uri.path, diagnostics);
      //}

      //myDiagnostics.set(uriDiagTuples);

      //const emptyDiagEntries = uriDiagTuples.map(([uri, diagnostics]) => [uri, []] as DiagEntry);
      //console.log('set:', emptyDiagEntries.length);
      //myDiagnostics.set(emptyDiagEntries);
    } finally {
      setTimeout(() => {
        isUpdatingDiagnostics = false;
      }, 1500);
    }
    //}
  });

  // This API is considered private and only exposed for experimenting.
  // Interface may change at any time. Use at your own risk!
  return {
    /**
     * As a function, because restarting the server
     * will result in another instance.
     */
    getLanguageServer() {
      if (!svelteLsApi) {
        svelteLsApi = activateCustomSvelteLanguageServer(context);
      }
      if (!tsLsApi) {
        tsLsApi = activateCustomTypeScriptLanguageServer(context);
      }

      return svelteLsApi.getLS();
    },
  };
}

export function deactivate() {
  const stopSvelteLs = svelteLsApi?.getLS().stop();
  svelteLsApi = undefined;

  const stopTsLs = tsLsApi?.getLS().stop();
  tsLsApi = undefined;

  return stopSvelteLs;
}

function activateCustomSvelteLanguageServer(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'src', 'svelteServer.js'),
  );

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  let __pendings = new Map<string, Thenable<FoldingRange[]> | null>();

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    //outputChannelName: 'Svelte Infile Component extension',
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: 'svelte' }],
    //synchronize: {
    //  // Notify the server about file changes to '.clientrc files contained in the workspace
    //  fileEvents: workspace.createFileSystemWatcher('**/.clientrc'),
    //},
    middleware: {
      provideFoldingRanges,
      //provideDiagnostics
    },
  };

  // Create the language client and start the client.
  const langCli = new LanguageClient(
    'svelteInfileComponents',
    `${name} (Svelte LS)`,
    serverOptions,
    clientOptions,
  );

  // Start the client. This will also launch the server
  langCli.start();
  console.log(
    'svelte language client started.',
    //client,
    { serverOptions, clientOptions },
  );

  return {
    getLS() {
      return langCli;
    },
  };

  ///

  async function provideFoldingRanges(
    document: TextDocument,
    context: FoldingContext,
    token: CancellationToken,
    next: ProvideFoldingRangeSignature,
  ) {
    //console.log( '🚀 ~ file: infile-extension/extension.ts:227 ~ svelte langClient ~ provideFoldingRanges:', __pendings.get('executeFoldingRangeProvider'),);

    // skip if already working on it.
    if (!__pendings.get('executeFoldingRangeProvider')) {
      try {
        const pr = commands.executeCommand<FoldingRange[]>(
          'vscode.executeFoldingRangeProvider',
          document.uri,
        );
        //__pending_executeFoldingRangeProvider = pr;
        __pendings.set('executeFoldingRangeProvider', pr);
        const result1 = await pr;
        //console.log( '🚀 ~ file: infile-extension/extension.ts:239 ~ svelte langClient ~ provideFoldingRanges ~ result1:', result1,);
        const result2 = result1.map((range) => ({
          ...range,
          end: range.end + 1,
        }));
        //console.log( '🚀 ~ file: infile-extension/extension.ts:244 ~ svelte langClient ~ provideFoldingRanges ~ result2:', result2,);
        return result2;
      } catch (err) {
        console.error(String(err));
      } finally {
        //__pending_executeFoldingRangeProvider = null;
        __pendings.set('executeFoldingRangeProvider', null);
      }
    }

    return [];
    // request to default server behavior
    const result2 = next(document, context, token);
    //console.log( '🚀 ~ file: extension.ts:257 ~ svelte langClient ~ provideFoldingRanges ~ result:', result2,);
    Promise.resolve(result2).then((ranges) => {
      //console.log('~ provideFoldingRanges ~ then:', ranges);
      return ranges;
    });

    return result2;
  }

  function provideDiagnostics(
    document: TextDocument | Uri,
    previousResultId: string | undefined,
    token: CancellationToken,
    next: ProvideDiagnosticSignature,
  ): ProviderResult<vsdiag.DocumentDiagnosticReport> {
    const uri = 'uri' in document ? document.uri : document;
    console.log(
      '🚀 ~ file: infile-extension/extension.ts:274 ~ svelte langClient ~ provideDiagnostics:',
      uri.path,
    );

    // skip if already working on it.
    try {
      const diags1 = languages.getDiagnostics(uri);

      const diags2 = diags1.filter((diag) => {
        if (
          diag.code === 2307 &&
          diag.message.startsWith("Cannot find module 'infile:")
        ) {
          return false;
        }
        return true;
      });

      console.log(
        '🚀 ~ file: infile-extension/extension.ts:293 ~ svelte langClient ~ provideDiagnostics ~ diags:',
        uri.path,
        diags1.length,
        '=>',
        diags2.length,
        diags2.map((entry) => `${entry.message} (${entry.code})`),
        //{ diags1, diags2 },
      );

      return {
        kind: vsdiag.DocumentDiagnosticReportKind.full,
        items: diags2,
      };
    } catch (err) {
      console.error(String(err));
    }

    return {
      kind: vsdiag.DocumentDiagnosticReportKind.full,
      items: [],
    };
  }
}

function activateCustomTypeScriptLanguageServer(context: ExtensionContext) {
  return;
  console.log('activating custom typescript language server...');
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'src', 'tsServer.js'),
  );

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  let __pendings = new Map<string, Thenable<FoldingRange[]> | null>();

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    //outputChannelName: 'Svelte Infile Component extension',
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: 'typescript' }],
    //synchronize: {
    //  // Notify the server about file changes to '.clientrc files contained in the workspace
    //  fileEvents: workspace.createFileSystemWatcher('**/.clientrc'),
    //},
    middleware: { provideFoldingRanges, provideDiagnostics },
  };

  // Create the language client and start the client.
  const langCli = new LanguageClient(
    'svelteInfileComponents',
    `${name} (TypeScript LS)`,
    serverOptions,
    clientOptions,
  );

  // Start the client. This will also launch the server
  langCli.start();
  console.log(
    'typescript language client started.',
    //client,
    { serverOptions, clientOptions },
  );

  return {
    getLS() {
      return langCli;
    },
  };

  ///

  async function provideFoldingRanges(
    document: TextDocument,
    context: FoldingContext,
    token: CancellationToken,
    next: ProvideFoldingRangeSignature,
  ) {
    //console.log( '🚀 ~ file: infile-extension/extension.ts:379 ~ typescript langClient ~ provideFoldingRanges:', __pendings.get('executeFoldingRangeProvider'),);

    // skip if already working on it.
    if (!__pendings.get('executeFoldingRangeProvider')) {
      try {
        const pr = commands.executeCommand<FoldingRange[]>(
          'vscode.executeFoldingRangeProvider',
          document.uri,
        );
        //__pending_executeFoldingRangeProvider = pr;
        __pendings.set('executeFoldingRangeProvider', pr);
        const result1 = await pr;
        //console.log( '🚀 ~ file: infile-extension/extension.ts:391 ~ typescript langClient ~ provideFoldingRanges ~ result1:', result1,);
        const result2 = result1.map((range) => ({
          ...range,
          end: range.end + 1,
        }));
        //console.log( '🚀 ~ file: infile-extension/extension.ts:396 ~ typescript langClient ~ provideFoldingRanges ~ result2:', result2,);
        return result2;
      } catch (err) {
        console.error(String(err));
      } finally {
        //__pending_executeFoldingRangeProvider = null;
        __pendings.set('executeFoldingRangeProvider', null);
      }
    }

    return [];
    // request to default server behavior
    const result2 = next(document, context, token);
    //console.log( '🚀 ~ file: extension.ts:409 ~ typescript langClient ~ provideFoldingRanges ~ result:', result2,);
    Promise.resolve(result2).then((ranges) => {
      //console.log('~ provideFoldingRanges ~ then:', ranges);
      return ranges;
    });

    return result2;
  }

  function provideDiagnostics(
    document: TextDocument | Uri,
    previousResultId: string | undefined,
    token: CancellationToken,
    next: ProvideDiagnosticSignature,
  ): ProviderResult<vsdiag.DocumentDiagnosticReport> {
    const uri = 'uri' in document ? document.uri : document;
    console.log(
      '🚀 ~ file: infile-extension/extension.ts:426 ~ typescript langClient ~ provideDiagnostics:',
      uri.path,
      { text: 'uri' in document && document.getText() },
    );

    // skip if already working on it.
    try {
      const diags1 = languages.getDiagnostics(uri);

      const diags2 = diags1.filter((diag) => {
        if (
          diag.code === 2307 &&
          diag.message.startsWith("Cannot find module 'infile:")
        ) {
          return false;
        }
        return true;
      });

      console.log(
        '🚀 ~ file: infile-extension/extension.ts:446 ~ typescript langClient ~ provideDiagnostics ~ diags:',
        uri.path,
        diags1.length,
        '=>',
        diags2.length,
        diags2.map((entry) => `${entry.message} (${entry.code})`),
        { diags1, diags2 },
      );

      return {
        kind: vsdiag.DocumentDiagnosticReportKind.full,
        items: diags2,
      };
    } catch (err) {
      console.error(String(err));
    }

    return {
      kind: vsdiag.DocumentDiagnosticReportKind.full,
      items: [],
    };
  }
}

function getLogger(name: string) {
  type LogFunction = (...args: unknown[]) => void;
  type LogFunc_with_Options = LogFunction & {
    options: (options?: InspectOptions) => LogFunction;
  };

  const logger = window.createOutputChannel(name, {
    log: true,
  }) as LogOutputChannel & {
    log: LogFunction & { options: (options?: InspectOptions) => LogFunction };
  };

  logger.log = ((...args: unknown[]) =>
    logFormatted.bind(logger)(args)) as LogFunc_with_Options;

  return logger;

  ///

  function logFormatted(
    this: typeof logger,
    args: unknown[],
    inspectOptions?: InspectOptions,
  ) {
    const items = args.map((v) => formatArg(v, inspectOptions));
    logger.appendLine(items.join(' '));
  }

  function formatArg(value: unknown, options?: InspectOptions): string {
    if (typeof value === 'string') return value;
    return inspect(value, options);
  }
}

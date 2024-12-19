import {
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditRequest,
  CodeActionKind,
  DocumentUri,
  Connection,
  MessageType,
  RenameFile,
  RequestType,
  ShowMessageNotification,
  TextDocumentIdentifier,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  WorkspaceEdit,
  SemanticTokensRequest,
  SemanticTokensRangeRequest,
  DidChangeWatchedFilesParams,
  LinkedEditingRangeRequest,
  CallHierarchyPrepareRequest,
  CallHierarchyIncomingCallsRequest,
  CallHierarchyOutgoingCallsRequest,
  InlayHintRequest,
  SemanticTokensRefreshRequest,
  InlayHintRefreshRequest,
  DidChangeWatchedFilesNotification,
  RelativePattern,
  type InitializeParams,
} from 'vscode-languageserver';
import {
  IPCMessageReader,
  IPCMessageWriter,
  createConnection,
} from 'vscode-languageserver/node';
import { DiagnosticsManager } from './lib/DiagnosticsManager';
import { Document, DocumentManager } from './lib/documents';
import { getSemanticTokenLegends } from './lib/semanticToken/semanticTokenLegend';
import { Logger } from './logger';
import { LSConfigManager } from './ls-config';
import {
  AppCompletionItem,
  CSSPlugin,
  HTMLPlugin,
  PluginHost,
  SveltePlugin,
  TypeScriptPlugin,
  OnWatchFileChangesPara,
  LSAndTSDocResolver,
} from './plugins';
import {
  debounceThrottle,
  isNotNullOrUndefined,
  normalizeUri,
  urlToPath,
} from './utils';
import { FallbackWatcher } from './lib/FallbackWatcher';
import { configLoader } from './lib/documents/configLoader';
import { setIsTrusted } from './importPackage';
import { SORT_IMPORT_CODE_ACTION_KIND } from './plugins/typescript/features/CodeActionsProvider';
import { createLanguageServices } from './plugins/css/service';
import { FileSystemProvider } from './plugins/css/FileSystemProvider';
import { wrap } from './jangxyz_helper';

namespace TagCloseRequest {
  export const type: RequestType<
    TextDocumentPositionParams,
    string | null,
    any
  > = new RequestType('html/tag');
}

export interface LSOptions {
  /**
   * If you have a connection already that the ls should use, pass it in.
   * Else the connection will be created from `process`.
   */
  connection?: Connection;
  /**
   * If you want only errors getting logged.
   * Defaults to false.
   */
  logErrorsOnly?: boolean;
}

/**
 * Starts the language server.
 *
 * @param options Options to customize behavior
 */
export function startServer(options?: LSOptions) {
  let connection = options?.connection;
  if (!connection) {
    // prettier-ignore
    console.log('🚀 ~ file: server.ts:92 ~ startServer ~ connection:', connection, process.argv.includes('--stdio'));
    if (process.argv.includes('--stdio')) {
      // prettier-ignore
      console.log = (...args: any[]) => {
        console.warn(...args);
      };
      connection = createConnection(process.stdin, process.stdout);
    } else {
      connection = createConnection(
        new IPCMessageReader(process),
        new IPCMessageWriter(process),
      );
    }
  }

  if (options?.logErrorsOnly !== undefined) {
    Logger.setLogErrorsOnly(options.logErrorsOnly);
  }

  const docManager = new DocumentManager(
    (textDocument) => new Document(textDocument.uri, textDocument.text),
  );
  const configManager = new LSConfigManager();
  const pluginHost = new PluginHost(docManager);

  let sveltePlugin: SveltePlugin = undefined as any;
  let watcher: FallbackWatcher | undefined;
  let pendingWatchPatterns: RelativePattern[] = [];
  let watchDirectory: (patterns: RelativePattern[]) => void = (patterns) => {
    pendingWatchPatterns = patterns;
  };

  // Include Svelte files to better deal with scenarios such as switching git branches
  // where files that are not opened in the client could change
  const watchExtensions = [
    '.ts',
    '.js',
    '.mts',
    '.mjs',
    '.cjs',
    '.cts',
    '.json',
    '.svelte',
  ];
  const nonRecursiveWatchPattern =
    '*.{' + watchExtensions.map((ext) => ext.slice(1)).join(',') + '}';
  const recursiveWatchPattern = '**/' + nonRecursiveWatchPattern;

  connection.onInitialize(
    wrap('🚀 ~ file: server.ts:137 ~ connection.onInitialize:', (evt) => {
      //console.log('🚀 ~ file: server.ts:142 ~ connection.onInitialize:', JSON.stringify(evt));
      const workspaceUris = evt.workspaceFolders?.map((folder) =>
        folder.uri.toString(),
      ) ?? [evt.rootUri ?? ''];
      Logger.log('Initialize language server at ', workspaceUris.join(', '));
      if (workspaceUris.length === 0) {
        Logger.error('No workspace path set');
      }

      if (!evt.capabilities.workspace?.didChangeWatchedFiles) {
        const workspacePaths = workspaceUris
          .map(urlToPath)
          .filter(isNotNullOrUndefined);
        watcher = new FallbackWatcher(watchExtensions, workspacePaths);
        watcher.onDidChangeWatchedFiles(onDidChangeWatchedFiles);

        watchDirectory = (patterns) => {
          watcher?.watchDirectory(patterns);
        };
      }

      const isTrusted: boolean = evt.initializationOptions?.isTrusted ?? true;
      configLoader.setDisabled(!isTrusted);
      setIsTrusted(isTrusted);
      configManager.updateIsTrusted(isTrusted);
      if (!isTrusted) {
        Logger.log(
          'Workspace is not trusted, running with reduced capabilities.',
        );
      }

      Logger.setDebug(
        (evt.initializationOptions?.configuration?.svelte ||
          evt.initializationOptions?.config)?.['language-server']?.debug,
      );
      // Backwards-compatible way of setting initialization options (first `||` is the old style)
      configManager.update(
        evt.initializationOptions?.configuration?.svelte?.plugin ||
          evt.initializationOptions?.config ||
          {},
      );
      configManager.updateTsJsUserPreferences(
        evt.initializationOptions?.configuration ||
          evt.initializationOptions?.typescriptConfig ||
          {},
      );
      configManager.updateTsJsFormateConfig(
        evt.initializationOptions?.configuration ||
          evt.initializationOptions?.typescriptConfig ||
          {},
      );
      configManager.updateEmmetConfig(
        evt.initializationOptions?.configuration?.emmet ||
          evt.initializationOptions?.emmetConfig ||
          {},
      );
      configManager.updatePrettierConfig(
        evt.initializationOptions?.configuration?.prettier ||
          evt.initializationOptions?.prettierConfig ||
          {},
      );
      // no old style as these were added later
      configManager.updateCssConfig(
        evt.initializationOptions?.configuration?.css,
      );
      configManager.updateScssConfig(
        evt.initializationOptions?.configuration?.scss,
      );
      configManager.updateLessConfig(
        evt.initializationOptions?.configuration?.less,
      );
      configManager.updateHTMLConfig(
        evt.initializationOptions?.configuration?.html,
      );
      configManager.updateClientCapabilities(evt.capabilities);

      pluginHost.initialize({
        filterIncompleteCompletions:
          !evt.initializationOptions?.dontFilterIncompleteCompletions,
        definitionLinkSupport:
          !!evt.capabilities.textDocument?.definition?.linkSupport,
      });
      // Order of plugin registration matters for FirstNonNull, which affects for example hover info
      pluginHost.register((sveltePlugin = new SveltePlugin(configManager)));
      pluginHost.register(new HTMLPlugin(docManager, configManager));

      const cssLanguageServices = createLanguageServices({
        clientCapabilities: evt.capabilities,
        fileSystemProvider: new FileSystemProvider(),
      });
      const workspaceFolders = evt.workspaceFolders ?? [
        { name: '', uri: evt.rootUri ?? '' },
      ];
      pluginHost.register(
        new CSSPlugin(
          docManager,
          configManager,
          workspaceFolders,
          cssLanguageServices,
        ),
      );
      const normalizedWorkspaceUris = workspaceUris.map(normalizeUri);
      pluginHost.register(
        new TypeScriptPlugin(
          configManager,
          new LSAndTSDocResolver(
            docManager,
            normalizedWorkspaceUris,
            configManager,
            {
              notifyExceedSizeLimit: notifyTsServiceExceedSizeLimit,
              onProjectReloaded: refreshCrossFilesSemanticFeatures,
              watch: true,
              nonRecursiveWatchPattern,
              watchDirectory: (patterns) => watchDirectory(patterns),
              reportConfigError(diagnostic) {
                connection?.sendDiagnostics(diagnostic);
              },
            },
          ),
          normalizedWorkspaceUris,
          docManager,
        ),
      );

      const clientSupportApplyEditCommand =
        !!evt.capabilities.workspace?.applyEdit;
      const clientCodeActionCapabilities =
        evt.capabilities.textDocument?.codeAction;
      const clientSupportedCodeActionKinds =
        clientCodeActionCapabilities?.codeActionLiteralSupport?.codeActionKind
          .valueSet;

      return {
        capabilities: {
          textDocumentSync: {
            openClose: true,
            change: TextDocumentSyncKind.Incremental,
            save: { includeText: false },
          },
          hoverProvider: true,
          completionProvider: {
            resolveProvider: true,
            triggerCharacters: [
              '.',
              '"',
              "'",
              '`',
              '/',
              '@',
              '<',

              // Emmet
              '>',
              '*',
              '#',
              '$',
              '+',
              '^',
              '(',
              '[',
              '@',
              '-',
              // No whitespace because
              // it makes for weird/too many completions
              // of other completion providers

              // Svelte
              ':',
              '|',
            ],
            completionItem: { labelDetailsSupport: true },
          },
          documentFormattingProvider: true,
          colorProvider: true,
          documentSymbolProvider: true,
          definitionProvider: true,
          codeActionProvider:
            clientCodeActionCapabilities?.codeActionLiteralSupport
              ? {
                  codeActionKinds: [
                    CodeActionKind.QuickFix,
                    CodeActionKind.SourceOrganizeImports,
                    SORT_IMPORT_CODE_ACTION_KIND,
                    ...(clientSupportApplyEditCommand
                      ? [CodeActionKind.Refactor]
                      : []),
                  ].filter(
                    clientSupportedCodeActionKinds &&
                      evt.initializationOptions?.shouldFilterCodeActionKind
                      ? (kind) => clientSupportedCodeActionKinds.includes(kind)
                      : () => true,
                  ),
                  resolveProvider: true,
                }
              : true,
          executeCommandProvider: clientSupportApplyEditCommand
            ? {
                commands: [
                  'function_scope_0',
                  'function_scope_1',
                  'function_scope_2',
                  'function_scope_3',
                  'constant_scope_0',
                  'constant_scope_1',
                  'constant_scope_2',
                  'constant_scope_3',
                  'extract_to_svelte_component',
                  'migrate_to_svelte_5',
                  'Infer function return type',
                ],
              }
            : undefined,
          renameProvider: evt.capabilities.textDocument?.rename?.prepareSupport
            ? { prepareProvider: true }
            : true,
          referencesProvider: true,
          selectionRangeProvider: true,
          signatureHelpProvider: {
            triggerCharacters: ['(', ',', '<'],
            retriggerCharacters: [')'],
          },
          semanticTokensProvider: {
            legend: getSemanticTokenLegends(),
            range: true,
            full: true,
          },
          linkedEditingRangeProvider: true,
          implementationProvider: true,
          typeDefinitionProvider: true,
          inlayHintProvider: true,
          callHierarchyProvider: true,
          foldingRangeProvider: true,
          codeLensProvider: { resolveProvider: true },
        },
      };
    }),
  );

  connection.onInitialized(
    wrap('🚀 ~ file: server.ts:385 ~ connection.onInitialized:', () => {
      // prettier-ignore
      //console.log('🚀 ~ file: server.ts:384 ~ connection.onInitialized:');
      if (watcher) {
        return;
      }

      const didChangeWatchedFiles =
        configManager.getClientCapabilities()?.workspace?.didChangeWatchedFiles;

      if (!didChangeWatchedFiles?.dynamicRegistration) {
        return;
      }

      // still watch the roots since some files might be referenced but not included in the project
      connection?.client.register(DidChangeWatchedFilesNotification.type, {
        watchers: [
          {
            // Editors have exclude configs, such as VSCode with `files.watcherExclude`,
            // which means it's safe to watch recursively here
            globPattern: recursiveWatchPattern,
          },
        ],
      });

      if (didChangeWatchedFiles.relativePatternSupport) {
        watchDirectory = (patterns) => {
          connection?.client.register(DidChangeWatchedFilesNotification.type, {
            watchers: patterns.map((pattern) => ({
              globPattern: pattern,
            })),
          });
        };
        if (pendingWatchPatterns.length) {
          watchDirectory(pendingWatchPatterns);
          pendingWatchPatterns = [];
        }
      }
    }),
  );

  function notifyTsServiceExceedSizeLimit() {
    connection?.sendNotification(ShowMessageNotification.type, {
      message:
        'Svelte language server detected a large amount of JS/Svelte files. ' +
        'To enable project-wide JavaScript/TypeScript language features for Svelte files, ' +
        'exclude large folders in the tsconfig.json or jsconfig.json with source files that you do not work on.',
      type: MessageType.Warning,
    });
  }

  connection.onExit(
    wrap('🚀 ~ file: server.ts:434 ~ connection.onExit:', () => {
      //// prettier-ignore
      //console.log('🚀 ~ file: server.ts:436 ~ connection.onExit:');
      watcher?.dispose();
    }),
  );

  connection.onRenameRequest(
    wrap('🚀 ~ file: server.ts:439 ~ connection.onRenameRequest:', (req) => {
      // prettier-ignore
      //console.log('🚀 ~ file: server.ts:444 ~ connection.onRenameRequest:', req);
      return pluginHost.rename(
        req.textDocument,
        req.position,
        req.newName,
      );
    }),
  );
  connection.onPrepareRename(
    wrap('🚀 ~ file: server.ts:443 ~ connection.onPrepareRename:', (req) => {
      // prettier-ignore
      //console.log('🚀 ~ file: server.ts:455 ~ connection.onPrepareRename:', req);
      return pluginHost.prepareRename(
      req.textDocument,
      req.position,
    );
    }),
  );

  connection.onDidChangeConfiguration(
    wrap(
      '🚀 ~ file: server.ts:448 ~ connection.onDidChangeConfiguration ~ settings:',
      ({ settings }) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:468 ~ connection.onDidChangeConfiguration ~ settings:', settings);
        configManager.update(settings.svelte?.plugin);
        configManager.updateTsJsUserPreferences(settings);
        configManager.updateTsJsFormateConfig(settings);
        configManager.updateEmmetConfig(settings.emmet);
        configManager.updatePrettierConfig(settings.prettier);
        configManager.updateCssConfig(settings.css);
        configManager.updateScssConfig(settings.scss);
        configManager.updateLessConfig(settings.less);
        configManager.updateHTMLConfig(settings.html);
        Logger.setDebug(settings.svelte?.['language-server']?.debug);
      },
    ),
  );

  connection.onDidOpenTextDocument(
    wrap(
      '🚀 ~ file: server.ts:465 ~ connection.onDidOpenTextDocument:',
      (evt) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:488 ~ connection.onDidOpenTextDocument:', evt);
        const document = docManager.openClientDocument(evt.textDocument);
        diagnosticsManager.scheduleUpdate(document);
      },
    ),
  );

  connection.onDidCloseTextDocument(
    wrap(
      '🚀 ~ file: server.ts:474 ~ connection.onDidCloseTextDocument:',
      (evt) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:500 ~ connection.onDidCloseTextDocument:', evt);
        return docManager.closeDocument(evt.textDocument.uri);
      },
    ),
  );
  connection.onDidChangeTextDocument(
    wrap(
      '🚀 ~ file: server.ts:481 ~ connection.onDidChangeTextDocument:',
      (evt) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:510 ~ connection.onDidChangeTextDocument:', evt);
        diagnosticsManager.cancelStarted(evt.textDocument.uri);
        docManager.updateDocument(evt.textDocument, evt.contentChanges);
        pluginHost.didUpdateDocument();
      },
    ),
  );
  connection.onHover((evt) => {
    // prettier-ignore
    //console.log('🚀 ~ file: server.ts:519 ~ connection.onHover:', evt);
    return pluginHost.doHover(evt.textDocument, evt.position);
  });
  connection.onCompletion(
    wrap(
      '🚀 ~ file: server.ts:504 ~ connection.onCompletion ~ evt, cancellationToken:',
      (evt, cancellationToken) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:527 ~ connection.onCompletion ~ evt, cancellationToken:', evt, cancellationToken);
        return pluginHost.getCompletions(
      evt.textDocument,
      evt.position,
      evt.context,
      cancellationToken,
    );
      },
    ),
  );
  connection.onDocumentFormatting(
    wrap(
      '🚀 ~ file: server.ts:517 ~ connection.onDocumentFormatting:',
      (evt) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:542 ~ connection.onDocumentFormatting:', evt);
        return pluginHost.formatDocument(
      evt.textDocument,
      evt.options,
    );
      },
    ),
  );
  connection.onRequest(
    TagCloseRequest.type,
    wrap(
      `🚀 ~ file: server.ts:527 ~ connection.onRequest ~ ${TagCloseRequest.type}:`,
      (evt) => {
        // prettier-ignore
        //console.log(`🚀 ~ file: server.ts:556 ~ connection.onRequest ~ ${TagCloseRequest.type}:`, evt);
        return pluginHost.doTagComplete(
          evt.textDocument,
          evt.position,
        );
      },
    ),
  );
  connection.onDocumentColor(
    wrap('🚀 ~ file: server.ts:538 ~ connection.onDocumentColor:', (evt) => {
      // prettier-ignore
      //console.log('🚀 ~ file: server.ts:567 ~ connection.onDocumentColor:', evt);
      return pluginHost.getDocumentColors(evt.textDocument);
    }),
  );
  connection.onColorPresentation(
    wrap(
      '🚀 ~ file: server.ts:545 ~ connection.onColorPresentation:',
      (evt) => {
        //console.log('🚀 ~ file: server.ts:575 ~ connection.onColorPresentation:', evt);
        return pluginHost.getColorPresentations(
          evt.textDocument,
          evt.range,
          evt.color,
        );
      },
    ),
  );
  connection.onDocumentSymbol(
    wrap(
      '🚀 ~ file: server.ts:593 ~ connection.onDocumentSymbol ~ evt, cancellationToken:',
      (evt, cancellationToken) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:589 ~ connection.onDocumentSymbol ~ evt, cancellationToken:', evt, cancellationToken);
        return pluginHost.getDocumentSymbols(
      evt.textDocument,
      cancellationToken,
    );
      },
    ),
  );
  connection.onDefinition(
    wrap('🚀 ~ file: server.ts:567 ~ connection.onDefinition:', (evt) => {
      //console.log('🚀 ~ file: server.ts:599 ~ connection.onDefinition:', evt);
      return pluginHost.getDefinitions(evt.textDocument, evt.position);
    }),
  );
  connection.onReferences(
    wrap(
      '🚀 ~ file: server.ts:577 ~ connection.onReferences ~ evt, cancellationToken:',
      (evt, cancellationToken) => {
        //console.log('🚀 ~ file: server.ts:607 ~ connection.onReferences ~ evt, cancellationToken:', evt, cancellationToken);
        return pluginHost.findReferences(
          evt.textDocument,
          evt.position,
          evt.context,
          cancellationToken,
        );
      },
    ),
  );

  connection.onCodeAction(
    wrap(
      false,
      //'🚀 ~ file: server.ts:591 ~ connection.onCodeAction ~ evt, cancellationToken:',
      (evt, cancellationToken) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:624 ~ connection.onCodeAction ~ evt, cancellationToken:', evt, cancellationToken);
        return pluginHost.getCodeActions(
      evt.textDocument,
      evt.range,
      evt.context,
      cancellationToken,
    );
      },
    ),
  );
  connection.onExecuteCommand(
    wrap(
      '🚀 ~ file: server.ts:604 ~ connection.onExecuteCommand:',
      async (evt) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:639 ~ connection.onExecuteCommand:', evt);
        const result = await pluginHost.executeCommand(
      { uri: evt.arguments?.[0] },
      evt.command,
      evt.arguments,
    );
        if (WorkspaceEdit.is(result)) {
          const edit: ApplyWorkspaceEditParams = { edit: result };
          connection?.sendRequest(ApplyWorkspaceEditRequest.type.method, edit);
        } else if (result) {
          connection?.sendNotification(ShowMessageNotification.type.method, {
            message: result,
            type: MessageType.Error,
          });
        }
      },
    ),
  );
  connection.onCodeActionResolve(
    wrap(
      '🚀 ~ file: server.ts:624 ~ connection.onCodeActionResolve ~ codeAction, cancellationToken:',
      (codeAction, cancellationToken) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:662 ~ connection.onCodeActionResolve ~ codeAction, cancellationToken:', codeAction, cancellationToken);
        const data = codeAction.data as TextDocumentIdentifier;
        return pluginHost.resolveCodeAction(
          data,
          codeAction,
          cancellationToken,
        );
      },
    ),
  );

  connection.onCompletionResolve(
    wrap(
      '🚀 ~ file: server.ts:638 ~ connection.onCompletionResolve ~ completionItem, cancellationToken:',
      (completionItem, cancellationToken) => {
        //console.log('🚀 ~ file: server.ts:677 ~ connection.onCompletionResolve ~ completionItem, cancellationToken:', completionItem, cancellationToken);
        const data = (completionItem as AppCompletionItem)
          .data as TextDocumentIdentifier;

        if (!data) {
          return completionItem;
        }

        return pluginHost.resolveCompletion(
          data,
          completionItem,
          cancellationToken,
        );
      },
    ),
  );

  connection.onSignatureHelp(
    wrap(
      '🚀 ~ file: server.ts:658 ~ connection.onSignatureHelp ~ evt, cancellationToken:',
      (evt, cancellationToken) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:699 ~ connection.onSignatureHelp ~ evt, cancellationToken:', evt, cancellationToken);
        return pluginHost.getSignatureHelp(
      evt.textDocument,
      evt.position,
      evt.context,
      cancellationToken,
    );
      },
    ),
  );

  connection.onSelectionRanges(
    wrap('🚀 ~ file: server.ts:668 ~ connection.onSelectionRanges:', (evt) => {
      // prettier-ignore
      //console.log('🚀 ~ file: server.ts:713 ~ connection.onSelectionRanges:', evt);
      return pluginHost.getSelectionRanges(
      evt.textDocument,
      evt.positions,
    );
    }),
  );

  connection.onImplementation(
    wrap(
      '🚀 ~ file: server.ts:676 ~ connection.onImplementation ~ evt, cancellationToken:',
      (evt, cancellationToken) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:726 ~ connection.onImplementation ~ evt, cancellationToken:', evt, cancellationToken);
        return pluginHost.getImplementation(
      evt.textDocument,
      evt.position,
      cancellationToken,
    );
      },
    ),
  );

  connection.onTypeDefinition(
    wrap('🚀 ~ file: server.ts:696 ~ connection.onTypeDefinition:', (evt) => {
      // prettier-ignore
      //console.log('🚀 ~ file: server.ts:739 ~ connection.onTypeDefinition:', evt);
      return pluginHost.getTypeDefinition(
      evt.textDocument,
      evt.position,
    );
    }),
  );

  connection.onFoldingRanges((evt) => {
    console.log('🚀 ~ file: server.ts:748 ~ connection.onFoldingRanges:', evt);
    const pr = pluginHost.getFoldingRanges(evt.textDocument);
    pr.then((value) => {
      console.log(
        '🚀 ~ file: server.ts:751 ~ connection.onFoldingRanges ~ pr.then ~ value:',
        value.length,
        value,
        '\n',
      );
    });
    return pr;
  });

  connection.onCodeLens(
    wrap(
      //'🚀 ~ file: server.ts:674 ~ connection.onCodeLens:',
      false,
      (evt) => {
        //console.log('🚀 ~ file: server.ts:761 ~ connection.onCodeLens:', evt);
        return pluginHost.getCodeLens(evt.textDocument);
      },
    ),
  );
  connection.onCodeLensResolve(
    wrap(
      '🚀 ~ file: server.ts:719 ~ connection.onCodeLensResolve ~ codeLens, token:',
      (codeLens, token) => {
        //console.log('🚀 ~ file: server.ts:770 ~ connection.onCodeLensResolve ~ codeLens, token:', codeLens, token);
        const data = codeLens.data as TextDocumentIdentifier;

        if (!data) {
          return codeLens;
        }

        return pluginHost.resolveCodeLens(data, codeLens, token);
      },
    ),
  );

  const diagnosticsManager = new DiagnosticsManager(
    connection.sendDiagnostics,
    docManager,
    pluginHost.getDiagnostics.bind(pluginHost),
  );

  const refreshSemanticTokens = debounceThrottle(() => {
    if (
      configManager?.getClientCapabilities()?.workspace?.semanticTokens
        ?.refreshSupport
    ) {
      connection?.sendRequest(SemanticTokensRefreshRequest.method);
    }
  }, 1500);

  const refreshInlayHints = debounceThrottle(() => {
    if (
      configManager?.getClientCapabilities()?.workspace?.inlayHint
        ?.refreshSupport
    ) {
      connection?.sendRequest(InlayHintRefreshRequest.method);
    }
  }, 1500);

  const refreshCrossFilesSemanticFeatures = () => {
    diagnosticsManager.scheduleUpdateAll();
    refreshInlayHints();
    refreshSemanticTokens();
  };

  connection.onDidChangeWatchedFiles(onDidChangeWatchedFiles);
  function onDidChangeWatchedFiles(para: DidChangeWatchedFilesParams) {
    // prettier-ignore
    console.log('🚀 ~ file: server.ts:815 ~ onDidChangeWatchedFiles ~ para:', para);
    const onWatchFileChangesParas = para.changes
      .map((change) => ({
        fileName: urlToPath(change.uri),
        changeType: change.type,
      }))
      .filter((change): change is OnWatchFileChangesPara => !!change.fileName);

    pluginHost.onWatchFileChanges(onWatchFileChangesParas);

    refreshCrossFilesSemanticFeatures();
  }

  connection.onDidSaveTextDocument(
    diagnosticsManager.scheduleUpdateAll.bind(diagnosticsManager),
  );
  connection.onNotification(
    '$/onDidChangeTsOrJsFile',
    wrap(
      '🚀 ~ file: server.ts:785 ~ connection.onNotification ~ $/onDidChangeTsOrJsFile:',
      async (e: any) => {
        //console.log('🚀 ~ file: server.ts:836 ~ connection.onNotification ~ $/onDidChangeTsOrJsFile:', e);
        const path = urlToPath(e.uri);
        if (path) {
          pluginHost.updateTsOrJsFile(path, e.changes);
        }

        refreshCrossFilesSemanticFeatures();
      },
    ),
  );

  connection.onRequest(
    SemanticTokensRequest.type,
    wrap(
      `🚀 ~ file: server.ts:798 ~ connection.onRequest ~ ${SemanticTokensRequest.type} ~ evt, cancellationToken:`,
      (evt, cancellationToken) => {
        //console.log(`🚀 ~ file: server.ts:852 ~ connection.onRequest ~ ${SemanticTokensRequest.type} ~ evt, cancellationToken:`, evt, cancellationToken);
        return pluginHost.getSemanticTokens(
          evt.textDocument,
          undefined,
          cancellationToken,
        );
      },
    ),
  );

  connection.onRequest(
    SemanticTokensRangeRequest.type,
    wrap(
      `🚀 ~ file: server.ts:761 ~ connection.onRequest ~ ${SemanticTokensRangeRequest.type} ~ evt, cancellationToken:`,
      (evt, cancellationToken) => {
        // prettier-ignore
        //console.log(`🚀 ~ file: server.ts:868 ~ connection.onRequest ~ ${SemanticTokensRangeRequest.type} ~ evt, cancellationToken:`, evt, cancellationToken);
        return pluginHost.getSemanticTokens(
          evt.textDocument,
          evt.range,
          cancellationToken,
        );
      },
    ),
  );

  connection.onRequest(
    LinkedEditingRangeRequest.type,
    wrap(
      `🚀 ~ file: server.ts:828 ~ connection.onRequest ~ ${LinkedEditingRangeRequest.type}:`,
      async (evt) => {
        // prettier-ignore
        //console.log(`🚀 ~ file: server.ts:884 ~ connection.onRequest ~ ${LinkedEditingRangeRequest.type}:`, evt);
        return await pluginHost.getLinkedEditingRanges(
      evt.textDocument,
      evt.position,
    );
      },
    ),
  );

  connection.onRequest(
    InlayHintRequest.type,
    wrap(
      false,
      //  `🚀 ~ file: server.ts:782 ~ connection.onRequest ~ ${JSON.stringify(InlayHintRefreshRequest.type)} ~ evt, cancellationToken:`,
      (evt, cancellationToken) => {
        // prettier-ignore
        //console.log(`🚀 ~ file: server.ts:900 ~ connection.onRequest ~ ${JSON.stringify(InlayHintRefreshRequest.type)} ~ evt, cancellationToken:`, evt, cancellationToken);
        return pluginHost.getInlayHints(
      evt.textDocument,
      evt.range,
      cancellationToken,
    );
      },
    ),
  );

  connection.onRequest(
    CallHierarchyPrepareRequest.type,
    wrap(
      `🚀 ~ file: server.ts:792 ~ connection.onRequest ~ ${CallHierarchyPrepareRequest.type} ~ evt, token:`,
      async (evt, token) => {
        //console.log(`🚀 ~ file: server.ts:915 ~ connection.onRequest ~ ${CallHierarchyPrepareRequest.type} ~ evt, token:`, evt, token);
        return await pluginHost.prepareCallHierarchy(
          evt.textDocument,
          evt.position,
          token,
        );
      },
    ),
  );

  connection.onRequest(
    CallHierarchyIncomingCallsRequest.type,
    wrap(
      `🚀 ~ file: server.ts:870 ~ ${CallHierarchyIncomingCallsRequest.type} ~ evt, token:`,
      async (evt, token) => {
        //console.log(`🚀 ~ file: server.ts:930 ~ ${CallHierarchyIncomingCallsRequest.type} ~ evt, token:` , evt, token);
        return await pluginHost.getIncomingCalls(evt.item, token);
      },
    ),
  );

  connection.onRequest(
    CallHierarchyOutgoingCallsRequest.type,
    wrap(
      `🚀 ~ file: server.ts:883 ~ ${CallHierarchyOutgoingCallsRequest.type} ~ evt, token:`,
      async (evt, token) => {
        // prettier-ignore
        //console.log(`🚀 ~ file: server.ts:942 ~ ${CallHierarchyOutgoingCallsRequest.type} ~ evt, token:`, evt, token);
        return await pluginHost.getOutgoingCalls(
          evt.item,
          token,
        );
      },
    ),
  );

  docManager.on(
    'documentChange',
    diagnosticsManager.scheduleUpdate.bind(diagnosticsManager),
  );
  docManager.on(
    'documentClose',
    wrap(
      '🚀 ~ file: server.ts:898 ~ docManager.on ~ document:',
      (document: Document) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:961 ~ docManager.on ~ document:', document);
        return diagnosticsManager.removeDiagnostics(document);
      },
    ),
  );

  // The language server protocol does not have a specific "did rename/move files" event,
  // so we create our own in the extension client and handle it here
  connection.onRequest(
    '$/getEditsForFileRename',
    wrap(
      '🚀 ~ file: server.ts:910 ~ $/getEditsForFileRename ~ fileRename:',
      async (fileRename: RenameFile) => {
        //console.log('🚀 ~ file: server.ts:974 ~ $/getEditsForFileRename ~ fileRename:', fileRename);
        return pluginHost.updateImports(fileRename);
      },
    ),
  );

  connection.onRequest(
    '$/getFileReferences',
    wrap(
      '🚀 ~ file: server.ts:919 ~ connection.onRequest ~ $/getFileReferences ~ uri:',
      async (uri: string) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:986 ~ connection.onRequest ~ $/getFileReferences ~ uri:', uri);
        return pluginHost.fileReferences(uri);
      },
    ),
  );

  connection.onRequest(
    '$/getComponentReferences',
    wrap(
      '🚀 ~ file: server.ts:927 ~ connection.onRequest ~ $/getComponentReferences ~ uri:',
      async (uri: string) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:998 ~ connection.onRequest ~ $/getComponentReferences ~ uri:', uri);
        return pluginHost.findComponentReferences(uri);
      },
    ),
  );

  connection.onRequest(
    '$/getCompiledCode',
    wrap(
      '🚀 ~ file: server.ts:935 ~ connection.onRequest ~ $/getCompiledCode ~ uri:',
      async (uri: DocumentUri) => {
        // prettier-ignore
        //console.log('🚀 ~ file: server.ts:1010 ~ connection.onRequest ~ $/getCompiledCode ~ uri:', uri);
        const doc = docManager.get(uri);
        if (!doc) {
          return null;
        }

        const compiled = await sveltePlugin.getCompiledResult(doc);
        if (compiled) {
          const js = compiled.js;
          const css = compiled.css;
          return { js, css };
        } else {
          return null;
        }
      },
    ),
  );

  connection.listen();
}

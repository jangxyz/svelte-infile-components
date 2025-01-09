import {
  CodeAction,
  CodeActionContext,
  CodeActionKind,
  Range,
  WorkspaceEdit,
} from 'vscode-languageserver';
import { SvelteDocument } from '../../SvelteDocument';
import {
  getQuickfixActions,
  isIgnorableSvelteDiagnostic,
} from './getQuickfixes';
import { executeRefactoringCommand } from './getRefactorings';
import { insertCodeActions } from './infileRefactorings';

export async function getCodeActions(
  svelteDoc: SvelteDocument,
  range: Range,
  context: CodeActionContext,
): Promise<CodeAction[]> {
  const svelteDiagnostics = context.diagnostics.filter(
    isIgnorableSvelteDiagnostic,
  );
  if (
    svelteDiagnostics.length &&
    (!context.only || context.only.includes(CodeActionKind.QuickFix))
  ) {
    return await getQuickfixActions(svelteDoc, svelteDiagnostics);
  }

  //
  return [...insertCodeActions(svelteDoc, range, context)];
}

export async function executeCommand(
  svelteDoc: SvelteDocument,
  command: string,
  args?: any[],
): Promise<WorkspaceEdit | string | null> {
  return await executeRefactoringCommand(svelteDoc, command, args);
}

import * as vscode from 'vscode';
import {QueryFix} from './auto_fixer_result';

export class AutoFixerActionProvider implements vscode.CodeActionProvider {
  private fixes?: QueryFix[];
  private uri?: vscode.Uri;
  private range?: vscode.Range;

  constructor(
    private readonly diagnosticCollection: vscode.DiagnosticCollection
  ) {}

  setFixes(fixes: QueryFix[], openEditor: vscode.TextEditor) {
    const diagnostics: vscode.Diagnostic[] = [];
    fixes.forEach(fix => {
      if (!fix.error || !fix.errorPosition) {
        return;
      }
      let msg = fix.error!;
      if (fix.approach) {
        msg += ' ' + fix.approach!;
      }

      const range = openEditor.document.getWordRangeAtPosition(
        new vscode.Position(
          fix.errorPosition.row - 1,
          fix.errorPosition.column - 1
        )
      )!;

      diagnostics.push(
        new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error)
      );
    });

    this.diagnosticCollection.set(openEditor.document.uri, diagnostics);

    this.fixes = fixes;
    this.uri = openEditor.document.uri;
    this.range = openEditor.document.validateRange(
      new vscode.Range(0, 0, openEditor.document.lineCount, 0)
    );
  }

  clear() {
    this.fixes = undefined;
    this.uri = undefined;
    this.range = undefined;
    this.diagnosticCollection.clear();
  }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
    if (!this.fixes || document.uri !== this.uri) {
      return [];
    }

    return this.fixes
      .filter(fix => {
        return (
          fix.options &&
          fix.errorPosition &&
          range.contains(
            new vscode.Position(
              fix.errorPosition.row - 1,
              fix.errorPosition.column - 1
            )
          )
        );
      })
      .map(fix => {
        return fix.options!.map(option => {
          const workspaceEdit = new vscode.WorkspaceEdit();
          workspaceEdit.replace(this.uri!, this.range!, option.fixedQuery);
          const action = new vscode.CodeAction(
            `${option.description}. Replace query with ${option.fixedQuery}`,
            vscode.CodeActionKind.QuickFix
          );
          action.diagnostics = this.diagnosticCollection
            .get(this.uri!)!
            .slice();
          action.edit = workspaceEdit;
          return action;
        });
      })
      .reduce((acc, val) => acc.concat(val));
  }
}

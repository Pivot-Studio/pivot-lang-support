
import { TextDecoder, TextEncoder } from 'util';
import * as vscode from 'vscode';
import * as ctrl from "./nbcontroller";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer('pl-notebook', new SampleSerializer())
  );
  ctrl.activate(context);
}

// interface RawNotebook {
//   cells: RawNotebookCell[];
// }

interface RawNotebookCell {
  source: string[];
  cell_type: 'code' | 'markdown';
}

class SampleSerializer implements vscode.NotebookSerializer {
  async deserializeNotebook(
    content: Uint8Array,
    _token: vscode.CancellationToken
  ): Promise<vscode.NotebookData> {
    var contents = new TextDecoder().decode(content);

    let raw: RawNotebookCell[];
    try {
      raw = (<RawNotebookCell[]>JSON.parse(contents));
    } catch {
      raw = [];
    }

    const cells = raw.map(
      item =>
        new vscode.NotebookCellData(
          item.cell_type === 'code'
            ? vscode.NotebookCellKind.Code
            : vscode.NotebookCellKind.Markup,
          item.source.join('\n'),
          item.cell_type === 'code' ? 'plang' : 'markdown'
        )
    );

    return new vscode.NotebookData(cells);
  }

  async serializeNotebook(
    data: vscode.NotebookData,
    _token: vscode.CancellationToken
  ): Promise<Uint8Array> {
    let contents: RawNotebookCell[] = [];

    for (const cell of data.cells) {
      contents.push({
        cell_type: cell.kind === vscode.NotebookCellKind.Code ? 'code' : 'markdown',
        source: cell.value.split(/\r?\n/g),
      });
    }

    return new TextEncoder().encode(JSON.stringify(contents));
  }
}



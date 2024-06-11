import * as vscode from 'vscode';
import * as cp from "child_process";
import { Writable, Readable } from 'stream';
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(new Controller());
}

class Controller {
    readonly controllerId = 'pl-notebook-controller-id';
    readonly notebookType = 'pl-notebook';
    readonly label = 'Pivot Lang Notebook';
    readonly supportedLanguages = ['plang'];

    private readonly _controller: vscode.NotebookController;
    private _executionOrder = 0;
    private _plc: cp.ChildProcessByStdio<Writable, Readable, Readable>;
    private _execQueueStdOut: { cell: vscode.NotebookCell, exec: vscode.NotebookCellExecution, resolveStdout: ()=>void, output?: vscode.NotebookCellOutput }[] = [];
    private _execQueueStdErr: { hasErr: boolean,cell: vscode.NotebookCell, exec: vscode.NotebookCellExecution, resolveStderr: (succ:boolean)=>void, output?: vscode.NotebookCellOutput }[] = [];


    constructor() {
        this._controller = vscode.notebooks.createNotebookController(
            this.controllerId,
            this.notebookType,
            this.label
        );

        this._controller.supportedLanguages = this.supportedLanguages;
        this._controller.supportsExecutionOrder = true;
        this._controller.executeHandler = this._execute.bind(this);
        this._plc = cp.spawn("plc", ['repl', '--headless'], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        this._plc.stdout.setEncoding('utf8');
        this._plc.stderr.setEncoding('utf8');
        this._plc.stdout.on('data', async (data) => {
            let exec = this._execQueueStdOut[0].exec;
            let cell = this._execQueueStdOut[0].cell;
            let resolve = this._execQueueStdOut[0].resolveStdout;
            let execItem = this._execQueueStdErr[0];
            let lines = [];
            // iter lines
            for (let line of data.toString().split('\n')) {
                if (line.toString().startsWith("@@@done@@@")) {
                    resolve();
                    this._execQueueStdOut.shift();
                } else {
                    lines.push(line.toString());
                }
            }
            let out = lines.join('\n');
            if (execItem.output) {
                await exec.appendOutputItems(vscode.NotebookCellOutputItem.stdout(out), execItem.output);
                return;
            }
            let output = new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.stdout(out)]);
            execItem.output = output;
            execItem.output = output;
            await exec.appendOutput(output,cell);


        });
        this._plc.stderr.on('data', async (data) => {
            let exec = this._execQueueStdErr[0].exec;
            let cell = this._execQueueStdErr[0].cell;
            let resolve = this._execQueueStdErr[0].resolveStderr;
            let execItem = this._execQueueStdErr[0];
            let lines = [];
            // iter lines
            for (let line of data.toString().split('\n')) {
                if (line.toString().startsWith("@@@done@@@")) {
                    resolve(this._execQueueStdErr[0].hasErr);
                    this._execQueueStdErr.shift();
                } else if (line.toString().startsWith("@@@error@@@")) {
                    this._execQueueStdErr[0].hasErr = true;
                } else {
                    lines.push(line.toString());
                }
            }
            let out = lines.join('\n');
            if (execItem.output) {
                await exec.appendOutputItems(vscode.NotebookCellOutputItem.stderr(out), execItem.output);
                return;
            }
            let output = new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.stderr(out)]);
            execItem.output = output;
            execItem.output = output;
            await exec.appendOutput(output,cell);
        });

    }

    private _execute(
        cells: vscode.NotebookCell[],
        _notebook: vscode.NotebookDocument,
        _controller: vscode.NotebookController
    ): void {
        for (let cell of cells) {
            this._doExecution(cell);
        }
    }

    private async _doExecution(cell: vscode.NotebookCell): Promise<void> {

        const execution = this._controller.createNotebookCellExecution(cell);
        execution.executionOrder = ++this._executionOrder;
        execution.start(Date.now()); // Keep track of elapsed time to execute cell.
        await execution.clearOutput(cell);

        let code = cell.document.getText().trim();
        let bracket_level = 0;
        let hasErr = false;

        for (let line of code.split('\n')) {
            let execItemStdOut = {
                cell: cell,
                exec: execution,
                resolveStdout: ()=>{},
            };
            let execItemStdErr = {
                hasErr: false,
                cell: cell,
                exec: execution,
                resolveStderr: (succ:boolean)=>{}
            };
            let stdOutPromise = new Promise((resolve) => {
                execItemStdOut.resolveStdout = ()=>{
                    resolve(0);
                };
            });
            let stdErrPromise = new Promise<boolean>((resolve) => {
                execItemStdErr.resolveStderr = resolve;
            });
            this._execQueueStdOut.push(execItemStdOut);
            this._execQueueStdErr.push(execItemStdErr);

            this._plc.stdin.write(line + '\n');
            for (let c of line) {
                if (c === '{') {
                    bracket_level++;
                } else if (c === '}') {
                    bracket_level--;
                }
            }
            if (bracket_level > 0) {
                continue;
            }
            this._plc.stdin.write('@@@done@@@\n');
            // this._plc.stdin.end();
            hasErr = await stdErrPromise;
            await stdOutPromise;    
            


        }

        execution.end(!hasErr, Date.now());
    }

    dispose() {
        this._plc.kill();
    }
}
import { systemDefaultPlatform } from '@vscode/test-electron/out/util';
import * as path from 'path';
import { openStdin } from 'process';
import { workspace, ExtensionContext, WorkspaceFolder, DebugConfiguration, CancellationToken, ProviderResult } from 'vscode';
import * as os from 'os';
import * as vscode from "vscode";

const myExtDir = vscode.extensions.getExtension("pivot-langauthors.pivot-lang-support").extensionPath;

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;
let di: Promise<void>;
let type = "plProvider";
let p = "";
let level = vscode.workspace.getConfiguration("pivot-lang").get("logLevel") as number;

export function activate(context: ExtensionContext) {
	// register a configuration provider for 'mock' debug type
	const provider = new PLConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('pivot', provider));
	vscode.tasks.registerTaskProvider(type, {
		provideTasks(token?: vscode.CancellationToken) {
			let fspath = p;
			if (!p) {
				fspath = vscode.window.activeTextEditor.document.uri.fsPath;
			} else {
				p = "";
			}
			var execution = new vscode.ShellExecution("plc --debug " + fspath);
			var problemMatchers = ["$myProblemMatcher"];
			return [
				new vscode.Task({ type: type }, vscode.TaskScope.Workspace,
					"pl Build", "pivot-lang", execution, problemMatchers)
			];
		},
		resolveTask(task: vscode.Task, token?: vscode.CancellationToken) {
			return task;
		}
	});
	// Find exe according to platform
	var dir = __dirname;
	dir = path.join(dir, os.platform());
	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { command: "plc", args: ["-v", level.toString(), "lsp"] },
		debug: {
			command: "plc", args: ["-v", level.toString(), "lsp"]
		},
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'pivot-lang' }, { scheme: 'file', language: 'toml' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/{*.pi,Kagari.toml}')
		},
		outputChannelName: "pivot-lang language server",
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'pivot-langlanguageServer',
		'pivot-lang Language Server',
		serverOptions,
		clientOptions
	);
	vscode.commands.registerCommand("pivot-lang.restart_lsp", () => {
		let level = vscode.workspace.getConfiguration("pivot-lang").get("logLevel") as number;
		(serverOptions as any).run.args = ["-v", level.toString(), "lsp"];
		(serverOptions as any).debug.args = ["-v", level.toString(), "lsp"];
		client.restart();
	})

	vscode.commands.registerCommand("pivot-lang.debug_current", () => {
		vscode.debug.startDebugging(vscode.workspace.workspaceFolders?.[0], {
			type: "pivot",
			name: "pivot-lang Debug",
			request: "launch",
			program: vscode.window.activeTextEditor.document.uri.fsPath,
		});
	});

	vscode.commands.registerCommand("pivot-lang.run_current", () => {
		let fspath = vscode.window.activeTextEditor.document.uri.fsPath;
		var execution = new vscode.ShellExecution("plc --debug" + fspath + " -o out && ./out");
		vscode.tasks.executeTask(new vscode.Task({ type: "plrun" }, vscode.TaskScope.Workspace, "build", "pivot-lang", execution)).then((value) => {

		});
	});

	vscode.workspace.onDidChangeConfiguration((e) => {
		e.affectsConfiguration("pivot-lang.logLevel") && vscode.commands.executeCommand("pivot-lang.restart_lsp");
	})

	// Start the client. This will also launch the server
	di = client.start();
	// 自动在///文档换行时插入新的///
	vscode.workspace.onDidChangeTextDocument(ev => {
		if (ev.document.languageId !== "pivot-lang") {
			return;
		}
		if (ev.contentChanges.length === 1 && ev.contentChanges[0].text === '\n'
			&& ev.document.lineAt(ev.contentChanges[0].range.start.line).text.startsWith("///")) {
			if (vscode.window.activeTextEditor?.document?.uri == ev.document.uri) {
				vscode.window.activeTextEditor?.edit(eb => {
					let pos = ev.contentChanges[0].range.start;
					pos = new vscode.Position(pos.line + 1, 0);
					eb.insert(pos, "/// ");
				}).then(() => {
					vscode.window.activeTextEditor.selection = new vscode.Selection(
						new vscode.Position(ev.contentChanges[0].range.start.line + 1, 4),
						new vscode.Position(ev.contentChanges[0].range.start.line + 1, 4)
					);
				});
			}
		}
	});
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

class PLConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
		let debugEngine = vscode.extensions.getExtension("vadimcn.vscode-lldb");

		if (!debugEngine) {
			vscode.window.showErrorMessage(
				`Please install [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb)` +
				` extension for debugging.`
			);
			return;
		}
		config.preLaunchTask = {
			"task": "pl Build",
			"type": type
		};
		if (!config.request) {
			config.request = "launch";
			config.name = "pl default Debug";
		}
		if (config.program) {
			p = config.program;
		}
		config.program = "${workspaceFolder}/out";



		config.type = 'lldb';
		let initCommands = [
			"type format add --format d char",
			"type format add --format d 'unsigned char'",
			`command script import "${myExtDir}/pl.py"`
		]
		config.initCommands = initCommands.concat(config.initCommands ?? []);

		return config;
	}
}

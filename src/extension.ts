/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { systemDefaultPlatform } from '@vscode/test-electron/out/util';
import * as path from 'path';
import { openStdin } from 'process';
import { workspace, ExtensionContext } from 'vscode';
import * as os from 'os';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {

	// Find exe according to platform
	var dir = __dirname;
	dir = path.join(dir, os.platform());
	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { command: "plc", args: ["lsp"] },
		debug: {
			command: "plc", args: ["lsp"]
		},
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'pivot-lang' },{ scheme: 'file', language: 'toml' }],
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

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
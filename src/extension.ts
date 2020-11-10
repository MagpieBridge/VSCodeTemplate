'use strict';
import * as net from 'net';
import { XMLHttpRequest } from 'xmlhttprequest-ts';
import { workspace, ExtensionContext, window, ViewColumn, env, Uri} from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, StreamInfo, DynamicFeature, ClientCapabilities, DocumentSelector, InitializeParams, RegistrationData, RPCMessageType, ServerCapabilities, VersionedTextDocumentIdentifier } from 'vscode-languageclient';

var client: LanguageClient = null;

async function configureAndStartClient(context: ExtensionContext) {
        // Startup options for the language server
        const settings = workspace.getConfiguration("Tutorial");
        const lspTransport: string = settings.get("lspTransport");  
        let script = 'java';
		let arg1 = context.asAbsolutePath("MyServer.jar");
		let arg2 = context.asAbsolutePath('preparedResults.json');
        let args = ['-jar', arg1, arg2];
    
        const serverOptionsStdio = {
            run: { command: script, args: args },
            debug: { command: script, args: args }
        }
    
        const serverOptionsSocket = () => {
            const socket = net.connect({ port: 5007 })
            const result: StreamInfo = {
                writer: socket,
                reader: socket
            }
            return new Promise<StreamInfo>((resolve) => {
                socket.on("connect", () => resolve(result))
                socket.on("error", _ => {
    
                    window.showErrorMessage(
                        "Failed to connect to language server. Make sure that the language server is running " +
                        "-or- configure the extension to connect via standard IO.")
                    client = null;
                });
            })
        }
    
    const serverOptions: ServerOptions =
		(lspTransport === "stdio") ? serverOptionsStdio : (lspTransport === "socket") ? serverOptionsSocket : null

	let clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'java' }],
		synchronize: {
			configurationSection: 'java',
			fileEvents: [workspace.createFileSystemWatcher('**/*.java')]
		}
	};

    
   	// Create the language client and start the client.
	client = new LanguageClient('Tutorial', 'Tutorial', serverOptions, clientOptions);
	//register showHTML feature 
	client.registerFeature(new SupportsShowHTML(client));
	client.start();
	await client.onReady();
}

export class SupportsShowHTML implements DynamicFeature<undefined> {
	
	constructor(private _client: LanguageClient) {

    }

	messages: RPCMessageType | RPCMessageType[];
	fillInitializeParams?: (params: InitializeParams) => void;
	fillClientCapabilities(capabilities: ClientCapabilities): void {
		capabilities.experimental = {
			supportsShowHTML: true, 
		}
	}

	initialize(capabilities: ServerCapabilities<any>, documentSelector: DocumentSelector): void {
		let client = this._client;
        client.onNotification("magpiebridge/showHTML",(content: string)=>{
			 const panel = window.createWebviewPanel("Configuration", "MagpieBridge Control Panel",ViewColumn.One,{
				 enableScripts: true 
			 });
			 panel.webview.html = content;
			 panel.webview.onDidReceiveMessage(
				message => {
					switch(message.command){
						case 'action':
							 var httpRequest = new XMLHttpRequest();
							 var url = message.text;
							 httpRequest.open('GET',url);
							 httpRequest.send();
							 return ;
						case 'configuration':
							 var httpRequest = new XMLHttpRequest();
							 var splits = message.text.split("?");
							 var url = splits[0];
							 var formData = splits[1];
							 httpRequest.open('POST',url);
							 httpRequest.send(formData);
							 return ;
							
					}
				}
			 );
			})
	}

	register(message: RPCMessageType, data: RegistrationData<undefined>): void {

	}
	unregister(id: string): void {

	}
	dispose(): void {
		
	}

}

export async function activate(context: ExtensionContext) {
	configureAndStartClient(context);
	workspace.onDidChangeConfiguration(e => {
		if (client)
			client.stop().then(() => configureAndStartClient(context));
		else
			configureAndStartClient(context)
	})
}
import { commands, ExtensionContext, window } from "vscode";
import { ExecuteCommandRequest } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";

export function addExtracInfileComponentCommand(
    getLS: () => LanguageClient,
    context: ExtensionContext,
) {
    context.subscriptions.push(
        commands.registerTextEditorCommand(
            "svelte.extractInfileComponent",
            async (editor) => {
                if (editor?.document?.languageId !== "svelte") {
                    return;
                }

                console.log("🚀 ~ file: extension.ts:542 ~ editor:", editor);

                // Prompt for new component name
                const inputBoxOptions = {
                    prompt: "Infile Component Name: ",
                    placeHolder: "NewComponent",
                };
                const filePath = await window.showInputBox(inputBoxOptions);
                if (!filePath) {
                    return window.showErrorMessage("No component name");
                }

                const uri = editor.document.uri.toString();
                const range = editor.selection;
                getLS().sendRequest(ExecuteCommandRequest.type, {
                    command: "extract_to_svelte_infile_component",
                    arguments: [uri, { uri, range, filePath }],
                });
            },
        ),
    );
}

export function addMoveInfileComponentToNewFileCommand(
    getLS: () => LanguageClient,
    context: ExtensionContext,
) {
    context.subscriptions.push(
        commands.registerTextEditorCommand(
            "svelte-infile.moveInfileComponentToNewFile",
            async (editor) => {
                if (editor?.document?.languageId !== "svelte") {
                    return;
                }

                const uri = editor.document.uri.toString();
                const range = editor.selection;
                getLS().sendRequest(ExecuteCommandRequest.type, {
                    command: "move_infile_component_to_new_file",
                    arguments: [uri, { uri, range }],
                });
            },
        ),
    );
}

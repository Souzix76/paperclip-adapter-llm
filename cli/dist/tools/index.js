import { readFile, readFileSchema, writeFile, writeFileSchema, editFile, editFileSchema, listFiles, listFilesSchema } from './file.js';
import { runCommand, runCommandSchema } from './command.js';
export const tools = {
    read_file: {
        description: 'Read the contents of a file',
        parameters: readFileSchema,
        execute: readFile,
    },
    write_file: {
        description: 'Write or overwrite a file',
        parameters: writeFileSchema,
        execute: writeFile,
    },
    edit_file: {
        description: 'Make targeted edits to a file using search/replace',
        parameters: editFileSchema,
        execute: editFile,
    },
    list_files: {
        description: 'List files in a directory',
        parameters: listFilesSchema,
        execute: listFiles,
    },
    run_command: {
        description: 'Execute a shell command',
        parameters: runCommandSchema,
        execute: runCommand,
    },
};
export async function executeTool(name, args) {
    const tool = tools[name];
    if (!tool) {
        return { content: `Unknown tool: ${name}`, isError: true };
    }
    return tool.execute(args);
}

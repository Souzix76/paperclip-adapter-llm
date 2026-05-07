export function emitEvent(event) {
    process.stdout.write(JSON.stringify(event) + '\n');
}

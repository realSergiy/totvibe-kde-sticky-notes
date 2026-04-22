// SPDX-License-Identifier: GPL-3.0-or-later
import { cac } from 'cac';
import pkg from '../../package.json' with { type: 'json' };
import {
  EXIT_INTERNAL_ERROR,
  EXIT_OK,
  EXIT_USER_ERROR,
  type IO,
  runCreate,
  runDelete,
  runEdit,
  runList,
} from './commands.ts';

type StdinReader = () => Promise<string>;

const defaultIO: IO = {
  stdout: (s: string) => process.stdout.write(s),
  stderr: (s: string) => process.stderr.write(s),
};

const readStdinFromProcess = async () => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const textOrStdin = async (text: string | undefined, readStdin: StdinReader) =>
  text === undefined ? await readStdin() : text;

export const run = async (
  argv: readonly string[],
  io: IO = defaultIO,
  readStdin: StdinReader = readStdinFromProcess,
) => {
  const cli = cac('sticky');
  let pending: Promise<number> | number = EXIT_OK;

  cli
    .command('create [text]', 'Create a new note. Reads stdin if [text] is omitted.')
    .action((text: string | undefined) => {
      pending = (async () => runCreate(io, await textOrStdin(text, readStdin)))();
    });

  cli
    .command('list', 'List all notes, newest first.')
    .option('--json', 'Emit machine-readable JSON.')
    .action((opts: { json?: boolean }) => {
      pending = runList(io, opts.json ?? false);
    });

  cli.command('delete <id>', 'Delete the note with the given id.').action((id: string) => {
    pending = runDelete(io, id);
  });

  cli
    .command('edit <id> [text]', 'Replace contents of <id>. Reads stdin if [text] is omitted.')
    .action((id: string, text: string | undefined) => {
      pending = (async () => runEdit(io, id, await textOrStdin(text, readStdin)))();
    });

  cli.help();
  cli.version(pkg.version, '-V, --version');

  try {
    cli.parse(['bun', 'sticky', ...argv], { run: false });
    const opts = cli.options as { help?: boolean; version?: boolean };
    if (opts.help || opts.version) {
      return EXIT_OK;
    }
    if (cli.matchedCommand === undefined) {
      cli.outputHelp();
      return EXIT_USER_ERROR;
    }
    await cli.runMatchedCommand();
    return await pending;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && err.name === 'CACError') {
      io.stderr(`sticky: ${message}\n`);
      return EXIT_USER_ERROR;
    }
    io.stderr(`sticky: ${message}\n`);
    return EXIT_INTERNAL_ERROR;
  }
};

if (import.meta.main) {
  const code = await run(process.argv.slice(2));
  process.exit(code);
}

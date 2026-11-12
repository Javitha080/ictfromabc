import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const suite = fs.readFileSync(path.join(here, '..', 'userscript', 'ict-suite.user.js'), 'utf8');
const body = fs.readFileSync(path.join(here, 'real-login-rewrite.body.js'), 'utf8');

const head = 'async (page) => {\n  const SUITE = ' + JSON.stringify(suite) + ';\n';
const code = head + body + '\n}';
const outFile = path.join(here, 'real-login-rewrite.generated.mjs');
fs.writeFileSync(outFile, code);
console.log('wrote ' + outFile + ' (' + code.length + ' bytes)');
console.log('run it with the Playwright MCP browser_run_code_unsafe filename argument');

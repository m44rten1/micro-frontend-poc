import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_URL = process.env.REGISTRY_URL ?? 'http://localhost:3005';
const PACKAGE_NAME = 'header';

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
const version: string = pkg.version;

const clientPath = path.join(__dirname, 'dist/client.js');
const serverPath = path.join(__dirname, 'dist/server.cjs');

const form = new FormData();
form.append('client', new Blob([fs.readFileSync(clientPath)]), 'client.js');
form.append('server', new Blob([fs.readFileSync(serverPath)]), 'server.cjs');

const res = await fetch(`${REGISTRY_URL}/publish/${PACKAGE_NAME}/${version}`, {
  method: 'POST',
  body: form,
});

if (!res.ok) {
  console.error(`[mfe-header] Publish failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const result = await res.json();
console.log(`[mfe-header] Published ${PACKAGE_NAME}@${version}`, result);

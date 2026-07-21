#!/usr/bin/env node
// 배포마다 실행: package.json의 버전을 YY-MM-DD-N 형식(예: 26-07-20-1)으로 올리고,
// index.html의 정적 자산 캐시버스터(?v=)를 새 버전으로 통일하며, public/version.json을 갱신한다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkgPath = path.join(ROOT, 'package.json');
const indexPath = path.join(ROOT, 'public', 'index.html');
const versionJsonPath = path.join(ROOT, 'public', 'version.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const now = new Date();
const yy = String(now.getFullYear()).slice(2);
const mm = String(now.getMonth() + 1).padStart(2, '0');
const dd = String(now.getDate()).padStart(2, '0');
const datePrefix = `${yy}-${mm}-${dd}`;

const match = String(pkg.version || '').match(/^(\d{2}-\d{2}-\d{2})-(\d+)$/);
const seq = (match && match[1] === datePrefix) ? Number(match[2]) + 1 : 1;
const newVersion = `${datePrefix}-${seq}`;

const prevVersion = pkg.version;
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/(\.(?:css|js))\?v=[^"']+/g, `$1?v=${newVersion}`);
fs.writeFileSync(indexPath, html);

const builtAt = new Date().toISOString();
fs.writeFileSync(versionJsonPath, JSON.stringify({ version: newVersion, builtAt }, null, 2) + '\n');

console.log(`버전 ${prevVersion} → ${newVersion} (${builtAt})`);

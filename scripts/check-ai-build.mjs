import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const outputDirectories = ['.next/static'];
const keyMarker = ['AI', 'za'].join('');
const providerHost = ['generativelanguage', 'googleapis', 'com'].join('.');

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    return statSync(file).isDirectory() ? listFiles(file) : [file];
  });
}

const files = outputDirectories.flatMap(listFiles);
const violations = files.filter((file) => {
  const contents = readFileSync(file);
  return contents.includes(keyMarker) || contents.includes(providerHost);
});

if (violations.length) {
  console.error(`AI provider material found in client build output: ${violations.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('AI client bundle check passed.');
}

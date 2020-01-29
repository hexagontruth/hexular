#!/usr/bin/env node

const fs = require('fs');
const pth = require('path');
const process = require('process');
const chokidar = require('chokidar');
const yaml = require('yaml');

const [readFile, writeFile, copyFile] = promisify(fs.readFile, fs.writeFile, fs.copyFile);

let config = yaml.parse(fs.readFileSync(join('./config/config.yml'), 'utf8'));

let watchers = [];

// --- Main ---

if (require.main === module) {
  let env = process.env.env || 'prod';
  buildAll(env);
}

// --- Export ---

module.exports = {buildAll, build, watch};

// --- Stuff ---

async function buildAll(env='dev') {
  let targets = {};
  let tasks = [];
  eachConfig(env, (filename, paths) => {
    tasks.push(build(filename, paths));
  });
  await Promise.all(tasks);
}

async function build(filename, paths) {
  let content = Array(paths.length);
  let tasks = paths.map(async (path, idx) => {
    let fileContent = await readFile(join(path), 'utf8');
    content[idx] = fileContent;
  });
  await Promise.all(tasks);
  await writeFile(join('public', filename), content.join('\n'));
  console.log(`Wrote ${filename} at ${new Date().toISOString()}`);
}

function watch(env='dev') {
  eachConfig(env, (filename, paths) => {
    let watcher = chokidar.watch(paths);
    watcher.on('change', () => {
      build(filename, paths);
    });
    watchers.push(watcher);
  });
}

// --- Utility functions ---

function eachConfig(env, fn) {
  Object.entries(config[env]).forEach((args) => fn(...args));
}

function join(...args) {
  return pth.join(__dirname, '..', ...args);
};

function promisify(...fnArgs) {
  let result = fnArgs.map((fn) => (...args) => {
    return new Promise((resolve, reject) => {
      args = args.concat((err, data) => {
        if (err)
          reject(err);
        else
          resolve(data);
      });
      fn(...args);
    });
  });
  return result.length == 1 ? result[0] : result;
};

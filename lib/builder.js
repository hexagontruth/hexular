const child_process = require('child_process');
const process = require('process');
const chokidar = require('chokidar');
const util = require('./util');

const BUILD_PATH = 'public/build';

const exec = util.promisify(child_process.exec);

// --- Main ---

if (require.main === module) {
  let env = process.env.env || 'prod';
  buildAll(env);
}

class Builder {
  constructor(config) {
    this.config = config;
    this.watchers = [];
  }

  async buildAll() {
    let targets = {};
    let tasks = [];
    await exec(`mkdir -p "${util.join(BUILD_PATH)}"`); // No, I don't care about Windows
    this._eachFile((filename, paths, ...args) => {
      tasks.push(this.build(filename, paths));
    });
    await Promise.all(tasks);
  }

  async build(filename, paths) {
    let content = Array(paths.length);
    let tasks = paths.map(async (path, idx) => {
      let fileContent = await util.readFile(util.join(path), 'utf8');
      content[idx] = fileContent;
    });
    await Promise.all(tasks);
    await util.writeFile(util.join(BUILD_PATH, filename), content.join('\n'));
    console.log(`Wrote ${filename} at ${new Date().toISOString()}`);
  }

   watch() {
    this._eachFile((filename, paths) => {
      let watcher = chokidar.watch(paths);
      watcher.on('change', () => {
        setTimeout(() => {
          this.build(filename, paths);
        }, 100);
      });
      this.watchers.push(watcher);
    });
  }

  _eachFile(fn) {
    Object.entries(this.config.files).forEach((args) => fn(...args));
  }
}

module.exports = Builder;
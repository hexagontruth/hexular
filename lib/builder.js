const child_process = require('child_process');
const process = require('process');
const chokidar = require('chokidar');
const glob = require('glob');
const util = require('./util');

const BUILD_PATH = 'public/build';

const exec = util.promisify(child_process.exec);
const getFiles = util.promisify(glob);

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
    let tasks = [];
    tasks = paths.map(async (path, idx) => {
      let filenames = await getFiles(path);
      let pathContent = Array(filenames.length);
      let pathTasks = filenames.map(async (filename, idx) => {
        let fileContent = await util.readFile(util.join(filename), 'utf8');
        pathContent[idx] = fileContent;
      });
      await Promise.all(pathTasks);
      content[idx] = pathContent.join('\n');
    });
    await Promise.all(tasks);
    content = content.join('\n');
    await util.writeFile(util.join(BUILD_PATH, filename), content);
    console.log(`Wrote ${filename} at ${new Date().toISOString()}`);
  }

   watch() {
    this._eachFile((filename, paths) => {
      for (let path of paths) {
        let watcher = chokidar.watch(path);
        watcher.on('change', () => {
          setTimeout(() => {
            this.build(filename, paths);
          }, 100);
        });
        this.watchers.push(watcher);
      }
    });
  }

  _eachFile(fn) {
    Object.entries(this.config.files).forEach((args) => fn(...args));
  }
}

module.exports = Builder;

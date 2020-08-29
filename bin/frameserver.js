#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const pth = require('path');
const {spawn, execSync} = require('child_process');

const util = require('../lib/util');

const config = util.config('dev', process.env, 'frameserver');
let formatMap = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
}
let stream;
let child;
let idx = config.imageStartIndex;
let idxChars = config.imageFilename.match(/\#+/)[0].length;

if (require.main === module) {
  execSync(`mkdir -p ${config.output}`);
  config.saveVideo && startEncoder();
  server();
}

process.on('SIGINT', () => {
  if (child) {
    child.stdin.end();
    child.on('exit', () => {
      console.log('Exiting thing...');
      process.exit();
    });
  }
  else {
    process.exit();
  }
});

function startEncoder() {
  let args = [
    '-y',
    '-c:v', 'png',
    '-r', `${config.fps}`,
    '-f', 'image2pipe',
    '-i', '-',
    '-pix_fmt', 'yuv420p',

    '-vf', `scale=${config.width}x${config.height}`,
    '-c:v', config.codec,
    '-crf', `${config.crf}`,
    pth.join(config.output, config.videoFilename),
  ];
  child = spawn('ffmpeg', args, {stdio: ['pipe', 'pipe', 'pipe']});
  child.on('exit', () => console.log('Exiting encoder...'));
  child.stdout.on('data', (data) => {
    console.log(`ENCODER: ${data}`);
  });
  child.stderr.on('data', (data) => {
    console.error(`ENCODER: ${data}`);
  });
}

function server() {
  const server = http.createServer((req, res) => {
    let responseCode = 200;
    let contentType = 'text/plain';
    let body = '';
    if(req.method == 'GET') {
      body = `POST ${config.width}x${config.height} bitmap images here`;
    }
    else if (req.method == 'POST') {
      processData(req);
      body = 'lgtm';
    }
    else {
      res.statusCode = 500;
    }
          res.writeHead(responseCode, {'Content-Type': contentType});
    res.end(body);
  });
  server.listen(config.port, () => {
    console.log(`Imageserver listening on port ${config.port}...`);
  });
}

async function processData(req) {
  let data = '';
  req.on('data', (chunk) => data += chunk);
  req.on('end', () => {
    let match = data.match(/:([\w\/]+);/);
    let ext = formatMap[match[1]];
    let base64 = data.slice(data.indexOf(',') + 1);
    let buf = Buffer.from(base64, 'base64');
    if (config.saveImages) {
      let filepath = pth.join(config.output, config.imageFilename + ext);
      let idxString = ('0'.repeat(idxChars) + (idx ++)).slice(-idxChars);
      filepath = filepath.replace(/\#+/, idxString);
      console.log(`Writing "${filepath}"...`)
      fs.writeFileSync(filepath, buf);
    }
    if (config.saveVideo) {
      child.stdin.write(buf);
    }
  });
}

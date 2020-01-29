#!/usr/bin/env node

const pth = require('path');
const Server = require('static-server');
const build = require('./build');

const PORT = process.env.port || 8000;
const ENV = process.env.env || 'dev';

if (require.main === module) {
  build.buildAll(ENV);
  const server = new Server({
    rootPath: pth.join(__dirname, '../public'),
    port: PORT,
    name: 'Hexagonal Awareness'
  });
  server.start(() => {
    console.log(`Listening on port ${PORT} lol...`);
  });
  build.watch(ENV);
}
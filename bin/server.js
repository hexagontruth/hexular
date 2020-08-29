#!/usr/bin/env node

const Server = require('static-server');
const Builder = require('../lib/builder');
const util = require('../lib/util');

const overrides = {
  port: process.env.port
};
const config = util.config('dev', overrides);

const builder = new Builder(config);

if (require.main === module) {
  server();
}

function server() {
  console.log(util.join('public'));
  builder.buildAll();
  const server = new Server({
    rootPath: util.join('public'),
    port: config.port,
    name: 'Hexagonal Awareness'
  });
  server.start(() => {
    console.log(`Listening on port ${config.port} lol...`);
  });
  builder.watch();
}

module.exports = server;

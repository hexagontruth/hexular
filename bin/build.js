#!/usr/bin/env node

const Builder = require('../lib/builder');
const util = require('../lib/util');

const config = util.config('prod');
const builder = new Builder(config);

builder.buildAll();
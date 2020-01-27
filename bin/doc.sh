#!/bin/sh

BASE=$(dirname $0)/..

$BASE/node_modules/.bin/jsdoc -c $BASE/config/jsdoc/config.json --readme $BASE/README.md && echo 'Done'

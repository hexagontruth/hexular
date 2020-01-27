#!/bin/sh

basedir=$(dirname $0)/..

if [ -d "$basedir/public/build" ]; then
  rm $basedir/public/build/*
  rmdir $basedir/public/build
fi

#!/bin/sh

basedir=$(dirname $0)/..

cd $basedir

if [ "$1" = "-f" ]; then
  branch=$(git branch | grep ^\* | sed 's/\*\s*//g')
  git push origin $(git subtree split --prefix public $branch):gh-pages --force
else
  git subtree push --prefix public origin gh-pages
fi

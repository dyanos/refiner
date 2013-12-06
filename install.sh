#!/bin/bash
whichNPM=`which node`

if [ $whichNPM == "" ]; then
  echo 'You must need install Node.JS'
  echo 'To install Node.JS, you can use Homebrew or Macport'
  echo '  Otherwise, you can get a program directly from main site and install it.'
  exit
fi

if [ ! -e csv ]; then
  mkdir csv
fi

if [ ! -e tmp ]; then
  mkdir tmp
fi

npm install .

echo '------------------------------------------------'
echo 'Completed Installation'
echo ''
echo 'To run server)'
echo ''
echo ' $ node server.js'

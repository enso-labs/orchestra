#!/bin/bash

cp ../README.md README.md

mkdocs build --site-dir src/public/docs
echo "Docs built"
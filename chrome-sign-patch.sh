#!/bin/bash

alias sign_puppeteer="sudo codesign --force --deep \
    --sign - ./node_modules/puppeteer/.local-chromium/mac-*/chrome-mac/Chromium.app"
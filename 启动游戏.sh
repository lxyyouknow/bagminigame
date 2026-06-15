#!/bin/bash
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "未找到 npm，请先安装 Node.js。"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "首次启动，正在安装依赖..."
  npm install
fi

npm run start:game


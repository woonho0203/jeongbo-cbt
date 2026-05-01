#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ ! -d "node_modules" ]; then
  echo ">> 처음 실행이라 의존성을 설치합니다 (npm install)..."
  npm install
fi
echo ">> 서버를 시작합니다. 브라우저에서 http://localhost:3000 으로 접속하세요."
npm start

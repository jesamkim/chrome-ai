#!/bin/bash

# Chrome Extension 로컬 테스트를 위한 동기화 스크립트
# MacBook에서 실행할 스크립트

echo "🔄 Chrome Extension 프로젝트 동기화 시작..."

# 설정 변수 (사용자가 수정해야 함)
EC2_HOST="your-ec2-host"  # EC2 퍼블릭 IP 또는 호스트명
EC2_USER="ec2-user"       # EC2 사용자명
EC2_PATH="/Workshop/chrome-ai"  # EC2 프로젝트 경로
LOCAL_PATH="~/chrome-ai-extension"  # 로컬 저장 경로

# 로컬 디렉토리 생성
mkdir -p "$LOCAL_PATH"

# rsync로 프로젝트 동기화
echo "📁 프로젝트 파일 동기화 중..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'venv' \
  --exclude 'tests/integration' \
  "$EC2_USER@$EC2_HOST:$EC2_PATH/" \
  "$LOCAL_PATH/"

echo "✅ 동기화 완료!"
echo "📍 로컬 경로: $LOCAL_PATH"
echo ""
echo "🔧 Chrome Extension 로드 방법:"
echo "1. Chrome 브라우저에서 chrome://extensions/ 접속"
echo "2. '개발자 모드' 활성화"
echo "3. '압축해제된 확장 프로그램을 로드합니다' 클릭"
echo "4. '$LOCAL_PATH' 폴더 선택"
echo ""
echo "🔄 실시간 동기화를 위해 이 스크립트를 주기적으로 실행하세요."

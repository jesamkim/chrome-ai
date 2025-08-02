#!/bin/bash

# 실시간 파일 동기화 스크립트 (MacBook에서 실행)
# fswatch를 사용하여 EC2 파일 변경을 감지하고 로컬에 동기화

echo "🔄 실시간 Chrome Extension 동기화 시작..."

# 설정 변수 (사용자가 수정해야 함)
EC2_HOST="your-ec2-host"  # EC2 퍼블릭 IP 또는 호스트명
EC2_USER="ec2-user"       # EC2 사용자명
EC2_PATH="/Workshop/chrome-ai"  # EC2 프로젝트 경로
LOCAL_PATH="~/chrome-ai-extension"  # 로컬 저장 경로

# fswatch 설치 확인 (MacBook)
if ! command -v fswatch &> /dev/null; then
    echo "❌ fswatch가 설치되지 않았습니다."
    echo "📦 설치 명령: brew install fswatch"
    exit 1
fi

# 초기 동기화
echo "📁 초기 동기화 중..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'venv' \
  --exclude 'tests/integration' \
  "$EC2_USER@$EC2_HOST:$EC2_PATH/" \
  "$LOCAL_PATH/"

echo "✅ 초기 동기화 완료!"
echo "👀 파일 변경 감지 시작... (Ctrl+C로 중단)"

# 실시간 동기화 (EC2에서 변경 감지는 어려우므로 주기적 동기화)
while true; do
    sleep 10  # 10초마다 확인
    
    # 변경된 파일만 동기화
    rsync -avz --progress \
      --exclude 'node_modules' \
      --exclude '.git' \
      --exclude 'venv' \
      --exclude 'tests/integration' \
      --update \
      "$EC2_USER@$EC2_HOST:$EC2_PATH/" \
      "$LOCAL_PATH/" > /dev/null 2>&1
    
    # 변경사항이 있으면 알림
    if [ $? -eq 0 ]; then
        echo "🔄 $(date '+%H:%M:%S') - 동기화 확인 완료"
    fi
done

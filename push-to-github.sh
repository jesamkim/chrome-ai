#!/bin/bash

echo "🚀 GitHub 저장소에 푸시 중..."

# GitHub 저장소가 생성되었는지 확인
echo "📋 GitHub에서 chrome-bedrock-chat 저장소가 생성되었는지 확인하세요:"
echo "   https://github.com/jesamkim/chrome-bedrock-chat"
echo ""

read -p "저장소가 생성되었나요? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ 먼저 GitHub에서 저장소를 생성해주세요."
    exit 1
fi

# 원격 저장소 확인 및 추가
if git remote get-url origin > /dev/null 2>&1; then
    echo "✅ 원격 저장소가 이미 설정되어 있습니다."
else
    echo "🔗 원격 저장소 추가 중..."
    git remote add origin https://github.com/jesamkim/chrome-bedrock-chat.git
fi

# 푸시 실행
echo "📤 GitHub에 푸시 중..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 성공적으로 푸시되었습니다!"
    echo "📍 저장소 URL: https://github.com/jesamkim/chrome-bedrock-chat"
    echo ""
    echo "📋 다음 단계:"
    echo "1. 다른 환경에서 git clone https://github.com/jesamkim/chrome-bedrock-chat.git"
    echo "2. cd chrome-bedrock-chat"
    echo "3. npm install"
    echo "4. Chrome Extension 로드 및 테스트"
else
    echo "❌ 푸시 실패. GitHub 저장소가 올바르게 생성되었는지 확인해주세요."
fi

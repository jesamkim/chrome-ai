#!/usr/bin/env python3
"""
Chrome Extension 아이콘 생성 스크립트
최소한의 유효한 PNG 파일 생성
"""

import os
import base64

# 아이콘 디렉토리 생성
os.makedirs('src/assets/icons', exist_ok=True)

# 1x1 투명 PNG의 최소 유효한 데이터
minimal_png = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA'
    'O+lElwAAAABJRU5ErkJggg=='
)

# 각 크기별 아이콘 파일 생성
with open('src/assets/icons/icon16.png', 'wb') as f:
    f.write(minimal_png)

with open('src/assets/icons/icon48.png', 'wb') as f:
    f.write(minimal_png)

with open('src/assets/icons/icon128.png', 'wb') as f:
    f.write(minimal_png)

print("✅ 아이콘 파일들이 생성되었습니다:")
print("   - src/assets/icons/icon16.png")
print("   - src/assets/icons/icon48.png") 
print("   - src/assets/icons/icon128.png")
print("\n📝 참고: 현재는 임시 투명 아이콘입니다.")
print("실제 사용시에는 적절한 아이콘으로 교체하세요.")

#!/usr/bin/env python3
"""
Chrome Extension 아이콘 리사이즈 스크립트
원본 icon.png를 16x16, 48x48, 128x128 크기로 리사이즈
"""

from PIL import Image
import os

def resize_icon(input_path, output_path, size):
    """아이콘을 지정된 크기로 리사이즈"""
    try:
        # 원본 이미지 열기
        with Image.open(input_path) as img:
            # RGBA 모드로 변환 (투명도 지원)
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # 고품질 리샘플링으로 리사이즈
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            
            # PNG로 저장 (투명도 유지)
            resized.save(output_path, 'PNG', optimize=True)
            print(f"✅ {size}x{size} 아이콘 생성: {output_path}")
            
    except Exception as e:
        print(f"❌ {size}x{size} 아이콘 생성 실패: {e}")

def main():
    # 파일 경로 설정
    input_file = "icon.png"
    output_dir = "src/assets/icons"
    
    # 입력 파일 확인
    if not os.path.exists(input_file):
        print(f"❌ 원본 파일을 찾을 수 없습니다: {input_file}")
        return
    
    # 출력 디렉토리 확인
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"📁 디렉토리 생성: {output_dir}")
    
    # 필요한 아이콘 크기들
    sizes = [
        (16, "icon16.png"),
        (48, "icon48.png"), 
        (128, "icon128.png")
    ]
    
    print(f"🎨 아이콘 리사이즈 시작: {input_file}")
    print(f"📏 원본 크기 확인 중...")
    
    # 원본 이미지 정보 출력
    try:
        with Image.open(input_file) as img:
            print(f"📐 원본 크기: {img.size[0]}x{img.size[1]}")
            print(f"🎨 색상 모드: {img.mode}")
    except Exception as e:
        print(f"❌ 원본 파일 읽기 실패: {e}")
        return
    
    # 각 크기별로 리사이즈
    for size, filename in sizes:
        output_path = os.path.join(output_dir, filename)
        resize_icon(input_file, output_path, size)
    
    print("\n🎉 아이콘 리사이즈 완료!")
    print("\n📋 생성된 파일들:")
    for size, filename in sizes:
        output_path = os.path.join(output_dir, filename)
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            print(f"  - {filename}: {size}x{size}px ({file_size:,} bytes)")

if __name__ == "__main__":
    main()

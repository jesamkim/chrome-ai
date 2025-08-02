# EC2 보안 그룹 설정 가이드

## 개발 서버 접속을 위한 포트 설정

### AWS 콘솔에서 설정
1. AWS EC2 콘솔 접속
2. "보안 그룹" 메뉴 선택
3. 해당 EC2 인스턴스의 보안 그룹 선택
4. "인바운드 규칙" 탭 클릭
5. "규칙 추가" 버튼 클릭

### 추가할 규칙
- **유형**: 사용자 지정 TCP
- **포트 범위**: 3000
- **소스**: 내 IP (MacBook IP) 또는 0.0.0.0/0 (모든 IP, 개발용만)
- **설명**: Chrome Extension Dev Server

### AWS CLI로 설정 (선택사항)
```bash
# 보안 그룹 ID 확인
aws ec2 describe-security-groups --group-names default

# 포트 3000 열기 (내 IP만 허용)
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxxxxxx \
    --protocol tcp \
    --port 3000 \
    --source-group YOUR_IP/32
```

## 주의사항
- 개발 완료 후 포트 3000 규칙 삭제 권장
- 프로덕션 환경에서는 절대 0.0.0.0/0 사용 금지
- HTTPS 사용 시 포트 443도 고려

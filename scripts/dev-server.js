/**
 * Chrome Extension UI 개발용 웹 서버
 * EC2에서 실행하여 MacBook 브라우저로 테스트
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const PROJECT_ROOT = path.join(__dirname, '..');

// MIME 타입 매핑
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

// 파일 서빙 함수
function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    res.writeHead(200, { 
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(data);
  });
}

// 개발 서버 생성
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  console.log(`📡 요청: ${req.method} ${pathname}`);

  // 루트 경로는 개발 대시보드로 리다이렉트
  if (pathname === '/') {
    pathname = '/dev-dashboard.html';
  }

  // 파일 경로 결정
  let filePath = path.join(PROJECT_ROOT, pathname);

  // 보안: 프로젝트 루트 밖의 파일 접근 방지
  if (!filePath.startsWith(PROJECT_ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access denied');
    return;
  }

  // 특별한 라우트 처리
  if (pathname === '/dev-dashboard.html') {
    // 개발 대시보드 생성
    const dashboardHtml = generateDashboard();
    res.writeHead(200, { 
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(dashboardHtml);
    return;
  }

  // API 엔드포인트 (Chrome Extension API 모킹)
  if (pathname.startsWith('/api/')) {
    handleApiRequest(pathname, req, res);
    return;
  }

  // 정적 파일 서빙
  serveFile(filePath, res);
});

// 개발 대시보드 HTML 생성
function generateDashboard() {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chrome Extension 개발 대시보드</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #e0e6ed;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .card {
            background: rgba(255, 255, 255, 0.08);
            border-radius: 15px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .card h3 {
            color: #667eea;
            margin-top: 0;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            margin: 5px;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
        .iframe-container {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            padding: 20px;
            margin-top: 20px;
        }
        iframe {
            width: 100%;
            height: 600px;
            border: none;
            border-radius: 10px;
            background: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Claude AI Extension 개발 대시보드</h1>
            <p>Chrome Extension UI 컴포넌트 실시간 테스트</p>
        </div>

        <div class="grid">
            <div class="card">
                <h3>📱 팝업 UI</h3>
                <p>Extension 팝업 인터페이스 테스트</p>
                <a href="/src/popup/popup.html" class="btn" target="_blank">팝업 열기</a>
                <a href="#" class="btn" onclick="loadInFrame('/src/popup/popup.html')">프레임에서 보기</a>
            </div>

            <div class="card">
                <h3>⚙️ 설정 페이지</h3>
                <p>API Key 및 모델 설정 페이지</p>
                <a href="/src/options/options.html" class="btn" target="_blank">설정 열기</a>
                <a href="#" class="btn" onclick="loadInFrame('/src/options/options.html')">프레임에서 보기</a>
            </div>

            <div class="card">
                <h3>💬 사이드바</h3>
                <p>채팅 사이드바 인터페이스</p>
                <a href="/src/sidebar/sidebar.html" class="btn" target="_blank">사이드바 열기</a>
                <a href="#" class="btn" onclick="loadInFrame('/src/sidebar/sidebar.html')">프레임에서 보기</a>
            </div>

            <div class="card">
                <h3>🧪 API 테스트</h3>
                <p>Bedrock API 연결 테스트</p>
                <a href="/api/test" class="btn" target="_blank">API 테스트</a>
                <a href="/api/models" class="btn" target="_blank">모델 목록</a>
            </div>
        </div>

        <div class="iframe-container">
            <h3>🖥️ 실시간 미리보기</h3>
            <iframe id="preview-frame" src="/src/popup/popup.html"></iframe>
        </div>
    </div>

    <script>
        function loadInFrame(url) {
            document.getElementById('preview-frame').src = url;
        }

        // 자동 새로고침 (개발 중 파일 변경 감지)
        setInterval(() => {
            const frame = document.getElementById('preview-frame');
            if (frame.src) {
                frame.src = frame.src;
            }
        }, 5000); // 5초마다 새로고침
    </script>
</body>
</html>`;
}

// API 요청 처리
function handleApiRequest(pathname, req, res) {
  res.writeHead(200, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });

  if (pathname === '/api/test') {
    res.end(JSON.stringify({
      success: true,
      message: 'API 서버가 정상 작동 중입니다.',
      timestamp: new Date().toISOString()
    }));
  } else if (pathname === '/api/models') {
    res.end(JSON.stringify({
      success: true,
      models: [
        { key: 'claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', provider: 'anthropic' },
        { key: 'claude-4-sonnet', name: 'Claude 4 Sonnet', provider: 'anthropic' },
        { key: 'nova-pro', name: 'Amazon Nova Pro', provider: 'amazon' },
        { key: 'nova-lite', name: 'Amazon Nova Lite', provider: 'amazon' }
      ]
    }));
  } else {
    res.end(JSON.stringify({
      success: false,
      error: 'API 엔드포인트를 찾을 수 없습니다.'
    }));
  }
}

// 서버 시작
server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Chrome Extension 개발 서버 시작됨');
  console.log(`📡 서버 주소: http://0.0.0.0:${PORT}`);
  console.log(`🌐 외부 접속: http://[EC2-PUBLIC-IP]:${PORT}`);
  console.log('');
  console.log('📋 사용 가능한 엔드포인트:');
  console.log('  - / : 개발 대시보드');
  console.log('  - /src/popup/popup.html : 팝업 UI');
  console.log('  - /src/options/options.html : 설정 페이지');
  console.log('  - /api/test : API 테스트');
  console.log('  - /api/models : 모델 목록');
  console.log('');
  console.log('🔄 파일 변경 시 브라우저에서 새로고침하세요.');
});

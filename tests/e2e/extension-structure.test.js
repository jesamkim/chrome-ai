/**
 * Chrome Extension 구조 검증 테스트
 * Extension 파일들이 올바르게 구성되어 있는지 확인
 */

const fs = require('fs');
const path = require('path');

describe('Chrome Extension 구조 검증', () => {
  const extensionRoot = path.resolve(__dirname, '../../');

  test('필수 파일들이 존재하는지 확인', () => {
    console.log('🎯 Extension 구조 검증 시작');

    const requiredFiles = [
      'manifest.json',
      'src/background/background.js',
      'src/popup/popup.html',
      'src/popup/popup.css',
      'src/popup/popup.js',
      'src/options/options.html',
      'src/content/content.js'
    ];

    requiredFiles.forEach(file => {
      const filePath = path.join(extensionRoot, file);
      expect(fs.existsSync(filePath)).toBe(true);
      console.log(`✅ ${file} 존재 확인`);
    });
  });

  test('manifest.json이 유효한 JSON인지 확인', () => {
    const manifestPath = path.join(extensionRoot, 'manifest.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    
    let manifest;
    expect(() => {
      manifest = JSON.parse(manifestContent);
    }).not.toThrow();

    // 필수 필드 확인
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBeDefined();
    expect(manifest.version).toBeDefined();
    expect(manifest.permissions).toBeInstanceOf(Array);
    expect(manifest.background).toBeDefined();
    expect(manifest.action).toBeDefined();

    console.log('✅ manifest.json 유효성 확인 완료');
  });

  test('팝업 HTML 파일이 유효한지 확인', () => {
    const popupPath = path.join(extensionRoot, 'src/popup/popup.html');
    const popupContent = fs.readFileSync(popupPath, 'utf8');

    // 기본 HTML 구조 확인
    expect(popupContent).toContain('<!DOCTYPE html>');
    expect(popupContent).toContain('<html');
    expect(popupContent).toContain('<head>');
    expect(popupContent).toContain('<body>');

    // 필수 요소들 확인
    expect(popupContent).toContain('popup-container');
    expect(popupContent).toContain('popup-header');
    expect(popupContent).toContain('popup-main');
    expect(popupContent).toContain('popup-footer');

    // CSS 및 JS 파일 링크 확인
    expect(popupContent).toContain('popup.css');
    expect(popupContent).toContain('popup.js');

    console.log('✅ 팝업 HTML 구조 확인 완료');
  });

  test('팝업 CSS 파일이 유효한지 확인', () => {
    const cssPath = path.join(extensionRoot, 'src/popup/popup.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // 다크 테마 변수 확인
    expect(cssContent).toContain(':root');
    expect(cssContent).toContain('--bg-primary');
    expect(cssContent).toContain('--text-primary');
    expect(cssContent).toContain('--accent-primary');

    // 주요 클래스들 확인
    expect(cssContent).toContain('.popup-container');
    expect(cssContent).toContain('.popup-header');
    expect(cssContent).toContain('.popup-main');
    expect(cssContent).toContain('.popup-footer');

    console.log('✅ 팝업 CSS 구조 확인 완료');
  });

  test('팝업 JavaScript 파일이 유효한지 확인', () => {
    const jsPath = path.join(extensionRoot, 'src/popup/popup.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    // 주요 클래스 및 함수 확인
    expect(jsContent).toContain('class PopupManager');
    expect(jsContent).toContain('constructor()');
    expect(jsContent).toContain('init()');
    expect(jsContent).toContain('setupDOMReferences()');
    expect(jsContent).toContain('setupEventListeners()');

    // Chrome Extension API 사용 확인
    expect(jsContent).toContain('chrome.runtime');
    expect(jsContent).toContain('chrome.storage');

    console.log('✅ 팝업 JavaScript 구조 확인 완료');
  });

  test('Background Service Worker 파일이 유효한지 확인', () => {
    const backgroundPath = path.join(extensionRoot, 'src/background/background.js');
    const backgroundContent = fs.readFileSync(backgroundPath, 'utf8');

    // Service Worker 이벤트 리스너 확인
    expect(backgroundContent).toContain('chrome.runtime.onMessage');
    expect(backgroundContent).toContain('chrome.runtime.onInstalled');

    // Bedrock 클라이언트 사용 확인
    expect(backgroundContent).toContain('BedrockClient');

    console.log('✅ Background Service Worker 구조 확인 완료');
  });

  test('Content Script 파일이 존재하는지 확인', () => {
    const contentPath = path.join(extensionRoot, 'src/content/content.js');
    expect(fs.existsSync(contentPath)).toBe(true);

    const contentContent = fs.readFileSync(contentPath, 'utf8');
    
    // Content Script 기본 구조 확인
    expect(contentContent.length).toBeGreaterThan(0);

    console.log('✅ Content Script 파일 확인 완료');
  });

  test('Options 페이지 파일이 존재하는지 확인', () => {
    const optionsPath = path.join(extensionRoot, 'src/options/options.html');
    expect(fs.existsSync(optionsPath)).toBe(true);

    const optionsContent = fs.readFileSync(optionsPath, 'utf8');
    
    // Options 페이지 기본 구조 확인
    expect(optionsContent).toContain('<!DOCTYPE html>');
    expect(optionsContent).toContain('설정');

    console.log('✅ Options 페이지 파일 확인 완료');
  });

  test('Bedrock 클라이언트 파일이 유효한지 확인', () => {
    const bedrockPath = path.join(extensionRoot, 'src/background/bedrock-client.js');
    const bedrockContent = fs.readFileSync(bedrockPath, 'utf8');

    // Bedrock 클라이언트 클래스 확인
    expect(bedrockContent).toContain('class BedrockClient');
    expect(bedrockContent).toContain('initialize()');
    expect(bedrockContent).toContain('async invokeClaude(');

    // 지원 모델들 확인
    expect(bedrockContent).toContain('claude-3.7-sonnet');
    expect(bedrockContent).toContain('claude-4-sonnet');
    // Nova 모델은 제거됨

    console.log('✅ Bedrock 클라이언트 구조 확인 완료');
  });

  test('패키지 의존성이 올바른지 확인', () => {
    const packagePath = path.join(extensionRoot, 'package.json');
    const packageContent = fs.readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);

    // 필수 의존성 확인
    expect(packageJson.dependencies).toBeDefined();
    expect(packageJson.dependencies['@aws-sdk/client-bedrock-runtime']).toBeDefined();

    // 개발 의존성 확인
    expect(packageJson.devDependencies).toBeDefined();
    expect(packageJson.devDependencies['jest']).toBeDefined();

    console.log('✅ 패키지 의존성 확인 완료');
  });

  test('전체 파일 크기가 적절한지 확인', () => {
    const getDirectorySize = (dirPath) => {
      let totalSize = 0;
      const files = fs.readdirSync(dirPath);
      
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          totalSize += getDirectorySize(filePath);
        } else if (stats.isFile()) {
          totalSize += stats.size;
        }
      });
      
      return totalSize;
    };

    const srcSize = getDirectorySize(path.join(extensionRoot, 'src'));
    const manifestSize = fs.statSync(path.join(extensionRoot, 'manifest.json')).size;
    const totalSize = srcSize + manifestSize;

    // Extension 크기가 합리적인지 확인 (10MB 미만)
    expect(totalSize).toBeLessThan(10 * 1024 * 1024);

    console.log(`✅ Extension 총 크기: ${(totalSize / 1024).toFixed(2)} KB`);
  });
});

console.log('🎯 Extension 구조 검증 테스트 로드 완료');

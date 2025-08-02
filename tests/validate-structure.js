#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 필수 디렉토리 구조 정의
const requiredStructure = [
  'src',
  'src/background',
  'src/content',
  'src/popup',
  'src/sidebar',
  'src/options',
  'src/utils',
  'src/mcp',
  'src/assets',
  'src/assets/icons',
  'src/assets/styles',
  'src/assets/locales',
  'tests',
  'tests/unit',
  'tests/integration',
  'tests/e2e',
  'tests/mocks',
  'tests/fixtures',
  'docs',
  'build'
];

// 필수 파일 정의
const requiredFiles = [
  'package.json',
  'development-log.md',
  'development-plan.md',
  'test-setup.md'
];

function validateStructure() {
  console.log('🔍 프로젝트 구조 검증 시작...\n');
  
  let allValid = true;
  
  // 디렉토리 검증
  console.log('📁 디렉토리 구조 검증:');
  requiredStructure.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      console.log(`✅ ${dir}`);
    } else {
      console.log(`❌ ${dir} - 누락됨`);
      allValid = false;
    }
  });
  
  console.log('\n📄 필수 파일 검증:');
  requiredFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - 누락됨`);
      allValid = false;
    }
  });
  
  console.log('\n' + '='.repeat(50));
  
  if (allValid) {
    console.log('🎉 프로젝트 구조 검증 완료! 모든 필수 요소가 존재합니다.');
    process.exit(0);
  } else {
    console.log('⚠️  프로젝트 구조에 누락된 요소가 있습니다.');
    process.exit(1);
  }
}

// 스크립트 실행
validateStructure();

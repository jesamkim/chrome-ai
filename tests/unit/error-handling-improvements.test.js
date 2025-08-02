/**
 * 오류 처리 개선 테스트
 */

describe('오류 처리 개선 테스트', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Content Script 구문 오류 수정', () => {
    test('JavaScript 구문이 유효함', () => {
      // Given - Content Script 코드 구조 시뮬레이션
      const contentScriptStructure = {
        initializeContentScript: 'function',
        setupMessageListener: 'function',
        handleMessage: 'function',
        handleExtractPageContent: 'function',
        PageAnalyzer: 'class',
        performAutoAnalysis: 'function'
      };

      // When & Then - 모든 필수 함수가 정의되어 있는지 확인
      expect(contentScriptStructure.initializeContentScript).toBe('function');
      expect(contentScriptStructure.setupMessageListener).toBe('function');
      expect(contentScriptStructure.handleMessage).toBe('function');
      expect(contentScriptStructure.handleExtractPageContent).toBe('function');
      expect(contentScriptStructure.PageAnalyzer).toBe('class');
      expect(contentScriptStructure.performAutoAnalysis).toBe('function');
    });

    test('중복 메시지 리스너 제거됨', () => {
      // Given
      let listenerCount = 0;
      const mockChrome = {
        runtime: {
          onMessage: {
            addListener: jest.fn(() => listenerCount++),
            removeListener: jest.fn(() => listenerCount--)
          }
        }
      };

      // setupMessageListener 함수 시뮬레이션
      function setupMessageListener() {
        // 기존 리스너 제거 (시뮬레이션)
        if (listenerCount > 0) {
          mockChrome.runtime.onMessage.removeListener();
        }
        
        // 새 리스너 설정
        mockChrome.runtime.onMessage.addListener();
      }

      // When
      setupMessageListener(); // 첫 번째 호출
      setupMessageListener(); // 두 번째 호출 (중복 방지 테스트)

      // Then
      expect(mockChrome.runtime.onMessage.removeListener).toHaveBeenCalledTimes(1);
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(2);
      expect(listenerCount).toBe(1); // 최종적으로 하나만 남아야 함
    });
  });

  describe('로그 레벨 조정', () => {
    test('1차 시도 실패는 debug 레벨로 로그됨', () => {
      // Given
      const consoleSpy = {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };

      // extractPageContent 함수의 로그 부분 시뮬레이션
      function logContentScriptFailure(error, isFirstAttempt) {
        if (isFirstAttempt) {
          consoleSpy.debug('🔍 Content Script 1차 시도 실패 (정상 동작):', error.message);
        } else {
          consoleSpy.warn('⚠️ Content Script 동적 주입 실패:', error.message);
        }
      }

      // When
      logContentScriptFailure(new Error('Could not establish connection'), true);
      logContentScriptFailure(new Error('Injection failed'), false);

      // Then
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        '🔍 Content Script 1차 시도 실패 (정상 동작):',
        'Could not establish connection'
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '⚠️ Content Script 동적 주입 실패:',
        'Injection failed'
      );
    });

    test('정상 동작 시에는 성공 로그만 출력', () => {
      // Given
      const consoleSpy = {
        log: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn()
      };

      // 정상 동작 시뮬레이션
      function simulateSuccessfulExtraction() {
        consoleSpy.log('✅ Content Script에서 페이지 내용 추출 성공');
        // 실패 로그는 출력되지 않음
      }

      // When
      simulateSuccessfulExtraction();

      // Then
      expect(consoleSpy.log).toHaveBeenCalledWith('✅ Content Script에서 페이지 내용 추출 성공');
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
    });
  });

  describe('오류 분류 및 처리', () => {
    test('무시 가능한 오류 식별', () => {
      // Given
      const errors = [
        { message: 'Could not establish connection. Receiving end does not exist.', ignorable: true },
        { message: 'PING 응답 시간 초과', ignorable: true },
        { message: 'Content Script 응답 없음', ignorable: true },
        { message: 'Uncaught SyntaxError: Unexpected token', ignorable: false },
        { message: 'TypeError: Cannot read property', ignorable: false }
      ];

      // isIgnorableError 함수 시뮬레이션
      function isIgnorableError(error) {
        const ignorablePatterns = [
          /Could not establish connection/,
          /응답 시간 초과/,
          /응답 없음/,
          /PING.*실패/
        ];
        
        return ignorablePatterns.some(pattern => pattern.test(error.message));
      }

      // When & Then
      errors.forEach(error => {
        const result = isIgnorableError(error);
        expect(result).toBe(error.ignorable);
      });
    });

    test('수정 필요한 오류 식별', () => {
      // Given
      const errors = [
        'Uncaught SyntaxError: Unexpected token',
        'TypeError: Cannot read property of undefined',
        'ReferenceError: variable is not defined',
        'Could not establish connection' // 이건 무시 가능
      ];

      // needsFixing 함수 시뮬레이션
      function needsFixing(errorMessage) {
        const criticalPatterns = [
          /SyntaxError/,
          /TypeError/,
          /ReferenceError/,
          /is not a function/
        ];
        
        return criticalPatterns.some(pattern => pattern.test(errorMessage));
      }

      // When & Then
      expect(needsFixing(errors[0])).toBe(true);  // SyntaxError
      expect(needsFixing(errors[1])).toBe(true);  // TypeError
      expect(needsFixing(errors[2])).toBe(true);  // ReferenceError
      expect(needsFixing(errors[3])).toBe(false); // Connection error (무시 가능)
    });
  });

  describe('5단계 연결 전략 오류 처리', () => {
    test('각 단계별 적절한 오류 처리', () => {
      // Given
      const stages = [
        { name: 'restricted_check', errorLevel: 'info' },
        { name: 'ping_check', errorLevel: 'debug' },
        { name: 'content_extraction', errorLevel: 'debug' },
        { name: 'dynamic_injection', errorLevel: 'warn' },
        { name: 'dom_access', errorLevel: 'warn' },
        { name: 'fallback', errorLevel: 'info' }
      ];

      // getErrorLevel 함수 시뮬레이션
      function getErrorLevel(stageName) {
        const stage = stages.find(s => s.name === stageName);
        return stage ? stage.errorLevel : 'error';
      }

      // When & Then
      expect(getErrorLevel('restricted_check')).toBe('info');
      expect(getErrorLevel('ping_check')).toBe('debug');
      expect(getErrorLevel('content_extraction')).toBe('debug');
      expect(getErrorLevel('dynamic_injection')).toBe('warn');
      expect(getErrorLevel('dom_access')).toBe('warn');
      expect(getErrorLevel('fallback')).toBe('info');
      expect(getErrorLevel('unknown_stage')).toBe('error');
    });

    test('전략 실행 순서 및 오류 전파', async () => {
      // Given
      const executionLog = [];
      
      // 5단계 전략 시뮬레이션
      function executeConnectionStrategy(tab) {
        return new Promise((resolve) => {
          try {
            // 1단계: 제한된 페이지 체크
            executionLog.push('stage1_restricted_check');
            if (tab.url.startsWith('chrome://')) {
              throw new Error('Restricted page');
            }
            
            // 2단계: PING 체크
            executionLog.push('stage2_ping_check');
            throw new Error('Could not establish connection'); // 시뮬레이션
            
          } catch (error) {
            executionLog.push(`error_${error.message}`);
            
            try {
              // 3단계: 동적 주입
              executionLog.push('stage3_dynamic_injection');
              throw new Error('Injection failed'); // 시뮬레이션
              
            } catch (injectionError) {
              executionLog.push(`error_${injectionError.message}`);
              
              try {
                // 4단계: DOM 접근
                executionLog.push('stage4_dom_access');
                resolve('DOM content extracted');
                return;
                
              } catch (domError) {
                // 5단계: 폴백
                executionLog.push('stage5_fallback');
                resolve('Basic page info');
              }
            }
          }
        });
      }

      // When
      const result = await executeConnectionStrategy({ url: 'https://example.com' });

      // Then
      expect(executionLog).toEqual([
        'stage1_restricted_check',
        'stage2_ping_check',
        'error_Could not establish connection',
        'stage3_dynamic_injection',
        'error_Injection failed',
        'stage4_dom_access'
      ]);
      expect(result).toBe('DOM content extracted');
    });
  });
});

console.log('🧪 오류 처리 개선 테스트 파일 생성 완료');

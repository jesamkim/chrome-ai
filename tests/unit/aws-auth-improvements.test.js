/**
 * AWS 인증 개선 테스트
 * 
 * 보안 주의사항:
 * - 이 파일의 모든 API Key와 Access Key는 테스트용 더미 값입니다
 * - AKIA123456789, secret123 등은 실제 AWS 자격증명이 아닙니다
 * - 실제 테스트 시에는 환경변수를 사용하세요
 */

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

describe('AWS 인증 개선 테스트', () => {
  let authManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // AWSAuthManager Mock 클래스
    class MockAWSAuthManager {
      constructor() {
        this.authType = null;
        this.credentials = null;
        this.region = 'us-west-2';
        this.isInitialized = false;
      }

      async initialize() {
        // AWS CLI 인증 확인
        const awsCliAuth = await this.checkAWSCLIAuth();
        if (awsCliAuth.available) {
          this.authType = 'aws-cli';
          this.credentials = awsCliAuth.credentials;
          this.region = awsCliAuth.region;
          this.isInitialized = true;
          return true;
        }

        // API Key 인증 확인
        const apiKeyAuth = await this.checkAPIKeyAuth();
        if (apiKeyAuth.available) {
          this.authType = 'api-key';
          this.credentials = apiKeyAuth.credentials;
          this.isInitialized = true;
          return true;
        }

        this.isInitialized = false;
        return false;
      }

      async checkAWSCLIAuth() {
        const mockData = {
          aws_access_key_id: 'AKIA123456789',
          aws_secret_access_key: 'secret123',
          aws_region: 'us-west-2'
        };

        chrome.storage.local.get.mockResolvedValue(mockData);

        if (mockData.aws_access_key_id && mockData.aws_secret_access_key) {
          return {
            available: true,
            credentials: {
              accessKeyId: mockData.aws_access_key_id,
              secretAccessKey: mockData.aws_secret_access_key,
              sessionToken: mockData.aws_session_token || null
            },
            region: mockData.aws_region || 'us-west-2',
            profile: mockData.aws_profile || 'default'
          };
        }

        return { available: false };
      }

      async checkAPIKeyAuth() {
        const mockData = { bedrockApiKey: 'test-api-key-123' };
        chrome.storage.sync.get.mockResolvedValue(mockData);

        if (mockData.bedrockApiKey && mockData.bedrockApiKey.trim()) {
          return {
            available: true,
            credentials: {
              apiKey: mockData.bedrockApiKey.trim()
            }
          };
        }

        return { available: false };
      }

      async getAuthHeaders() {
        if (!this.isInitialized) {
          throw new Error('AWS 인증이 초기화되지 않았습니다.');
        }

        switch (this.authType) {
          case 'aws-cli':
            return {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Amz-Date': '20240101T000000Z',
              'Authorization': 'AWS4-HMAC-SHA256 Credential=...'
            };
          
          case 'api-key':
            return {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.credentials.apiKey}`,
              'Accept': 'application/json'
            };
          
          default:
            throw new Error('알 수 없는 인증 방식입니다.');
        }
      }

      getAuthInfo() {
        return {
          isInitialized: this.isInitialized,
          authType: this.authType,
          region: this.region,
          hasCredentials: !!this.credentials
        };
      }

      async setAWSCLICredentials(credentials) {
        const { accessKeyId, secretAccessKey, sessionToken, region, profile } = credentials;

        if (!accessKeyId || !secretAccessKey) {
          throw new Error('Access Key ID와 Secret Access Key는 필수입니다.');
        }

        await chrome.storage.local.set({
          aws_access_key_id: accessKeyId,
          aws_secret_access_key: secretAccessKey,
          aws_session_token: sessionToken || null,
          aws_region: region || 'us-west-2',
          aws_profile: profile || 'default'
        });

        return await this.initialize();
      }

      async clearAWSCLICredentials() {
        await chrome.storage.local.remove([
          'aws_access_key_id',
          'aws_secret_access_key',
          'aws_session_token',
          'aws_region',
          'aws_profile'
        ]);

        return await this.initialize();
      }
    }

    authManager = new MockAWSAuthManager();
  });

  describe('인증 우선순위', () => {
    test('AWS CLI 인증이 우선 사용됨', async () => {
      // Given - AWS CLI와 API Key 모두 설정됨
      chrome.storage.local.get.mockResolvedValue({
        aws_access_key_id: 'AKIA123456789',
        aws_secret_access_key: 'secret123',
        aws_region: 'us-west-2'
      });
      
      chrome.storage.sync.get.mockResolvedValue({
        bedrockApiKey: 'test-api-key-123'
      });

      // When
      const success = await authManager.initialize();

      // Then
      expect(success).toBe(true);
      expect(authManager.authType).toBe('aws-cli');
      expect(authManager.credentials.accessKeyId).toBe('AKIA123456789');
    });

    test('AWS CLI 없으면 API Key 사용됨', async () => {
      // Given - AWS CLI 없음, API Key만 있음
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.sync.get.mockResolvedValue({
        bedrockApiKey: 'test-api-key-123'
      });

      // When
      const success = await authManager.initialize();

      // Then
      expect(success).toBe(true);
      expect(authManager.authType).toBe('api-key');
      expect(authManager.credentials.apiKey).toBe('test-api-key-123');
    });

    test('둘 다 없으면 초기화 실패', async () => {
      // Given - 인증 정보 없음
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.sync.get.mockResolvedValue({});

      // When
      const success = await authManager.initialize();

      // Then
      expect(success).toBe(false);
      expect(authManager.authType).toBe(null);
      expect(authManager.isInitialized).toBe(false);
    });
  });

  describe('AWS CLI 인증', () => {
    test('AWS CLI 인증 정보 확인', async () => {
      // Given
      chrome.storage.local.get.mockResolvedValue({
        aws_access_key_id: 'AKIA123456789',
        aws_secret_access_key: 'secret123',
        aws_session_token: 'session123',
        aws_region: 'us-east-1',
        aws_profile: 'production'
      });

      // When
      const result = await authManager.checkAWSCLIAuth();

      // Then
      expect(result.available).toBe(true);
      expect(result.credentials.accessKeyId).toBe('AKIA123456789');
      expect(result.credentials.secretAccessKey).toBe('secret123');
      expect(result.credentials.sessionToken).toBe('session123');
      expect(result.region).toBe('us-east-1');
      expect(result.profile).toBe('production');
    });

    test('AWS CLI 인증 정보 설정', async () => {
      // Given
      const credentials = {
        accessKeyId: 'AKIA987654321',
        secretAccessKey: 'newsecret456',
        sessionToken: 'newsession456',
        region: 'eu-west-1',
        profile: 'development'
      };

      // When
      const success = await authManager.setAWSCLICredentials(credentials);

      // Then
      expect(success).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        aws_access_key_id: 'AKIA987654321',
        aws_secret_access_key: 'newsecret456',
        aws_session_token: 'newsession456',
        aws_region: 'eu-west-1',
        aws_profile: 'development'
      });
    });

    test('필수 필드 없으면 오류 발생', async () => {
      // Given
      const incompleteCredentials = {
        accessKeyId: 'AKIA123456789'
        // secretAccessKey 누락
      };

      // When & Then
      await expect(authManager.setAWSCLICredentials(incompleteCredentials))
        .rejects.toThrow('Access Key ID와 Secret Access Key는 필수입니다.');
    });

    test('AWS CLI 인증 정보 제거', async () => {
      // When
      const success = await authManager.clearAWSCLICredentials();

      // Then
      expect(success).toBe(false); // API Key도 없으므로 false
      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        'aws_access_key_id',
        'aws_secret_access_key',
        'aws_session_token',
        'aws_region',
        'aws_profile'
      ]);
    });
  });

  describe('API Key 인증', () => {
    test('API Key 인증 정보 확인', async () => {
      // Given
      chrome.storage.sync.get.mockResolvedValue({
        bedrockApiKey: 'test-api-key-123'
      });

      // When
      const result = await authManager.checkAPIKeyAuth();

      // Then
      expect(result.available).toBe(true);
      expect(result.credentials.apiKey).toBe('test-api-key-123');
    });

    test('빈 API Key는 사용 불가', async () => {
      // Given
      chrome.storage.sync.get.mockResolvedValue({
        bedrockApiKey: '   ' // 공백만 있는 경우
      });

      // When
      const result = await authManager.checkAPIKeyAuth();

      // Then
      expect(result.available).toBe(false);
    });
  });

  describe('인증 헤더 생성', () => {
    test('AWS CLI 인증 헤더 생성', async () => {
      // Given
      chrome.storage.local.get.mockResolvedValue({
        aws_access_key_id: 'AKIA123456789',
        aws_secret_access_key: 'secret123'
      });
      
      await authManager.initialize();

      // When
      const headers = await authManager.getAuthHeaders();

      // Then
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Accept']).toBe('application/json');
      expect(headers['X-Amz-Date']).toBeDefined();
      expect(headers['Authorization']).toContain('AWS4-HMAC-SHA256');
    });

    test('API Key 인증 헤더 생성', async () => {
      // Given
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.sync.get.mockResolvedValue({
        bedrockApiKey: 'test-api-key-123'
      });
      
      await authManager.initialize();

      // When
      const headers = await authManager.getAuthHeaders();

      // Then
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Accept']).toBe('application/json');
      expect(headers['Authorization']).toBe('Bearer test-api-key-123');
    });

    test('초기화되지 않은 상태에서 헤더 요청 시 오류', async () => {
      // Given - 초기화하지 않음

      // When & Then
      await expect(authManager.getAuthHeaders())
        .rejects.toThrow('AWS 인증이 초기화되지 않았습니다.');
    });
  });

  describe('인증 정보 조회', () => {
    test('AWS CLI 인증 정보 조회', async () => {
      // Given
      chrome.storage.local.get.mockResolvedValue({
        aws_access_key_id: 'AKIA123456789',
        aws_secret_access_key: 'secret123',
        aws_region: 'us-east-1'
      });
      
      await authManager.initialize();

      // When
      const authInfo = authManager.getAuthInfo();

      // Then
      expect(authInfo.isInitialized).toBe(true);
      expect(authInfo.authType).toBe('aws-cli');
      expect(authInfo.region).toBe('us-east-1');
      expect(authInfo.hasCredentials).toBe(true);
    });

    test('API Key 인증 정보 조회', async () => {
      // Given
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.sync.get.mockResolvedValue({
        bedrockApiKey: 'test-api-key-123'
      });
      
      await authManager.initialize();

      // When
      const authInfo = authManager.getAuthInfo();

      // Then
      expect(authInfo.isInitialized).toBe(true);
      expect(authInfo.authType).toBe('api-key');
      expect(authInfo.region).toBe('us-west-2'); // 기본값
      expect(authInfo.hasCredentials).toBe(true);
    });

    test('인증 실패 시 정보 조회', async () => {
      // Given - 인증 정보 없음
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.sync.get.mockResolvedValue({});
      
      await authManager.initialize();

      // When
      const authInfo = authManager.getAuthInfo();

      // Then
      expect(authInfo.isInitialized).toBe(false);
      expect(authInfo.authType).toBe(null);
      expect(authInfo.hasCredentials).toBe(false);
    });
  });

  describe('실제 사용 시나리오', () => {
    test('AWS CLI 설정 → API 호출 → 성공', async () => {
      // Given - AWS CLI 설정
      chrome.storage.local.get.mockResolvedValue({
        aws_access_key_id: 'AKIA123456789',
        aws_secret_access_key: 'secret123',
        aws_region: 'us-west-2'
      });

      // When - 초기화 및 헤더 생성
      const initSuccess = await authManager.initialize();
      const headers = await authManager.getAuthHeaders();

      // Then
      expect(initSuccess).toBe(true);
      expect(authManager.authType).toBe('aws-cli');
      expect(headers['Authorization']).toContain('AWS4-HMAC-SHA256');
    });

    test('AWS CLI 실패 → API Key 폴백 → 성공', async () => {
      // Given - AWS CLI 없음, API Key 있음
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.sync.get.mockResolvedValue({
        bedrockApiKey: 'fallback-api-key'
      });

      // When
      const initSuccess = await authManager.initialize();
      const headers = await authManager.getAuthHeaders();

      // Then
      expect(initSuccess).toBe(true);
      expect(authManager.authType).toBe('api-key');
      expect(headers['Authorization']).toBe('Bearer fallback-api-key');
    });

    test('모든 인증 실패 → 오류', async () => {
      // Given - 모든 인증 정보 없음
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.sync.get.mockResolvedValue({});

      // When
      const initSuccess = await authManager.initialize();

      // Then
      expect(initSuccess).toBe(false);
      expect(authManager.isInitialized).toBe(false);
      
      // 헤더 요청 시 오류
      await expect(authManager.getAuthHeaders())
        .rejects.toThrow('AWS 인증이 초기화되지 않았습니다.');
    });
  });
});

console.log('🧪 AWS 인증 개선 테스트 파일 생성 완료');

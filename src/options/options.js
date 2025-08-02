/**
 * AWS AI Assistant 설정 페이지 JavaScript
 * AWS CLI 인증과 API Key 인증 지원
 */

// DOM 요소들
const elements = {
    // 인증 방식 선택
    authLocalAWSCLI: document.getElementById('authLocalAWSCLI'),
    authAWSCLI: document.getElementById('authAWSCLI'),
    authAPIKey: document.getElementById('authAPIKey'),
    localAwsCliSection: document.getElementById('localAwsCliSection'),
    awsCliSection: document.getElementById('awsCliSection'),
    apiKeySection: document.getElementById('apiKeySection'),
    
    // 로컬 AWS CLI 요소들
    currentProfile: document.getElementById('currentProfile'),
    awsProfile: document.getElementById('awsProfile'),
    localCliApiKey: document.getElementById('localCliApiKey'),
    toggleLocalCliApiKey: document.getElementById('toggleLocalCliApiKey'),
    
    // AWS CLI 인증 요소들
    awsAccessKeyId: document.getElementById('awsAccessKeyId'),
    awsSecretAccessKey: document.getElementById('awsSecretAccessKey'),
    awsSessionToken: document.getElementById('awsSessionToken'),
    awsRegion: document.getElementById('awsRegion'),
    toggleSecretKey: document.getElementById('toggleSecretKey'),
    
    // API Key 인증 요소들
    apiKey: document.getElementById('apiKey'),
    toggleApiKey: document.getElementById('toggleApiKey'),
    
    // 공통 요소들
    testConnection: document.getElementById('testConnection'),
    saveApiKey: document.getElementById('saveApiKey'),
    connectionStatus: document.getElementById('connectionStatus'),
    authStatusIndicator: document.getElementById('authStatusIndicator'),
    authStatusText: document.getElementById('authStatusText'),
    
    modelSelect: document.getElementById('modelSelect'),
    modelDescription: document.getElementById('modelDescription'),
    modelInfo: document.getElementById('modelInfo'),
    currentModelName: document.getElementById('currentModelName'),
    currentModelProvider: document.getElementById('currentModelProvider'),
    currentModelMaxTokens: document.getElementById('currentModelMaxTokens'),
    saveModel: document.getElementById('saveModel'),
    
    maxTokens: document.getElementById('maxTokens'),
    temperature: document.getElementById('temperature'),
    temperatureValue: document.getElementById('temperatureValue'),
    autoAnalyze: document.getElementById('autoAnalyze'),
    saveSettings: document.getElementById('saveSettings'),
    
    totalChats: document.getElementById('totalChats'),
    totalTokens: document.getElementById('totalTokens'),
    analyzedPages: document.getElementById('analyzedPages'),
    lastUsed: document.getElementById('lastUsed'),
    resetStats: document.getElementById('resetStats'),
    
    apiKeyHelp: document.getElementById('apiKeyHelp')
};

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 설정 페이지 로드됨');
    
    // 인증 방식 선택 이벤트 리스너
    setupAuthMethodListeners();
    
    // 비밀번호 토글 이벤트 리스너
    setupPasswordToggleListeners();
    
    await loadSettings();
    await loadSupportedModels();
    await loadCurrentModel();
    await loadStatistics();
    
    // 현재 인증 상태 확인
    await checkAuthStatus();
    
    setupEventListeners();
    
    console.log('✅ 설정 페이지 초기화 완료');
});

/**
 * 인증 방식 선택 이벤트 리스너 설정
 */
function setupAuthMethodListeners() {
    elements.authLocalAWSCLI?.addEventListener('change', () => {
        if (elements.authLocalAWSCLI.checked) {
            elements.localAwsCliSection.style.display = 'block';
            elements.awsCliSection.style.display = 'none';
            elements.apiKeySection.style.display = 'none';
        }
    });

    elements.authAWSCLI?.addEventListener('change', () => {
        if (elements.authAWSCLI.checked) {
            elements.localAwsCliSection.style.display = 'none';
            elements.awsCliSection.style.display = 'block';
            elements.apiKeySection.style.display = 'none';
        }
    });

    elements.authAPIKey?.addEventListener('change', () => {
        if (elements.authAPIKey.checked) {
            elements.localAwsCliSection.style.display = 'none';
            elements.awsCliSection.style.display = 'none';
            elements.apiKeySection.style.display = 'block';
        }
    });
}

/**
 * 비밀번호 토글 이벤트 리스너 설정
 */
function setupPasswordToggleListeners() {
    // API Key 토글
    elements.toggleApiKey?.addEventListener('click', () => {
        const input = elements.apiKey;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        elements.toggleApiKey.textContent = isPassword ? '🙈' : '👁️';
    });

    // 로컬 CLI API Key 토글
    elements.toggleLocalCliApiKey?.addEventListener('click', () => {
        const input = elements.localCliApiKey;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        elements.toggleLocalCliApiKey.textContent = isPassword ? '🙈' : '👁️';
    });

    // Secret Access Key 토글
    elements.toggleSecretKey?.addEventListener('click', () => {
        const input = elements.awsSecretAccessKey;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        elements.toggleSecretKey.textContent = isPassword ? '🙈' : '👁️';
    });
}

/**
 * 현재 인증 상태 확인
 */
async function checkAuthStatus() {
    try {
        elements.authStatusIndicator.textContent = '⏳';
        elements.authStatusIndicator.className = 'status-indicator loading';
        elements.authStatusText.textContent = '인증 상태 확인 중...';

        const response = await chrome.runtime.sendMessage({
            type: 'GET_AUTH_INFO'
        });

        if (response && response.success) {
            const { authInfo } = response;
            
            // 인증 방식 라디오 버튼 설정
            if (authInfo.authType === 'aws-cli') {
                elements.authAWSCLI.checked = true;
                elements.awsCliSection.style.display = 'block';
                elements.apiKeySection.style.display = 'none';
                
                // AWS CLI 정보 로드
                await loadAWSCLICredentials();
            } else if (authInfo.authType === 'api-key') {
                elements.authAPIKey.checked = true;
                elements.awsCliSection.style.display = 'none';
                elements.apiKeySection.style.display = 'block';
            }

            // 상태 표시 업데이트
            elements.authStatusIndicator.textContent = '✅';
            elements.authStatusIndicator.className = 'status-indicator connected';
            elements.authStatusText.textContent = `${authInfo.authType === 'aws-cli' ? 'AWS CLI' : 'API Key'} 인증 활성화 (${authInfo.region})`;

        } else {
            elements.authStatusIndicator.textContent = '❌';
            elements.authStatusIndicator.className = 'status-indicator error';
            elements.authStatusText.textContent = response?.error || '인증 정보가 설정되지 않았습니다';
            
            // 기본값으로 API Key 선택
            elements.authAPIKey.checked = true;
            elements.apiKeySection.style.display = 'block';
        }

    } catch (error) {
        console.error('❌ 인증 상태 확인 실패:', error);
        elements.authStatusIndicator.textContent = '❌';
        elements.authStatusIndicator.className = 'status-indicator error';
        elements.authStatusText.textContent = '인증 상태 확인 실패';
    }
}

/**
 * AWS CLI 인증 정보 로드
 */
async function loadAWSCLICredentials() {
    try {
        const result = await chrome.storage.local.get([
            'aws_access_key_id',
            'aws_secret_access_key',
            'aws_session_token',
            'aws_region',
            'aws_profile'
        ]);

        if (result.aws_access_key_id) {
            elements.awsAccessKeyId.value = result.aws_access_key_id;
        }
        if (result.aws_secret_access_key) {
            elements.awsSecretAccessKey.value = result.aws_secret_access_key;
        }
        if (result.aws_session_token) {
            elements.awsSessionToken.value = result.aws_session_token;
        }
        if (result.aws_region) {
            elements.awsRegion.value = result.aws_region;
        }
        if (result.aws_profile) {
            elements.awsProfile.value = result.aws_profile;
        }

    } catch (error) {
        console.error('❌ AWS CLI 인증 정보 로드 실패:', error);
    }
}

/**
 * AWS CLI 인증 정보 저장
 */
async function saveAWSCLICredentials() {
    try {
        const credentials = {
            accessKeyId: elements.awsAccessKeyId.value.trim(),
            secretAccessKey: elements.awsSecretAccessKey.value.trim(),
            sessionToken: elements.awsSessionToken.value.trim() || null,
            region: elements.awsRegion.value,
            profile: elements.awsProfile.value.trim() || 'default'
        };

        if (!credentials.accessKeyId || !credentials.secretAccessKey) {
            throw new Error('Access Key ID와 Secret Access Key는 필수입니다.');
        }

        const response = await chrome.runtime.sendMessage({
            type: 'SET_AWS_CLI_CREDENTIALS',
            data: { credentials }
        });

        if (response && response.success) {
            showNotification('✅ AWS CLI 인증 정보가 저장되었습니다.', 'success');
            await checkAuthStatus();
        } else {
            throw new Error(response?.error || 'AWS CLI 인증 정보 저장 실패');
        }

    } catch (error) {
        console.error('❌ AWS CLI 인증 정보 저장 실패:', error);
        showNotification(`❌ ${error.message}`, 'error');
    }
}

/**
 * AWS CLI 인증 정보 제거
 */
async function clearAWSCLICredentials() {
    try {
        if (!confirm('AWS CLI 인증 정보를 제거하시겠습니까? API Key 인증으로 전환됩니다.')) {
            return;
        }

        const response = await chrome.runtime.sendMessage({
            type: 'CLEAR_AWS_CLI_CREDENTIALS'
        });

        if (response && response.success) {
            // 입력 필드 초기화
            elements.awsAccessKeyId.value = '';
            elements.awsSecretAccessKey.value = '';
            elements.awsSessionToken.value = '';
            elements.awsRegion.value = 'us-west-2';
            elements.awsProfile.value = 'default';

            showNotification('✅ AWS CLI 인증 정보가 제거되었습니다.', 'success');
            await checkAuthStatus();
        } else {
            throw new Error(response?.error || 'AWS CLI 인증 정보 제거 실패');
        }

    } catch (error) {
        console.error('❌ AWS CLI 인증 정보 제거 실패:', error);
        showNotification(`❌ ${error.message}`, 'error');
    }
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
    // API Key 관련
    elements.toggleApiKey.addEventListener('click', toggleApiKeyVisibility);
    elements.testConnection.addEventListener('click', testConnection);
    elements.saveApiKey.addEventListener('click', saveApiKey);
    elements.apiKeyHelp.addEventListener('click', showApiKeyHelp);
    
    // 모델 관련
    elements.modelSelect.addEventListener('change', onModelSelectChange);
    elements.saveModel.addEventListener('click', saveModel);
    
    // 설정 관련
    elements.temperature.addEventListener('input', updateTemperatureDisplay);
    elements.saveSettings.addEventListener('click', saveSettings);
    
    // 통계 관련
    elements.resetStats.addEventListener('click', resetStatistics);
    
    // 실시간 유효성 검사
    elements.apiKey.addEventListener('input', validateApiKey);
    elements.maxTokens.addEventListener('input', validateMaxTokens);
}

/**
 * 지원 모델 목록 로드
 */
async function loadSupportedModels() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_SUPPORTED_MODELS'
        });
        
        if (response.success) {
            populateModelSelect(response.models);
            console.log('✅ 지원 모델 로드 완료:', response.models.length, '개');
        } else {
            console.warn('⚠️ 지원 모델 로드 실패:', response.error);
            elements.modelSelect.innerHTML = '<option value="">모델 로드 실패</option>';
        }
    } catch (error) {
        console.error('❌ 지원 모델 로드 오류:', error);
        elements.modelSelect.innerHTML = '<option value="">모델 로드 오류</option>';
    }
}

/**
 * 현재 선택된 모델 로드
 */
async function loadCurrentModel() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_CURRENT_MODEL'
        });
        
        if (response.success) {
            updateCurrentModelInfo(response.model);
            elements.modelSelect.value = response.model.key;
            console.log('✅ 현재 모델 로드 완료:', response.model.name);
        } else {
            console.warn('⚠️ 현재 모델 로드 실패:', response.error);
        }
    } catch (error) {
        console.error('❌ 현재 모델 로드 오류:', error);
    }
}

/**
 * 모델 선택 드롭다운 채우기
 */
function populateModelSelect(models) {
    elements.modelSelect.innerHTML = '';
    
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.key;
        option.textContent = `${model.name} (${model.provider})`;
        option.dataset.description = model.description;
        option.dataset.maxTokens = model.maxTokens;
        option.dataset.provider = model.provider;
        elements.modelSelect.appendChild(option);
    });
}

/**
 * 모델 선택 변경 처리
 */
function onModelSelectChange() {
    const selectedOption = elements.modelSelect.selectedOptions[0];
    if (selectedOption) {
        const description = selectedOption.dataset.description;
        elements.modelDescription.textContent = description;
        
        // 모델 정보 업데이트
        updateCurrentModelInfo({
            name: selectedOption.textContent,
            provider: selectedOption.dataset.provider,
            maxTokens: selectedOption.dataset.maxTokens
        });
        
        elements.modelInfo.style.display = 'block';
        elements.saveModel.disabled = false;
    } else {
        elements.modelDescription.textContent = '';
        elements.modelInfo.style.display = 'none';
        elements.saveModel.disabled = true;
    }
}

/**
 * 현재 모델 정보 업데이트
 */
function updateCurrentModelInfo(model) {
    elements.currentModelName.textContent = model.name;
    elements.currentModelProvider.textContent = model.provider;
    elements.currentModelMaxTokens.textContent = model.maxTokens;
    elements.modelInfo.style.display = 'block';
}

/**
 * 모델 저장
 */
async function saveModel() {
    const selectedModelKey = elements.modelSelect.value;
    
    if (!selectedModelKey) {
        showStatus('모델을 선택해주세요.', 'error');
        return;
    }
    
    try {
        elements.saveModel.disabled = true;
        elements.saveModel.textContent = '변경 중...';
        
        const response = await chrome.runtime.sendMessage({
            type: 'SET_MODEL',
            modelKey: selectedModelKey
        });
        
        if (response.success) {
            showStatus(`✅ ${response.message}`, 'success');
            updateCurrentModelInfo(response.model);
            console.log('✅ 모델 변경 완료:', response.model.name);
            
            // 최대 토큰 수 제한 업데이트
            const maxTokensLimit = response.model.maxTokens;
            elements.maxTokens.max = maxTokensLimit;
            if (parseInt(elements.maxTokens.value) > maxTokensLimit) {
                elements.maxTokens.value = maxTokensLimit;
            }
            
        } else {
            showStatus(`❌ 모델 변경 실패: ${response.error}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ 모델 변경 오류:', error);
        showStatus('모델 변경 중 오류가 발생했습니다.', 'error');
    } finally {
        elements.saveModel.disabled = false;
        elements.saveModel.textContent = '모델 변경';
    }
}
async function loadSettings() {
    try {
        const settings = await chrome.storage.sync.get([
            'bedrockApiKey',
            'useLocalAWSCLI',
            'awsProfile',
            'maxTokens',
            'temperature',
            'autoAnalyze'
        ]);
        
        const awsCliSettings = await chrome.storage.local.get([
            'aws_access_key_id',
            'aws_secret_access_key',
            'aws_session_token',
            'aws_region',
            'aws_profile'
        ]);
        
        // 인증 방식 결정 및 UI 설정
        if (settings.useLocalAWSCLI) {
            // 로컬 AWS CLI 사용
            elements.authLocalAWSCLI.checked = true;
            elements.localAwsCliSection.style.display = 'block';
            elements.awsCliSection.style.display = 'none';
            elements.apiKeySection.style.display = 'none';
            
            // 프로필 설정
            if (elements.awsProfile) {
                elements.awsProfile.value = settings.awsProfile || 'default';
            }
            if (elements.currentProfile) {
                elements.currentProfile.textContent = settings.awsProfile || 'default';
            }
            
            // 로컬 CLI용 API Key 설정 (마스킹하여 표시)
            if (settings.bedrockApiKey && elements.localCliApiKey) {
                elements.localCliApiKey.value = maskApiKey(settings.bedrockApiKey);
                elements.localCliApiKey.dataset.originalValue = settings.bedrockApiKey;
            }
        } else if (awsCliSettings.aws_access_key_id) {
            // AWS CLI 인증 정보 입력 방식
            elements.authAWSCLI.checked = true;
            elements.localAwsCliSection.style.display = 'none';
            elements.awsCliSection.style.display = 'block';
            elements.apiKeySection.style.display = 'none';
            
            // AWS CLI 설정 로드
            if (elements.awsAccessKeyId) {
                elements.awsAccessKeyId.value = awsCliSettings.aws_access_key_id;
            }
            if (elements.awsSecretAccessKey) {
                elements.awsSecretAccessKey.value = maskApiKey(awsCliSettings.aws_secret_access_key);
                elements.awsSecretAccessKey.dataset.originalValue = awsCliSettings.aws_secret_access_key;
            }
            if (elements.awsSessionToken && awsCliSettings.aws_session_token) {
                elements.awsSessionToken.value = awsCliSettings.aws_session_token;
            }
            if (elements.awsRegion) {
                elements.awsRegion.value = awsCliSettings.aws_region || 'us-west-2';
            }
        } else if (settings.bedrockApiKey) {
            // API Key 인증 방식
            elements.authAPIKey.checked = true;
            elements.localAwsCliSection.style.display = 'none';
            elements.awsCliSection.style.display = 'none';
            elements.apiKeySection.style.display = 'block';
            
            // API Key 설정 (마스킹하여 표시)
            elements.apiKey.value = maskApiKey(settings.bedrockApiKey);
            elements.apiKey.dataset.originalValue = settings.bedrockApiKey;
        } else {
            // 기본값: 로컬 AWS CLI 사용 권장
            elements.authLocalAWSCLI.checked = true;
            elements.localAwsCliSection.style.display = 'block';
            elements.awsCliSection.style.display = 'none';
            elements.apiKeySection.style.display = 'none';
        }
        
        // 모델 설정
        elements.maxTokens.value = settings.maxTokens || 4000;
        elements.temperature.value = settings.temperature || 0.1;
        elements.temperatureValue.textContent = settings.temperature || 0.1;
        elements.autoAnalyze.checked = settings.autoAnalyze !== false;
        
        console.log('✅ 설정 로드 완료');
    } catch (error) {
        console.error('❌ 설정 로드 실패:', error);
        showStatus('설정을 로드하는 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 통계 로드
 */
async function loadStatistics() {
    try {
        const stats = await chrome.storage.local.get([
            'totalChats',
            'totalTokens',
            'analyzedPages',
            'lastUsed'
        ]);
        
        elements.totalChats.textContent = stats.totalChats || 0;
        elements.totalTokens.textContent = (stats.totalTokens || 0).toLocaleString();
        elements.analyzedPages.textContent = stats.analyzedPages || 0;
        elements.lastUsed.textContent = stats.lastUsed ? 
            new Date(stats.lastUsed).toLocaleString('ko-KR') : '없음';
        
        console.log('✅ 통계 로드 완료');
    } catch (error) {
        console.error('❌ 통계 로드 실패:', error);
    }
}

/**
 * API Key 가시성 토글
 */
function toggleApiKeyVisibility() {
    const isPassword = elements.apiKey.type === 'password';
    elements.apiKey.type = isPassword ? 'text' : 'password';
    elements.toggleApiKey.textContent = isPassword ? '🙈' : '👁️';
    
    // 마스킹된 값이면 원본 값으로 복원
    if (isPassword && elements.apiKey.dataset.originalValue) {
        elements.apiKey.value = elements.apiKey.dataset.originalValue;
    }
}

/**
 * API Key 마스킹
 */
function maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) return apiKey;
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
}

/**
 * API Key 유효성 검사
 */
function validateApiKey() {
    const apiKey = elements.apiKey.value.trim();
    const isValid = apiKey.length > 0 && !apiKey.includes('*');
    
    elements.saveApiKey.disabled = !isValid;
    elements.testConnection.disabled = !isValid;
    
    if (apiKey && !apiKey.includes('*')) {
        elements.apiKey.dataset.originalValue = apiKey;
    }
}

/**
 * 최대 토큰 수 유효성 검사
 */
function validateMaxTokens() {
    const value = parseInt(elements.maxTokens.value);
    if (value < 100) elements.maxTokens.value = 100;
    if (value > 8000) elements.maxTokens.value = 8000;
}

/**
 * Temperature 값 표시 업데이트
 */
function updateTemperatureDisplay() {
    elements.temperatureValue.textContent = elements.temperature.value;
}

/**
 * 연결 테스트
 */
async function testConnection() {
    const apiKey = elements.apiKey.dataset.originalValue || elements.apiKey.value.trim();
    
    if (!apiKey || apiKey.includes('*')) {
        showStatus('유효한 API Key를 입력해주세요.', 'error');
        return;
    }
    
    // 버튼 상태 변경
    elements.testConnection.disabled = true;
    elements.testConnection.textContent = '테스트 중...';
    
    try {
        // 임시로 API Key 저장
        await chrome.storage.sync.set({ bedrockApiKey: apiKey });
        
        // Background Script에 연결 테스트 요청
        const response = await chrome.runtime.sendMessage({
            type: 'TEST_CONNECTION'
        });
        
        if (response.success) {
            showStatus('✅ 연결 테스트 성공! API Key가 정상적으로 작동합니다.', 'success');
            console.log('연결 테스트 응답:', response.response);
        } else {
            showStatus(`❌ 연결 테스트 실패: ${response.error}`, 'error');
        }
        
    } catch (error) {
        console.error('연결 테스트 오류:', error);
        showStatus(`❌ 연결 테스트 중 오류 발생: ${error.message}`, 'error');
    } finally {
        // 버튼 상태 복원
        elements.testConnection.disabled = false;
        elements.testConnection.textContent = '연결 테스트';
    }
}

/**
 * 인증 설정 저장 (통합)
 */
async function saveApiKey() {
    try {
        // 선택된 인증 방식 확인
        let authMethod = 'api-key'; // 기본값
        if (elements.authLocalAWSCLI?.checked) {
            authMethod = 'local-aws-cli';
        } else if (elements.authAWSCLI?.checked) {
            authMethod = 'aws-cli';
        } else if (elements.authAPIKey?.checked) {
            authMethod = 'api-key';
        }

        console.log('💾 인증 설정 저장 시작:', authMethod);

        switch (authMethod) {
            case 'local-aws-cli':
                await saveLocalAWSCLISettings();
                break;
            case 'aws-cli':
                await saveAWSCLISettings();
                break;
            case 'api-key':
                await saveAPIKeySettings();
                break;
        }

        // Background Script에 재초기화 요청
        chrome.runtime.sendMessage({ type: 'INITIALIZE_BEDROCK' });
        
        console.log('✅ 인증 설정 저장 완료');
    } catch (error) {
        console.error('❌ 인증 설정 저장 실패:', error);
        showStatus('인증 설정 저장 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 로컬 AWS CLI 설정 저장
 */
async function saveLocalAWSCLISettings() {
    const profile = elements.awsProfile?.value.trim() || 'default';
    const apiKey = elements.localCliApiKey?.dataset.originalValue || elements.localCliApiKey?.value.trim();
    
    if (!apiKey || apiKey.includes('*')) {
        showStatus('로컬 AWS CLI 사용을 위해 API Key를 입력해주세요.', 'error');
        return;
    }
    
    await chrome.storage.sync.set({ 
        useLocalAWSCLI: true,
        awsProfile: profile,
        bedrockApiKey: apiKey  // API Key도 함께 저장
    });
    
    // 다른 인증 방식 설정 제거
    await chrome.storage.local.remove([
        'aws_access_key_id',
        'aws_secret_access_key',
        'aws_session_token',
        'aws_region'
    ]);
    
    // API Key 마스킹하여 표시
    if (elements.localCliApiKey) {
        elements.localCliApiKey.value = maskApiKey(apiKey);
        elements.localCliApiKey.dataset.originalValue = apiKey;
        elements.localCliApiKey.type = 'password';
        elements.toggleLocalCliApiKey.textContent = '👁️';
    }
    
    showStatus('✅ 로컬 AWS CLI 설정이 저장되었습니다.', 'success');
}

/**
 * AWS CLI 인증 정보 저장
 */
async function saveAWSCLISettings() {
    const accessKeyId = elements.awsAccessKeyId?.value.trim();
    const secretAccessKey = elements.awsSecretAccessKey?.value.trim();
    const sessionToken = elements.awsSessionToken?.value.trim();
    const region = elements.awsRegion?.value.trim() || 'us-west-2';
    const profile = elements.awsProfile?.value.trim() || 'default';
    
    if (!accessKeyId || !secretAccessKey) {
        showStatus('Access Key ID와 Secret Access Key를 입력해주세요.', 'error');
        return;
    }
    
    await chrome.storage.local.set({
        aws_access_key_id: accessKeyId,
        aws_secret_access_key: secretAccessKey,
        aws_session_token: sessionToken || null,
        aws_region: region,
        aws_profile: profile
    });
    
    // 다른 인증 방식 설정 제거
    await chrome.storage.sync.remove(['bedrockApiKey', 'useLocalAWSCLI']);
    
    showStatus('✅ AWS CLI 인증 정보가 저장되었습니다.', 'success');
}

/**
 * API Key 설정 저장
 */
async function saveAPIKeySettings() {
    const apiKey = elements.apiKey.dataset.originalValue || elements.apiKey.value.trim();
    
    if (!apiKey || apiKey.includes('*')) {
        showStatus('유효한 API Key를 입력해주세요.', 'error');
        return;
    }
    
    await chrome.storage.sync.set({ bedrockApiKey: apiKey });
    
    // 다른 인증 방식 설정 제거
    await chrome.storage.sync.remove(['useLocalAWSCLI']);
    await chrome.storage.local.remove([
        'aws_access_key_id',
        'aws_secret_access_key',
        'aws_session_token',
        'aws_region',
        'aws_profile'
    ]);
    
    // API Key 마스킹하여 표시
    elements.apiKey.value = maskApiKey(apiKey);
    elements.apiKey.dataset.originalValue = apiKey;
    elements.apiKey.type = 'password';
    elements.toggleApiKey.textContent = '👁️';
    
    showStatus('✅ API Key가 안전하게 저장되었습니다.', 'success');
}

/**
 * 설정 저장
 */
async function saveSettings() {
    try {
        const settings = {
            maxTokens: parseInt(elements.maxTokens.value),
            temperature: parseFloat(elements.temperature.value),
            autoAnalyze: elements.autoAnalyze.checked
        };
        
        await chrome.storage.sync.set(settings);
        
        showStatus('✅ 설정이 저장되었습니다.', 'success');
        console.log('✅ 설정 저장 완료:', settings);
        
        // 잠시 후 상태 메시지 숨김
        setTimeout(() => {
            hideStatus();
        }, 3000);
        
    } catch (error) {
        console.error('❌ 설정 저장 실패:', error);
        showStatus('설정 저장 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 통계 초기화
 */
async function resetStatistics() {
    if (!confirm('정말로 모든 사용 통계를 초기화하시겠습니까?')) {
        return;
    }
    
    try {
        await chrome.storage.local.remove([
            'totalChats',
            'totalTokens',
            'analyzedPages',
            'lastUsed'
        ]);
        
        // UI 업데이트
        elements.totalChats.textContent = '0';
        elements.totalTokens.textContent = '0';
        elements.analyzedPages.textContent = '0';
        elements.lastUsed.textContent = '없음';
        
        showStatus('✅ 사용 통계가 초기화되었습니다.', 'success');
        console.log('✅ 통계 초기화 완료');
        
    } catch (error) {
        console.error('❌ 통계 초기화 실패:', error);
        showStatus('통계 초기화 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * API Key 도움말 표시
 */
function showApiKeyHelp(event) {
    event.preventDefault();
    
    const helpText = `
AWS Bedrock API Key 발급 방법:

1. AWS 콘솔(https://console.aws.amazon.com)에 로그인
2. Bedrock 서비스로 이동
3. 좌측 메뉴에서 "API Keys" 선택
4. "Create API Key" 버튼 클릭
5. 키 이름과 권한 설정 후 생성
6. 생성된 API Key를 복사하여 입력란에 붙여넣기

주의사항:
- API Key는 생성 시에만 확인 가능합니다
- 안전한 곳에 보관하고 타인과 공유하지 마세요
- 정기적으로 키를 교체하는 것을 권장합니다
    `;
    
    alert(helpText);
}

/**
 * 상태 메시지 표시
 */
function showStatus(message, type = 'info') {
    elements.connectionStatus.textContent = message;
    elements.connectionStatus.className = `status-message ${type}`;
    elements.connectionStatus.style.display = 'block';
    
    // 자동으로 숨김 (에러가 아닌 경우)
    if (type !== 'error') {
        setTimeout(hideStatus, 5000);
    }
}

/**
 * 상태 메시지 숨김
 */
function hideStatus() {
    elements.connectionStatus.style.display = 'none';
}

/**
 * 페이지 언로드 시 정리
 */
window.addEventListener('beforeunload', () => {
    console.log('🔄 설정 페이지 언로드됨');
});

console.log('🎯 설정 페이지 스크립트 로드 완료');

/**
 * AWS AI Assistant 설정 페이지 JavaScript
 * AWS CLI 인증과 API Key 인증 지원
 */

// DOM 요소들
const elements = {
    // API Key 인증 요소들
    apiKey: document.getElementById('apiKey'),
    toggleApiKey: document.getElementById('toggleApiKey'),
    apiKeySection: document.getElementById('apiKeySection'),
    
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
    saveSettings: document.getElementById('saveSettings')
};

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 설정 페이지 로드됨');
    
    // 비밀번호 토글 이벤트 리스너
    setupPasswordToggleListeners();
    
    await loadSettings();
    await loadSupportedModels();
    await loadCurrentModel();
    // 현재 인증 상태 확인
    await checkAuthStatus();
    
    setupEventListeners();
    
    console.log('✅ 설정 페이지 초기화 완료');
});

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
            
            // 상태 표시 업데이트
            elements.authStatusIndicator.textContent = '✅';
            elements.authStatusIndicator.className = 'status-indicator connected';
            elements.authStatusText.textContent = `API Key 인증 활성화 (${authInfo.region})`;

        } else {
            elements.authStatusIndicator.textContent = '❌';
            elements.authStatusIndicator.className = 'status-indicator error';
            elements.authStatusText.textContent = response?.error || 'API Key가 설정되지 않았습니다';
        }

    } catch (error) {
        console.error('❌ 인증 상태 확인 실패:', error);
        elements.authStatusIndicator.textContent = '❌';
        elements.authStatusIndicator.className = 'status-indicator error';
        elements.authStatusText.textContent = '인증 상태 확인 실패';
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
    
    // 모델 관련
    elements.modelSelect.addEventListener('change', onModelSelectChange);
    elements.saveModel.addEventListener('click', saveModel);
    
    // 설정 관련
    elements.temperature.addEventListener('input', updateTemperatureDisplay);
    elements.saveSettings.addEventListener('click', saveSettings);
    
    // 실시간 유효성 검사
    elements.apiKey?.addEventListener('input', validateApiKey);
    elements.maxTokens?.addEventListener('input', validateMaxTokens);
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
            'maxTokens',
            'temperature',
            'autoAnalyze'
        ]);
        
        // API Key 설정 로드
        if (settings.bedrockApiKey) {
            // API Key 설정 (마스킹하여 표시)
            elements.apiKey.value = maskApiKey(settings.bedrockApiKey);
            elements.apiKey.dataset.originalValue = settings.bedrockApiKey;
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
    const apiKey = elements.apiKey?.value.trim();
    const isValid = apiKey && apiKey.length > 0 && !apiKey.includes('*');
    
    if (apiKey && !apiKey.includes('*')) {
        elements.apiKey.dataset.originalValue = apiKey;
    }
    
    // 버튼 상태 업데이트
    if (elements.saveApiKey) {
        elements.saveApiKey.disabled = !isValid;
    }
    if (elements.testConnection) {
        elements.testConnection.disabled = !isValid;
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
    console.log('🔍 연결 테스트 시작: API Key 인증');

    // 버튼 상태 변경
    elements.testConnection.disabled = true;
    elements.testConnection.textContent = '테스트 중...';
    showStatus('연결 테스트 중...', 'info');
    
    try {
        // API Key 인증 확인
        const apiKey = elements.apiKey.dataset.originalValue || elements.apiKey.value.trim();
        
        if (!apiKey || apiKey.includes('*')) {
            showStatus('유효한 API Key를 입력해주세요.', 'error');
            return;
        }

        // API Key 임시 저장
        await chrome.storage.sync.set({ bedrockApiKey: apiKey });

        // Background Script에 연결 테스트 요청
        const response = await chrome.runtime.sendMessage({
            type: 'TEST_CONNECTION'
        });
        
        if (response.success) {
            showStatus('✅ 연결 테스트 성공! API Key 인증이 정상적으로 작동합니다.', 'success');
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
 * API Key 설정 저장
 */
async function saveApiKey() {
    try {
        console.log('💾 API Key 설정 저장 시작');

        await saveAPIKeySettings();

        // Background Script에 재초기화 요청
        chrome.runtime.sendMessage({ type: 'INITIALIZE_BEDROCK' });
        
        console.log('✅ API Key 설정 저장 완료');
    } catch (error) {
        console.error('❌ API Key 설정 저장 실패:', error);
        showStatus('API Key 설정 저장 중 오류가 발생했습니다.', 'error');
    }
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
    
    // API Key 마스킹하여 표시
    elements.apiKey.value = maskApiKey(apiKey);
    elements.apiKey.dataset.originalValue = apiKey;
    elements.apiKey.type = 'password';
    elements.toggleApiKey.textContent = '👁️';
    
    showStatus('✅ API Key가 저장되었습니다.', 'success');
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

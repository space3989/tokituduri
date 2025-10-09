// アプリケーション設定
const CONFIG = {
    DEFAULT_SYSTEM_PROMPT: 'あなたは親しみやすく共感的な日記アシスタントです。ユーザーとの自然な会話を通じて、日記作成をサポートしてください。ユーザーの話を聞き、適切なタイミングで感情や体験について掘り下げ質問をしてください。会話が十分に進んだら、内容を整理して素敵な日記エントリーを作成してください。',
    DEFAULT_MODEL: 'gpt-3.5-turbo'
};

// グローバル変数
let isSpeechSynthesisSupported = false;
let chatHistory = [];
let speechRecognition = null;
let isRecording = false;
let currentAudio = null;
let isAppInitialized = false;
let isSpeechSupported = false;
let hasMediaPermission = false;
let currentApiKey = '';
let currentModel = CONFIG.DEFAULT_MODEL;
let voiceSettings = {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0
};

// アプリ初期化
document.addEventListener('DOMContentLoaded', function() {
    if (!isAppInitialized) {
        initializeApp();
    }
});

function initializeApp() {
    console.log('アプリケーション初期化開始');
    
    // 初期化フラグを設定
    isAppInitialized = true;
    
    // 設定を読み込み
    loadSettings();
    
    // 初期状態で全てのモーダルを強制的に非表示
    forceHideAllModals();
    
    // 音声認識サポート状況をチェック
    checkSpeechSupport();
    
    // 音声合成サポート状況をチェック
    checkSpeechSynthesisSupport();
    
    // ナビゲーション設定
    setupNavigation();
    
    // チャット機能設定
    setupChat();
    
    // 音声認識コントロール設定
    setupSpeechRecognitionControls();
    
    // 許可モーダル設定
    setupPermissionModal();
    
    // 設定画面設定
    setupSettings();
    
    // 日記一覧読み込み
    loadDiaryList();
    
    console.log('アプリケーションが初期化されました');
}

// 設定を読み込み
function loadSettings() {
    try {
        // APIキー
        const savedApiKey = localStorage.getItem('openai-api-key');
        if (savedApiKey) {
            currentApiKey = savedApiKey;
            const apiKeyInput = document.getElementById('api-key-input');
            if (apiKeyInput) {
                apiKeyInput.value = savedApiKey;
            }
        }
        
        // モデル
        const savedModel = localStorage.getItem('openai-model');
        if (savedModel) {
            currentModel = savedModel;
            const modelSelect = document.getElementById('model-select');
            if (modelSelect) {
                modelSelect.value = savedModel;
            }
        }
        
        // 音声設定
        const savedVoiceSettings = localStorage.getItem('voice-settings');
        if (savedVoiceSettings) {
            voiceSettings = JSON.parse(savedVoiceSettings);
            const rateInput = document.getElementById('voice-rate');
            const pitchInput = document.getElementById('voice-pitch');
            const rateValue = document.getElementById('voice-rate-value');
            const pitchValue = document.getElementById('voice-pitch-value');
            
            if (rateInput) {
                rateInput.value = voiceSettings.rate;
                if (rateValue) rateValue.textContent = voiceSettings.rate;
            }
            if (pitchInput) {
                pitchInput.value = voiceSettings.pitch;
                if (pitchValue) pitchValue.textContent = voiceSettings.pitch;
            }
        }
    } catch (error) {
        console.error('設定読み込みエラー:', error);
    }
}

// 音声認識サポート状況チェック
function checkSpeechSupport() {
    const statusElement = document.getElementById('speech-support-status');
    
    if (!statusElement) return;
    
    // Web Speech API サポート確認
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        isSpeechSupported = false;
        statusElement.className = 'status status--error';
        statusElement.textContent = '非対応ブラウザ';
        console.log('音声認識非対応ブラウザ');
        return;
    }
    
    // HTTPS/localhost チェック
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    
    if (!isSecure) {
        isSpeechSupported = false;
        statusElement.className = 'status status--warning';
        statusElement.textContent = 'HTTPSが必要';
        console.log('HTTPS接続が必要');
        return;
    }
    
    isSpeechSupported = true;
    statusElement.className = 'status status--success';
    statusElement.textContent = '対応済み';
    console.log('音声認識サポート確認完了');
}

// 音声合成サポート状況チェック
function checkSpeechSynthesisSupport() {
    const statusElement = document.getElementById('voicevox-status');
    const setupElement = document.getElementById('voicevox-setup');
    
    if (!statusElement || !setupElement) {
        console.error('音声合成状態要素が見つかりません');
        return;
    }
    
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices) {
        isSpeechSynthesisSupported = true;
        statusElement.className = 'status status--success';
        statusElement.textContent = '音声合成対応';
        setupElement.classList.add('hidden');
        console.log('音声合成サポート確認完了');
    } else {
        isSpeechSynthesisSupported = false;
        statusElement.className = 'status status--error';
        statusElement.textContent = '音声合成非対応';
        setupElement.classList.remove('hidden');
        console.log('音声合成非対応ブラウザ');
    }
}

// 全てのモーダルを強制的に非表示
function forceHideAllModals() {
    console.log('全てのモーダルを非表示にします');
    
    const modals = ['loading-overlay', 'voice-recording', 'permission-modal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    });
    
    // 録音状態をリセット
    isRecording = false;
    
    // 音声認識があれば停止
    if (speechRecognition) {
        try {
            speechRecognition.abort();
        } catch (e) {
            console.log('音声認識停止:', e);
        }
        speechRecognition = null;
    }
}

// ナビゲーション設定
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const targetScreen = this.getAttribute('data-screen');
            switchScreen(targetScreen);
            
            // アクティブ状態更新
            navButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function switchScreen(screenName) {
    // 音声録音中の場合は停止
    if (isRecording) {
        stopVoiceInput();
    }
    
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    const targetScreen = document.getElementById(`${screenName}-screen`);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    
    console.log(`画面切り替え: ${screenName}`);
}

// チャット機能設定
function setupChat() {
    const sendButton = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    const clearButton = document.getElementById('clear-chat-btn');
    const saveButton = document.getElementById('save-diary-btn');
    const voiceInputButton = document.getElementById('voice-input-btn');
    const speakerSelect = document.getElementById('speaker-select');
    
    if (!sendButton || !chatInput) {
        console.error('チャット要素が見つかりません');
        return;
    }
    
    // 送信ボタン
    sendButton.addEventListener('click', function(e) {
        e.preventDefault();
        sendMessage();
    });
    
    // Enterキーで送信（Shift+Enterで改行）
    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // チャットクリア
    if (clearButton) {
        clearButton.addEventListener('click', function(e) {
            e.preventDefault();
            clearChat();
        });
    }
    
    // 日記保存
    if (saveButton) {
        saveButton.addEventListener('click', function(e) {
            e.preventDefault();
            saveDiary();
        });
    }
    
    // 音声入力
    if (voiceInputButton) {
        voiceInputButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleVoiceInputClick();
        });
        
        // 音声認識非対応の場合はボタンを無効化
        if (!isSpeechSupported) {
            voiceInputButton.disabled = true;
            voiceInputButton.textContent = '❌ 音声入力';
            voiceInputButton.title = '音声認識がサポートされていません';
        }
    }
    
    // 話者選択（Web Speech APIでは使わないが、UIとの互換性のため残す）
    if (speakerSelect) {
        speakerSelect.addEventListener('change', function() {
            console.log('話者選択変更（Web Speech APIでは無効）:', this.value);
        });
    }
    
    // 音声再生ボタンの設定
    setupVoicePlayButtons();
}

// 設定画面設定
function setupSettings() {
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const apiKeyInput = document.getElementById('api-key-input');
    const modelSelect = document.getElementById('model-select');
    const voiceRateInput = document.getElementById('voice-rate');
    const voicePitchInput = document.getElementById('voice-pitch');
    const voiceRateValue = document.getElementById('voice-rate-value');
    const voicePitchValue = document.getElementById('voice-pitch-value');
    const testVoiceBtn = document.getElementById('test-voice-btn');
    const exportDataBtn = document.getElementById('export-data-btn');
    const importDataBtn = document.getElementById('import-data-btn');
    const importFile = document.getElementById('import-file');
    const clearAllDataBtn = document.getElementById('clear-all-data-btn');
    
    // APIキー保存
    if (saveApiKeyBtn && apiKeyInput) {
        saveApiKeyBtn.addEventListener('click', function() {
            const apiKey = apiKeyInput.value.trim();
            if (apiKey && apiKey.startsWith('sk-')) {
                localStorage.setItem('openai-api-key', apiKey);
                currentApiKey = apiKey;
                alert('APIキーが保存されました！');
            } else {
                alert('正しいAPIキーを入力してください（sk-で始まる文字列）');
            }
        });
    }
    
    // モデル選択
    if (modelSelect) {
        modelSelect.addEventListener('change', function() {
            currentModel = this.value;
            localStorage.setItem('openai-model', currentModel);
            console.log('モデル変更:', currentModel);
        });
    }
    
    // 音声設定
    if (voiceRateInput && voiceRateValue) {
        voiceRateInput.addEventListener('input', function() {
            voiceSettings.rate = parseFloat(this.value);
            voiceRateValue.textContent = this.value;
            localStorage.setItem('voice-settings', JSON.stringify(voiceSettings));
        });
    }
    
    if (voicePitchInput && voicePitchValue) {
        voicePitchInput.addEventListener('input', function() {
            voiceSettings.pitch = parseFloat(this.value);
            voicePitchValue.textContent = this.value;
            localStorage.setItem('voice-settings', JSON.stringify(voiceSettings));
        });
    }
    
    // 音声テスト
    if (testVoiceBtn) {
        testVoiceBtn.addEventListener('click', function() {
            playVoice('こんにちは！これは音声テストです。設定が正しく反映されていますか？', this);
        });
    }
    
    // データエクスポート
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', function() {
            exportAllData();
        });
    }
    
    // データインポート
    if (importDataBtn && importFile) {
        importDataBtn.addEventListener('click', function() {
            importFile.click();
        });
        
        importFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                importAllData(file);
            }
        });
    }
    
    // 全データ削除
    if (clearAllDataBtn) {
        clearAllDataBtn.addEventListener('click', function() {
            if (confirm('本当に全てのデータを削除しますか？この操作は取り消せません。')) {
                if (confirm('確認：全ての日記とチャット履歴が削除されます。よろしいですか？')) {
                    localStorage.clear();
                    alert('全てのデータが削除されました。ページをリロードします。');
                    location.reload();
                }
            }
        });
    }
}

// データエクスポート
function exportAllData() {
    try {
        const data = {
            diaries: getDiariesFromStorage(),
            settings: {
                model: currentModel,
                voiceSettings: voiceSettings
            },
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `時綴_データ_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        console.log('データエクスポート完了');
    } catch (error) {
        console.error('データエクスポートエラー:', error);
        alert('データのエクスポートに失敗しました。');
    }
}

// データインポート
function importAllData(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.diaries) {
                localStorage.setItem('aiDiaries', JSON.stringify(data.diaries));
            }
            
            if (data.settings) {
                if (data.settings.model) {
                    currentModel = data.settings.model;
                    localStorage.setItem('openai-model', currentModel);
                }
                if (data.settings.voiceSettings) {
                    voiceSettings = data.settings.voiceSettings;
                    localStorage.setItem('voice-settings', JSON.stringify(voiceSettings));
                }
            }
            
            alert('データのインポートが完了しました。ページをリロードします。');
            location.reload();
            
        } catch (error) {
            console.error('データインポートエラー:', error);
            alert('データのインポートに失敗しました。ファイル形式を確認してください。');
        }
    };
    
    reader.readAsText(file);
}

// 音声入力ボタンクリック処理
async function handleVoiceInputClick() {
    console.log('音声入力ボタンがクリックされました');
    
    if (!isSpeechSupported) {
        alert('このブラウザまたは環境では音声認識がサポートされていません。');
        return;
    }
    
    // 現在録音中の場合は停止
    if (isRecording) {
        stopVoiceInput();
        return;
    }
    
    // マイク権限確認
    if (!hasMediaPermission) {
        const granted = await requestMicrophonePermission();
        if (!granted) {
            return;
        }
    }
    
    // 音声認識を初期化して開始
    initializeSpeechRecognition();
    startVoiceInput();
}

// マイク権限要求
async function requestMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // 権限が得られたらストリームを停止
        stream.getTracks().forEach(track => track.stop());
        hasMediaPermission = true;
        console.log('マイク権限取得成功');
        return true;
    } catch (error) {
        console.error('マイク権限エラー:', error);
        
        let errorMessage = '音声入力を使用するためには、マイクへのアクセス許可が必要です。\n\n';
        
        if (error.name === 'NotAllowedError') {
            errorMessage += 'ブラウザの設定でマイクアクセスを許可してください。';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'マイクが見つかりません。デバイスの接続を確認してください。';
        } else {
            errorMessage += 'マイクアクセスエラーが発生しました。';
        }
        
        alert(errorMessage);
        return false;
    }
}

// 許可モーダル設定
function setupPermissionModal() {
    const grantBtn = document.getElementById('grant-permission-btn');
    const cancelBtn = document.getElementById('cancel-permission-btn');
    
    if (grantBtn) {
        grantBtn.addEventListener('click', async function() {
            hidePermissionModal();
            await requestMicrophonePermission();
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            hidePermissionModal();
        });
    }
}

function showPermissionModal() {
    const modal = document.getElementById('permission-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

function hidePermissionModal() {
    const modal = document.getElementById('permission-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

// 音声入力開始
function startVoiceInput() {
    if (!speechRecognition) {
        console.error('音声認識が初期化されていません');
        return;
    }
    
    try {
        speechRecognition.start();
        console.log('音声認識開始要求');
    } catch (error) {
        console.error('音声認識開始エラー:', error);
        alert('音声認識の開始に失敗しました。');
        hideVoiceRecordingModal();
    }
}

// 音声入力停止
function stopVoiceInput() {
    console.log('音声入力停止要求');
    
    if (speechRecognition && isRecording) {
        try {
            speechRecognition.stop();
        } catch (error) {
            console.log('音声認識停止エラー:', error);
        }
    }
    
    // 強制的にモーダルを非表示
    hideVoiceRecordingModal();
    isRecording = false;
}

// 音声録音モーダルを表示
function showVoiceRecordingModal() {
    const voiceRecording = document.getElementById('voice-recording');
    if (voiceRecording) {
        voiceRecording.classList.remove('hidden');
        voiceRecording.style.display = 'flex';
    }
}

// 音声録音モーダルを非表示
function hideVoiceRecordingModal() {
    const voiceRecording = document.getElementById('voice-recording');
    if (voiceRecording) {
        voiceRecording.classList.add('hidden');
        voiceRecording.style.display = 'none';
    }
}

// 音声認識初期化
function initializeSpeechRecognition() {
    // 既存の音声認識があれば停止
    if (speechRecognition) {
        try {
            speechRecognition.abort();
        } catch (e) {
            console.log('既存の音声認識を停止:', e);
        }
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new SpeechRecognition();
    
    // Android端末での設定調整
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    speechRecognition.lang = 'ja-JP';
    speechRecognition.continuous = true;
    speechRecognition.interimResults = !isAndroid; // Androidでは false
    speechRecognition.maxAlternatives = 1;
    
    speechRecognition.onstart = function() {
        console.log('音声認識開始イベント');
        isRecording = true;
        showVoiceRecordingModal();
        
        // ボタンの表示を更新
        const voiceBtn = document.getElementById('voice-input-btn');
        if (voiceBtn) {
            voiceBtn.textContent = '⏹️ 録音停止';
            voiceBtn.classList.add('btn--error');
        }
    };
    
    speechRecognition.onresult = function(event) {
        console.log('音声認識結果イベント');
        let transcript = '';
        
        // 最終結果を取得
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                transcript += event.results[i][0].transcript;
            }
        }
        
        if (transcript.trim()) {
            const chatInput = document.getElementById('chat-input');
            if (chatInput) {
                // 既存のテキストに追加
                const currentText = chatInput.value.trim();
                chatInput.value = currentText ? currentText + ' ' + transcript : transcript;
            }
            console.log('認識結果:', transcript);
        }
    };
    
    speechRecognition.onend = function() {
        console.log('音声認識終了イベント');
        isRecording = false;
        hideVoiceRecordingModal();
        
        // ボタンの表示を元に戻す
        const voiceBtn = document.getElementById('voice-input-btn');
        if (voiceBtn) {
            voiceBtn.textContent = '🎤 音声入力';
            voiceBtn.classList.remove('btn--error');
        }
    };
    
    speechRecognition.onerror = function(event) {
        console.error('音声認識エラー:', event.error);
        isRecording = false;
        hideVoiceRecordingModal();
        
        // ボタンの表示を元に戻す
        const voiceBtn = document.getElementById('voice-input-btn');
        if (voiceBtn) {
            voiceBtn.textContent = '🎤 音声入力';
            voiceBtn.classList.remove('btn--error');
        }
        
        // エラーメッセージの表示
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
            let errorMsg = '音声認識エラーが発生しました。';
            
            switch (event.error) {
                case 'not-allowed':
                    errorMsg = 'マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。';
                    hasMediaPermission = false;
                    break;
                case 'network':
                    errorMsg = 'ネットワークエラーが発生しました。';
                    break;
                case 'service-not-allowed':
                    errorMsg = '音声認識サービスが利用できません。';
                    break;
                default:
                    errorMsg += `（エラー: ${event.error}）`;
            }
            
            alert(errorMsg);
        }
    };
}

// 音声認識コントロール設定
function setupSpeechRecognitionControls() {
    const stopRecordingBtn = document.getElementById('stop-recording-btn');
    if (stopRecordingBtn) {
        stopRecordingBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('録音停止ボタンがクリックされました');
            stopVoiceInput();
        });
    }
}

// メッセージ送信
async function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // APIキーチェック
    if (!currentApiKey) {
        alert('OpenAI APIキーが設定されていません。設定画面でAPIキーを入力してください。');
        switchScreen('settings');
        return;
    }
    
    console.log('メッセージ送信:', message);
    
    // ユーザーメッセージ表示
    addMessage(message, 'user');
    chatInput.value = '';
    
    // チャット履歴に追加
    chatHistory.push({ role: 'user', content: message });
    
    // AI応答を取得
    await getAIResponse();
}

// AI応答取得
async function getAIResponse() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
        loadingOverlay.style.display = 'flex';
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentApiKey}`
            },
            body: JSON.stringify({
                model: currentModel,
                messages: [
                    { role: 'system', content: CONFIG.DEFAULT_SYSTEM_PROMPT },
                    ...chatHistory
                ],
                max_tokens: 500,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        const aiMessage = data.choices[0].message.content;
        
        // AI応答を表示
        addMessage(aiMessage, 'ai');
        
        // チャット履歴に追加
        chatHistory.push({ role: 'assistant', content: aiMessage });
        
        console.log('AI応答取得成功');
        
    } catch (error) {
        console.error('AI応答エラー:', error);
        let errorMessage = '申し訳ございません。エラーが発生しました。';
        
        if (error.message.includes('401')) {
            errorMessage = 'APIキーが無効です。設定画面で正しいAPIキーを入力してください。';
        } else if (error.message.includes('429')) {
            errorMessage = 'API利用制限に達しました。しばらく時間をおいてから再試行してください。';
        } else if (error.message.includes('500')) {
            errorMessage = 'OpenAI APIサーバーでエラーが発生しています。しばらく時間をおいてから再試行してください。';
        }
        
        addMessage(errorMessage, 'ai');
    } finally {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            loadingOverlay.style.display = 'none';
        }
    }
}

// メッセージ表示
function addMessage(text, sender) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const messageText = document.createElement('p');
    messageText.textContent = text;
    messageContent.appendChild(messageText);
    
    // AI メッセージに音声再生ボタンを追加
    if (sender === 'ai') {
        const voiceButton = document.createElement('button');
        voiceButton.className = 'voice-play-btn';
        voiceButton.textContent = '🔊';
        voiceButton.setAttribute('data-text', text);
        voiceButton.addEventListener('click', () => playVoice(text, voiceButton));
        messageContent.appendChild(voiceButton);
    }
    
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // スクロールを下に移動
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 音声再生ボタン設定
function setupVoicePlayButtons() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('voice-play-btn')) {
            const text = e.target.getAttribute('data-text');
            playVoice(text, e.target);
        }
    });
}

// Web Speech API音声再生
function playVoice(text, button) {
    if (!isSpeechSynthesisSupported) {
        alert('このブラウザでは音声合成がサポートされていません。');
        return;
    }
    
    // 既存の音声を停止
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    button.disabled = true;
    button.textContent = '🔄';
    
    try {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // 日本語設定
        utterance.lang = 'ja-JP';
        
        // 音声設定
        utterance.rate = voiceSettings.rate;
        utterance.pitch = voiceSettings.pitch;
        utterance.volume = voiceSettings.volume;
        
        // 日本語音声を取得
        const voices = speechSynthesis.getVoices();
        const japaneseVoice = voices.find(voice => voice.lang === 'ja-JP');
        if (japaneseVoice) {
            utterance.voice = japaneseVoice;
        }
        
        utterance.onstart = () => {
            console.log('音声再生開始');
        };
        
        utterance.onend = () => {
            button.disabled = false;
            button.textContent = '🔊';
            console.log('音声再生完了');
        };
        
        utterance.onerror = (event) => {
            button.disabled = false;
            button.textContent = '🔊';
            console.error('音声再生エラー:', event.error);
            alert('音声再生に失敗しました。');
        };
        
        speechSynthesis.speak(utterance);
        console.log('Web Speech API音声再生開始');
        
    } catch (error) {
        console.error('Web Speech API音声再生エラー:', error);
        button.disabled = false;
        button.textContent = '🔊';
        alert('音声再生に失敗しました。');
    }
}

// チャットクリア
function clearChat() {
    if (confirm('チャット履歴をクリアしますか？')) {
        chatHistory = [];
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = `
                <div class="message ai-message">
                    <div class="message-content">
                        <p>こんにちは！今日はどんな一日でしたか？お話を聞かせてください。</p>
                        <button class="voice-play-btn" data-text="こんにちは！今日はどんな一日でしたか？お話を聞かせてください。">🔊</button>
                    </div>
                </div>
            `;
        }
        console.log('チャット履歴をクリアしました');
    }
}

// 日記保存
async function saveDiary() {
    if (chatHistory.length === 0) {
        alert('保存する会話がありません。');
        return;
    }
    
    // APIキーチェック
    if (!currentApiKey) {
        alert('OpenAI APIキーが設定されていません。設定画面でAPIキーを入力してください。');
        switchScreen('settings');
        return;
    }
    
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
        loadingOverlay.style.display = 'flex';
    }
    
    try {
        const diaryPrompt = `これまでの会話を基に、今日の出来事や感情を整理して、素敵な日記エントリーを作成してください。日記のタイトルと内容を含めて、読みやすい形式で作成してください。

会話履歴：
${chatHistory.map(msg => `${msg.role === 'user' ? 'ユーザー' : 'AI'}: ${msg.content}`).join('\n')}

日記フォーマット：
# [日記のタイトル]

[日記の内容]`;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentApiKey}`
            },
            body: JSON.stringify({
                model: currentModel,
                messages: [
                    { role: 'system', content: 'あなたは優秀な日記ライターです。ユーザーとの会話を基に、感情豊かで読みやすい日記を作成してください。' },
                    { role: 'user', content: diaryPrompt }
                ],
                max_tokens: 800,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        const diaryContent = data.choices[0].message.content;
        
        // 日記を保存
        const diary = {
            id: Date.now(),
            date: new Date().toLocaleString('ja-JP'),
            content: diaryContent,
            chatHistory: [...chatHistory]
        };
        
        saveDiaryToStorage(diary);
        
        alert('日記が保存されました！');
        
        // 日記一覧に切り替え
        switchScreen('diary-list');
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const diaryListBtn = document.querySelector('[data-screen="diary-list"]');
        if (diaryListBtn) {
            diaryListBtn.classList.add('active');
        }
        
        loadDiaryList();
        
        console.log('日記保存成功');
        
    } catch (error) {
        console.error('日記保存エラー:', error);
        alert('日記の保存に失敗しました。もう一度お試しください。');
    } finally {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            loadingOverlay.style.display = 'none';
        }
    }
}

// 日記をローカルストレージに保存
function saveDiaryToStorage(diary) {
    const diaries = getDiariesFromStorage();
    diaries.push(diary);
    try {
        localStorage.setItem('aiDiaries', JSON.stringify(diaries));
    } catch (error) {
        console.error('ローカルストレージ保存エラー:', error);
        alert('日記の保存に失敗しました。ストレージの容量を確認してください。');
    }
}

// ローカルストレージから日記を取得
function getDiariesFromStorage() {
    try {
        const diaries = localStorage.getItem('aiDiaries');
        return diaries ? JSON.parse(diaries) : [];
    } catch (error) {
        console.error('ローカルストレージ読み込みエラー:', error);
        return [];
    }
}

// 日記一覧読み込み
function loadDiaryList() {
    const diaries = getDiariesFromStorage();
    const diaryEntriesContainer = document.getElementById('diary-entries');
    
    if (!diaryEntriesContainer) {
        console.error('日記一覧コンテナが見つかりません');
        return;
    }
    
    if (diaries.length === 0) {
        diaryEntriesContainer.innerHTML = `
            <div class="no-diaries">
                <p>まだ日記がありません。新しい日記を作成してみましょう！</p>
                <button class="btn btn--primary" onclick="startNewDiary()">新しい日記を書く</button>
            </div>
        `;
        return;
    }
    
    // 日付順にソート（新しい順）
    diaries.sort((a, b) => b.id - a.id);
    
    diaryEntriesContainer.innerHTML = diaries.map(diary => `
        <div class="diary-entry" data-id="${diary.id}">
            <div class="diary-entry-header">
                <div class="diary-entry-date">${diary.date}</div>
                <div class="diary-entry-actions">
                    <button class="btn btn--sm btn--outline" onclick="viewDiary(${diary.id})">表示</button>
                    <button class="btn btn--sm btn--secondary" onclick="deleteDiary(${diary.id})">削除</button>
                </div>
            </div>
            <div class="diary-entry-content">
                ${formatDiaryContent(diary.content)}
            </div>
        </div>
    `).join('');
    
    // 検索機能設定
    setupDiarySearch(diaries);
    
    console.log(`日記一覧読み込み完了: ${diaries.length}件`);
}

// 日記内容フォーマット
function formatDiaryContent(content) {
    return content
        .replace(/^# (.+)$/gm, '<h3>$1</h3>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(.+)$/gm, '<p>$1</p>')
        .replace(/<p><h3>/g, '<h3>')
        .replace(/<\/h3><\/p>/g, '</h3>');
}

// 日記検索設定
function setupDiarySearch(diaries) {
    const searchInput = document.getElementById('diary-search');
    
    if (!searchInput) return;
    
    // 既存のイベントリスナーを削除
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    newSearchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredDiaries = diaries.filter(diary => 
            diary.content.toLowerCase().includes(searchTerm) ||
            diary.date.toLowerCase().includes(searchTerm)
        );
        
        const diaryEntriesContainer = document.getElementById('diary-entries');
        
        if (filteredDiaries.length === 0) {
            diaryEntriesContainer.innerHTML = '<div class="no-diaries"><p>検索結果が見つかりませんでした。</p></div>';
            return;
        }
        
        diaryEntriesContainer.innerHTML = filteredDiaries.map(diary => `
            <div class="diary-entry" data-id="${diary.id}">
                <div class="diary-entry-header">
                    <div class="diary-entry-date">${diary.date}</div>
                    <div class="diary-entry-actions">
                        <button class="btn btn--sm btn--outline" onclick="viewDiary(${diary.id})">表示</button>
                        <button class="btn btn--sm btn--secondary" onclick="deleteDiary(${diary.id})">削除</button>
                    </div>
                </div>
                <div class="diary-entry-content">
                    ${formatDiaryContent(diary.content)}
                </div>
            </div>
        `).join('');
    });
}

// 日記表示
function viewDiary(diaryId) {
    const diaries = getDiariesFromStorage();
    const diary = diaries.find(d => d.id === diaryId);
    
    if (!diary) {
        alert('日記が見つかりません。');
        return;
    }
    
    // より見やすいモーダル表示にする
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content diary-view-modal" style="max-width: 90%; max-height: 90%; overflow-y: auto;">
            <div style="text-align: right; margin-bottom: 1rem;">
                <button id="close-diary-view" class="btn btn--secondary">✕ 閉じる</button>
            </div>
            <div class="diary-full-content">
                <h4 style="color: #667eea; margin-bottom: 1rem;">${diary.date}</h4>
                <div style="line-height: 1.8;">${formatDiaryContent(diary.content)}</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#close-diary-view').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// 日記削除
function deleteDiary(diaryId) {
    if (!confirm('この日記を削除しますか？')) {
        return;
    }
    
    const diaries = getDiariesFromStorage();
    const filteredDiaries = diaries.filter(d => d.id !== diaryId);
    
    try {
        localStorage.setItem('aiDiaries', JSON.stringify(filteredDiaries));
        loadDiaryList();
        console.log(`日記削除: ID ${diaryId}`);
    } catch (error) {
        console.error('日記削除エラー:', error);
        alert('日記の削除に失敗しました。');
    }
}

// 新しい日記開始
function startNewDiary() {
    console.log('新しい日記を開始');
    
    // チャットをクリア
    chatHistory = [];
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = `
            <div class="message ai-message">
                <div class="message-content">
                    <p>こんにちは！今日はどんな一日でしたか？お話を聞かせてください。</p>
                    <button class="voice-play-btn" data-text="こんにちは！今日はどんな一日でしたか？お話を聞かせてください。">🔊</button>
                </div>
            </div>
        `;
    }
    
    // チャット画面に切り替え
    switchScreen('chat');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const chatBtn = document.querySelector('[data-screen="chat"]');
    if (chatBtn) {
        chatBtn.classList.add('active');
    }
}

// エラーハンドリング
window.addEventListener('error', function(e) {
    console.error('アプリケーションエラー:', e.error);
});

// 画面がフォーカスされた時に音声合成状態を再チェック
window.addEventListener('focus', function() {
    if (isAppInitialized) {
        setTimeout(checkSpeechSynthesisSupport, 100);
    }
});

console.log('時綴のJavaScriptファイル（完成版）が読み込まれました');
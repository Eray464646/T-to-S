const fs = require('fs');

let html = fs.readFileSync('/tmp/workspace/Eray464646/T-to-S/index.html', 'utf8');

// Insert CSS
const cssInsert = `
        .current-sentence-box {
            background-color: #e9ecef;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            text-align: center;
        }
        .current-sentence-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        }
        #current-sentence-display {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
            min-height: 35px;
            word-wrap: break-word;
        }
        .text-preview {
            width: 100%;
            min-height: 100px;
            max-height: 200px;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 16px;
            box-sizing: border-box;
            margin-bottom: 15px;
            background-color: #fafafa;
            overflow-y: auto;
            white-space: pre-wrap;
            font-family: inherit;
        }
        .active-sentence {
            background-color: #ffeeba;
            border-radius: 3px;
        }
`;
html = html.replace('</style>', cssInsert + '\n    </style>');

// Insert HTML elements
const htmlInsert = `
    <div class="current-sentence-box">
        <div class="current-sentence-label">Aktuell gesprochen:</div>
        <div id="current-sentence-display">Noch nichts gestartet.</div>
    </div>

    <textarea id="text-input" placeholder="Geben Sie hier Ihren Text ein..."></textarea>
    
    <div id="text-preview" class="text-preview"></div>
`;
html = html.replace('<textarea id="text-input" placeholder="Geben Sie hier Ihren Text ein..."></textarea>', htmlInsert);

// Now for the JS script.
// We will replace the script part entirely to keep it clean.
const scriptStart = html.indexOf('<script>');
const scriptEnd = html.indexOf('</script>') + 9;

const newScript = `<script>
    const textInput = document.getElementById('text-input');
    const textPreview = document.getElementById('text-preview');
    const currentSentenceDisplay = document.getElementById('current-sentence-display');
    const voiceSelect = document.getElementById('voice-select');
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnResume = document.getElementById('btn-resume');
    const btnStop = document.getElementById('btn-stop');
    const errorMessage = document.getElementById('error-message');
    const textError = document.getElementById('text-error');
    
    const rateInput = document.getElementById('rate');
    const pitchInput = document.getElementById('pitch');
    const volumeInput = document.getElementById('volume');
    const rateVal = document.getElementById('rate-val');
    const pitchVal = document.getElementById('pitch-val');
    const volumeVal = document.getElementById('volume-val');

    let voices = [];
    let synth = window.speechSynthesis;

    // State Variables
    let sentences = [];
    let currentSentenceIndex = -1;
    let isSpeaking = false;
    let isPaused = false;
    let latestCursorPosition = 0;
    let userSelectedNewPosition = false;

    const savedRate = localStorage.getItem('tts-rate') || '0.92';
    const savedPitch = localStorage.getItem('tts-pitch') || '1.0';
    const savedVolume = localStorage.getItem('tts-volume') || '1.0';
    
    rateInput.value = savedRate;
    pitchInput.value = savedPitch;
    volumeInput.value = savedVolume;
    rateVal.textContent = savedRate;
    pitchVal.textContent = savedPitch;
    volumeVal.textContent = savedVolume;

    function updateValue(input, display, storageKey) {
        input.addEventListener('input', () => {
            display.textContent = input.value;
            localStorage.setItem(storageKey, input.value);
        });
    }

    updateValue(rateInput, rateVal, 'tts-rate');
    updateValue(pitchInput, pitchVal, 'tts-pitch');
    updateValue(volumeInput, volumeVal, 'tts-volume');

    function getVoiceScore(voice) {
        let score = 0;
        if (voice.lang === 'de-DE') score += 10;
        
        const name = voice.name.toLowerCase();
        const positiveKeywords = ['neural', 'natural', 'premium', 'enhanced', 'google', 'microsoft', 'katja', 'conrad', 'anna', 'siri'];
        const negativeKeywords = ['espeak', 'pico', 'compact'];
        
        positiveKeywords.forEach(kw => {
            if (name.includes(kw)) score += 5;
        });
        
        negativeKeywords.forEach(kw => {
            if (name.includes(kw)) score -= 10;
        });
        
        return score;
    }

    function populateVoiceList() {
        const allowedLangs = ['de', 'de-de', 'de-at', 'de-ch'];
        voices = synth.getVoices().filter(voice => allowedLangs.includes(voice.lang.toLowerCase()));
        
        if (voices.length === 0) {
            errorMessage.style.display = 'block';
            voiceSelect.innerHTML = '<option value="">Keine deutsche Stimme verfügbar</option>';
            voiceSelect.disabled = true;
            btnStart.disabled = true;
            btnPause.disabled = true;
            btnResume.disabled = true;
            btnStop.disabled = true;
            return;
        }

        errorMessage.style.display = 'none';
        voiceSelect.disabled = false;

        voices.sort((a, b) => getVoiceScore(b) - getVoiceScore(a));

        voiceSelect.innerHTML = '';
        
        const savedVoiceURI = localStorage.getItem('tts-voice');
        let voiceFound = false;

        voices.forEach((voice) => {
            const option = document.createElement('option');
            const score = getVoiceScore(voice);
            const recommended = score >= 10 ? ' (empfohlen)' : '';
            const location = voice.localService ? 'Lokal' : 'Browser/Online';
            
            option.textContent = \`\${voice.name} (\${voice.lang}, \${location})\${recommended}\`;
            option.value = voice.voiceURI;
            
            if (savedVoiceURI === voice.voiceURI) {
                option.selected = true;
                voiceFound = true;
            }
            
            voiceSelect.appendChild(option);
        });
        
        if (!voiceFound && voices.length > 0) {
            voiceSelect.selectedIndex = 0;
        }
        
        updateButtonsState();
    }

    voiceSelect.addEventListener('change', () => {
        localStorage.setItem('tts-voice', voiceSelect.value);
    });

    function normalizeText(text) {
        return text;
    }

    function splitTextIntoSentences(text) {
        let result = [];
        const regex = /[\\s\\S]*?[.!?\\n]+|[\\s\\S]+$/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match[0].length === 0) break;
            result.push({
                text: match[0],
                startIndex: match.index,
                endIndex: match.index + match[0].length
            });
        }
        return result;
    }

    function getSentenceIndexFromCursor(cursorPosition) {
        if (sentences.length === 0) return 0;
        for (let i = 0; i < sentences.length; i++) {
            if (cursorPosition >= sentences[i].startIndex && cursorPosition <= sentences[i].endIndex) {
                return i;
            }
        }
        return sentences.length - 1;
    }

    function renderHighlightedText(activeSentenceIndex) {
        const text = textInput.value;
        if (sentences.length === 0 && text.length > 0) {
            sentences = splitTextIntoSentences(text);
        }
        
        textPreview.innerHTML = '';
        
        if (text.length === 0) return;

        let currentIndex = 0;
        sentences.forEach((sentence, index) => {
            if (sentence.startIndex > currentIndex) {
                const span = document.createElement('span');
                span.textContent = text.substring(currentIndex, sentence.startIndex);
                textPreview.appendChild(span);
            }
            
            const span = document.createElement('span');
            span.textContent = sentence.text;
            if (index === activeSentenceIndex) {
                span.classList.add('active-sentence');
            }
            textPreview.appendChild(span);
            currentIndex = sentence.endIndex;
        });
        
        if (currentIndex < text.length) {
            const span = document.createElement('span');
            span.textContent = text.substring(currentIndex);
            textPreview.appendChild(span);
        }
    }

    function updateCurrentSentenceDisplay(sentenceText) {
        if (sentenceText && sentenceText.trim()) {
            currentSentenceDisplay.textContent = sentenceText.trim();
        } else {
            currentSentenceDisplay.textContent = "Noch nichts gestartet.";
        }
    }

    function updateButtonsState() {
        if (voices.length === 0) return;
        
        btnStart.disabled = false;
        btnPause.disabled = !isSpeaking || isPaused;
        btnResume.disabled = !isPaused;
        btnStop.disabled = !isSpeaking && !isPaused;
    }

    function stopSpeech() {
        synth.cancel();
        isSpeaking = false;
        isPaused = false;
        currentSentenceIndex = -1;
        renderHighlightedText(-1);
        updateCurrentSentenceDisplay("");
        updateButtonsState();
    }

    function pauseSpeech() {
        if (isSpeaking && !isPaused) {
            synth.pause();
            isPaused = true;
            updateButtonsState();
        }
    }

    function resumeSpeech() {
        if (isPaused) {
            if (userSelectedNewPosition) {
                synth.cancel();
                const idx = getSentenceIndexFromCursor(latestCursorPosition);
                speakFromSentence(idx);
            } else {
                synth.resume();
                isPaused = false;
                updateButtonsState();
            }
        }
    }

    function speakNextSentence() {
        if (currentSentenceIndex >= sentences.length || !isSpeaking) {
            stopSpeech();
            return;
        }
        
        let sentence = sentences[currentSentenceIndex];
        let sentenceText = sentence.text.trim();
        
        if (!sentenceText) {
            currentSentenceIndex++;
            speakNextSentence();
            return;
        }
        
        renderHighlightedText(currentSentenceIndex);
        updateCurrentSentenceDisplay(sentenceText);
        updateButtonsState();
        
        const utterThis = new SpeechSynthesisUtterance(sentenceText);
        
        const selectedURI = voiceSelect.value;
        const selectedVoice = voices.find(v => v.voiceURI === selectedURI);
        if (selectedVoice) {
            utterThis.voice = selectedVoice;
        }
        
        utterThis.rate = parseFloat(rateInput.value);
        utterThis.pitch = parseFloat(pitchInput.value);
        utterThis.volume = parseFloat(volumeInput.value);
        utterThis.lang = selectedVoice ? selectedVoice.lang : "de-DE";
        
        utterThis.onstart = () => {
            isSpeaking = true;
            isPaused = false;
            updateButtonsState();
        };
        
        utterThis.onend = (e) => {
            if (isSpeaking && !isPaused) {
                currentSentenceIndex++;
                // Slight delay to allow browser to handle resources, avoiding infinite call stack
                setTimeout(() => {
                    speakNextSentence();
                }, 10);
            }
        };
        
        utterThis.onerror = (e) => {
            console.error('SpeechSynthesis error:', e);
            // If we intentionally cancelled, do nothing. Otherwise proceed.
        };
        
        synth.speak(utterThis);
    }

    function speakFromSentence(index) {
        const text = normalizeText(textInput.value);
        if (text.trim() === '') {
            textError.style.display = 'block';
            return;
        }
        textError.style.display = 'none';
        
        synth.cancel();
        sentences = splitTextIntoSentences(text);
        
        if (sentences.length === 0) return;
        
        currentSentenceIndex = Math.max(0, Math.min(index, sentences.length - 1));
        isSpeaking = true;
        isPaused = false;
        userSelectedNewPosition = false;
        
        speakNextSentence();
    }

    // Cursor Tracking
    function handleCursorUpdate() {
        latestCursorPosition = textInput.selectionStart;
        if (isPaused) {
            userSelectedNewPosition = true;
        }
        
        // Always update preview highlighting when clicking during text input (if not speaking)
        if (!isSpeaking || isPaused) {
            const tempSentences = splitTextIntoSentences(textInput.value);
            if (tempSentences.length > 0) {
                sentences = tempSentences;
                const idx = getSentenceIndexFromCursor(latestCursorPosition);
                renderHighlightedText(idx);
            } else {
                renderHighlightedText(-1);
            }
        }
    }

    textInput.addEventListener('click', handleCursorUpdate);
    textInput.addEventListener('keyup', handleCursorUpdate);
    textInput.addEventListener('select', handleCursorUpdate);

    textInput.addEventListener('input', () => {
        if (textInput.value.trim() !== '') {
            textError.style.display = 'none';
        }
        
        if (isSpeaking && !isPaused) {
            // Option: stop speaking when user types, or just reset state
            stopSpeech();
        } else {
            sentences = splitTextIntoSentences(textInput.value);
            renderHighlightedText(-1);
        }
    });

    btnStart.addEventListener('click', () => {
        let startIdx = 0;
        if (userSelectedNewPosition || (latestCursorPosition > 0 && !isSpeaking)) {
            sentences = splitTextIntoSentences(textInput.value);
            startIdx = getSentenceIndexFromCursor(latestCursorPosition);
        }
        speakFromSentence(startIdx);
    });

    btnPause.addEventListener('click', pauseSpeech);
    btnResume.addEventListener('click', resumeSpeech);
    btnStop.addEventListener('click', stopSpeech);

    populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }
    
    // Initial render
    renderHighlightedText(-1);
</script>`;

html = html.substring(0, scriptStart) + newScript + html.substring(scriptEnd);
fs.writeFileSync('/tmp/workspace/Eray464646/T-to-S/index.html', html);
console.log("Updated!");

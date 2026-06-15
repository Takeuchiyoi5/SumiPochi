function startLoop() {
    applyFilterAndShuffle();
    if (currentPlaylist.length === 0) {
        alert("カードがありません！");
        return;
    }
    initAudioContext(); 
    isPlaying = true;
    isPaused = false;
    
    if (actionBtn) {
        actionBtn.innerText = "PAUSE GAME";
        actionBtn.classList.add('playing');
    }
    if (stopBtn) stopBtn.style.display = "block"; 
    
    if (activeCategory === 'all') {
        startAllModeBgmCycle();
    } else {
        fadeTransitionTo(getTrackForCategory(activeCategory));
    }
    
    step = 0;
    wordIndex = 0; 
    gameScore = 0;
    gameCombo = 0;
    if (scoreVal) scoreVal.innerText = gameScore;
    if (comboVal) comboVal.innerText = gameCombo;
    
    window.removeEventListener('keydown', handleTypingInput); 
    window.addEventListener('keydown', handleTypingInput);
    
    startCountdown(); 
    resetBeatTimer();
    processChantStep();
}

function pauseLoop() {
    isPaused = true;
    if (actionBtn) {
        actionBtn.innerText = "RESUME GAME";
        actionBtn.classList.remove('playing');
    }
    
    if (currentAudioEl) currentAudioEl.pause();
    if (timerId) clearInterval(timerId);
    window.speechSynthesis.cancel();

    if (wordDisplay) wordDisplay.innerHTML = `<span style="color: #94a3b8;">⏸️ PAUSED</span>`;
    if (meaningDisplay) meaningDisplay.innerText = "ゲームを一時停止しているよ";
}

function resumeLoop() {
    isPaused = false;
    if (actionBtn) {
        actionBtn.innerText = "PAUSE GAME";
        actionBtn.classList.add('playing');
    }
    
    if (currentAudioEl) currentAudioEl.play().catch(e => console.log(e));
    
    if (step === 3) {
        renderTypingWord();
    } else {
        step = Math.max(0, step - 1);
        resetBeatTimer();
        processChantStep();
    }
}

function stopLoop() {
    isPlaying = false;
    isPaused = false;
    if (actionBtn) {
        actionBtn.innerText = "START GAME";
        actionBtn.classList.remove('playing');
    }
    if (stopBtn) stopBtn.style.display = "none"; 
    
    stopAllBgm();
    
    if (timerId) clearInterval(timerId);
    if (countdownTimerId) clearInterval(countdownTimerId);
    
    if (timerSetupPanel) timerSetupPanel.style.display = 'flex';
    if (timeLeftDisplay) timeLeftDisplay.style.display = 'none';

    window.removeEventListener('keydown', handleTypingInput);
    window.speechSynthesis.cancel(); 
    if (wordDisplay) wordDisplay.innerHTML = "Ready?";
    if (meaningDisplay) meaningDisplay.innerText = "Press Start";
}

function resetBeatTimer() {
    // 1. 確実に今のタイマーを止める
    if (timerId) {
        clearInterval(timerId);
        timerId = null; // nullにしておくのが重要
    }
    
    // 2. 停止条件を厳密に
    if (step === 3 || isPaused || !isPlaying) return; 

    // 3. 少しだけ間隔を空けてから開始する（処理の衝突防止）
    timerId = setInterval(processChantStep, beatInterval);
}

function renderTypingWord() {
    if (isPaused || !wordDisplay) return;
    let htmlStr = "";
    for (let i = 0; i < targetString.length; i++) {
        if (i < typedIndex) {
            htmlStr += `<span class="char-correct">${targetString[i]}</span>`;
        } else if (i === typedIndex) {
            let cls = hasError ? "char-error" : "char-current";
            if (targetString[i] === ' ' || targetString[i] === '→') {
                htmlStr += `<span class="${cls}" style="display: inline-block; min-width: 14px; border-bottom: 3px solid currentColor;">${targetString[i]}</span>`;
            } else {
                htmlStr += `<span class="${cls}">${targetString[i]}</span>`;
            }
        } else {
            htmlStr += `<span class="char-remaining">${targetString[i]}</span>`;
        }
    }
    wordDisplay.innerHTML = htmlStr;
}

function checkAndSkipNonAlpha() {
    if (!currentPlaylist || currentPlaylist.length === 0 || wordIndex >= currentPlaylist.length) return;
    const currentItem = currentPlaylist[wordIndex];
    let skippable = ['→', '.', '?', '-'];
    
    if (activeCategory !== 'how' && (!currentItem || currentItem.tag !== 'how')) {
        skippable.push(' ');
    }

    if (typedIndex < targetString.length && skippable.includes(targetString[typedIndex])) {
        typedIndex++;
        checkAndSkipNonAlpha(); 
    }
}

function processChantStep() {
    // 【ガード節】もし停止中なら処理を絶対に実行させない
    if (!isPlaying || isPaused) {
        if (timerId) clearInterval(timerId);
        return;
    }

    // 範囲チェック（ここでもフリーズを防御）
    if (wordIndex >= currentPlaylist.length) {
        console.warn("インデックスが範囲外です。リセットします。");
        wordIndex = 0; 
    }    

    const currentVocab = currentPlaylist[wordIndex];

    switch(step) {
        case 0: 
            // 【修正の核心】
            // 処理が始まった瞬間に、その時点での currentVocab を確定させる
            const currentVocab = currentPlaylist[wordIndex]; 
            
            targetString = currentVocab.word;
            typedIndex = 0;
            isCurrentWordCleared = false;
            hasError = false; 
            
            // 表示と音声を、この確定した currentVocab で統一する
            checkAndSkipNonAlpha();
            renderTypingWord(); // 画面を更新
            
            if (meaningDisplay) meaningDisplay.innerText = "---";
            
            // 音声を再生
            speak(cleanTextForTTS(currentVocab.word, currentVocab.meaning), 'en-US');
            
            step = 1;
            break;
            
        case 1: 
            if (meaningDisplay) meaningDisplay.innerText = currentVocab.meaning;
            
            let cleanJapanese = currentVocab.meaning
                .replace(/（[^）]*）/g, '')  
                .replace(/\([^)]*\)/g, '')   
                .trim();                     
            
            // ★音声バグ修正：「来る」の漢字が入っていたら「くる」に置換して誤読を防止する
            if (cleanJapanese.includes('来る')) {
                cleanJapanese = cleanJapanese.replace(/来る/g, 'くる');
            }

            if (cleanJapanese.includes('間')) {
                cleanJapanese = cleanJapanese.replace(/間/g, 'あいだ');
            }
                
            speak(cleanJapanese, 'ja-JP');
            step = 2;
            break;
        case 2: 
            speak(cleanTextForTTS(currentVocab.word, currentVocab.meaning), 'en-US');
            step = 3; 
            if (timerId) clearInterval(timerId); 
            renderTypingWord(); 
            break;
            
        case 3:
            // 1. 正解・不正解の判定処理（ここは既存のままでOK）
            if (isCurrentWordCleared) {
                gameScore += 10 + Math.floor(gameCombo / 5);
                gameCombo += 1;
                if (gameCombo > 0 && gameCombo % 5 === 0) triggerComboPopup(gameCombo);

                if (activeCategory === 'revenge') {
                    revengeDb = revengeDb.filter(item => item.id !== currentVocab.id);
                }
            } else {
                gameCombo = 0;
                if (!revengeDb.some(item => item.id === currentVocab.id)) revengeDb.push(currentVocab);
            }
            
            // スコア表示の更新
            if (scoreVal) scoreVal.innerText = gameScore;
            if (comboVal) comboVal.innerText = gameCombo;

            // 2. 次の問題へインデックスを進める
            if (activeCategory === 'revenge' && isCurrentWordCleared) {
                applyFilterAndShuffle();
                wordIndex = 0;
                if(currentPlaylist.length === 0) {
                    playRevengeClearSound();
                    alert("すごいや！にがてな単語をすべてリベンジしたよ！完全クリア！");
                    revengeDb = [];
                    if (revengeTabBtn) revengeTabBtn.style.display = 'none';
                    switchCategory('all', document.querySelector('.nav-btn'));
                    return;
                }
            } else {
                wordIndex = (wordIndex + 1) % currentPlaylist.length;
            }

            // 3. 次の問題へ即座に自動遷移させる
            step = 0; 
            // 【重要：ここを追加】
            // 古いタイマーを完全に停止させ、次の問題のタイミングでタイマーを再生成させる
            if (timerId) {
                clearInterval(timerId);
                timerId = null;
            }            
            // 次の問題へ進む

            processChantStep(); 
            break;
    }
}

function handleTypingInput(e) {
    if (isPaused) return; 

    // ★「Enterキーで次へ」という手動遷移のブロックを削除しました

    // 既存のEnterキーのデフォルト動作抑制
    if (e.key === ' ' || e.key === 'Enter') {
        if (isPlaying) {
            e.preventDefault();
        }
    }

    if (targetString === "" || isCurrentWordCleared) return; 
    
    let key = e.key;
    checkAndSkipNonAlpha();
    
    if (typedIndex < targetString.length) {
        if (key.toLowerCase() === targetString[typedIndex].toLowerCase() || 
            (targetString[typedIndex] === ' ' && key === ' ')) {
            
            typedIndex++;
            hasError = false; 
            
            checkAndSkipNonAlpha(); 
            renderTypingWord();

            if (typedIndex >= targetString.length) {
                isCurrentWordCleared = true;
                playWordCompleteSound(); 
                if (step >= 2) renderTypingWord();
                // ★修正：ステップを 3 に確定させてから遷移を予約
                step = 3; 
                setTimeout(() => {
                    if (isPlaying) {
                        processChantStep();
                    }
                }, 500); 
                          
            } else {
                playKeySuccessSound();   
            }
        } 
        else if (key !== "Shift" && key !== "CapsLock" && key !== "Control" && key !== "Alt" && key !== "Enter") {
            hasError = true; 
            renderTypingWord(); 
        }
    }
}
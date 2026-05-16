// 시험 화면 - 일반 모드 + 학습(즉시채점) 모드

// 전역 타이머: SPA에서 이전 인터벌이 남아 중복 실행되는 것을 방지
let _timerInterval = null;
function clearGlobalTimer() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
}

defineRoute('exam', async (app, params) => {
  const mode      = params.mode || 'past';
  const sourceId  = params.sourceId || '';
  const count     = params.count ? parseInt(params.count, 10) : null;
  const checkMode = params.check === '1';   // 학습 모드 여부

  // 오답 모드: 로컬 스토리지에서 오답 qkey 목록 제공
  const wrongKeys = mode === 'wrong' ? Storage.listWrong().map(w => w.qkey) : [];

  const data = await api('/api/exam/start', {
    method: 'POST',
    body: JSON.stringify({ mode, sourceId, count, checkMode, wrongKeys }),
  });

  // ── 보기 랜덤 섞기 + shuffleMap 저장 ────────────────────────────────────────
  // shuffleMap[shuffledPos(0-based)] = originalIdx(0-based)
  for (const q of data.questions) {
    if (!q.options || q.options.length < 2) { q.shuffleMap = null; continue; }
    const indexed = q.options.map((opt, i) => ({ opt, i }));
    for (let k = indexed.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [indexed[k], indexed[j]] = [indexed[j], indexed[k]];
    }
    q.shuffleMap = indexed.map(x => x.i);
    q.options = indexed.map(x => x.opt);
    if (q.answer != null) {
      q.answer = indexed.findIndex(x => x.i === q.answer - 1) + 1;
    }
  }

  if (!data.questions || data.questions.length === 0) {
    app.innerHTML = '';
    app.append(el('div', { class: 'card' }, [
      el('h2', { text: '문제가 없습니다' }),
      el('p', { text: '해당 모드에 표시할 문제가 없습니다.' }),
      el('button', { class: 'btn primary', onClick: () => navigate('home'), text: '홈으로' }),
    ]));
    return;
  }

  const state = {
    title: data.title,
    mode: data.mode || mode,
    sourceId,
    questions: data.questions,
    currentIdx: 0,
    answers: new Map(),
    bookmarks: new Set(),
    startedAt: Date.now(),
    timerInterval: null,
    submitted: false,
    checkMode,
    revealedAnswer: false,
    revealReadyAt: 0,
    timeLimit: 0,
  };

  // 북마크 - localStorage에서 로드 (API 호출 없음)
  const savedBookmarks = Storage.getBookmarks();
  for (const q of state.questions) {
    if (savedBookmarks[q.qkey]) state.bookmarks.add(q.qkey);
  }

  renderExam(app, state);
});

function renderExam(app, state) {
  app.innerHTML = '';
  const layout = el('div', { class: 'exam-layout' }, [
    el('div', { class: 'exam-main', id: 'exam-main' }),
    el('div', { class: 'exam-side' }, [renderOMR(state)]),
  ]);
  app.append(layout);
  renderQuestion(state);
  startTimer(state);
  if (window.innerWidth <= 768) app.style.paddingBottom = '70px';
}

function startTimer(state) {
  clearGlobalTimer();
  const tick = () => {
    const elapsed   = Math.floor((Date.now() - state.startedAt) / 1000);
    const remaining = state.timeLimit ? state.timeLimit - elapsed : null;
    const t = document.getElementById('timer');
    if (!t) { clearGlobalTimer(); return; }
    if (remaining != null) {
      if (remaining <= 0) {
        clearGlobalTimer();
        t.textContent = '⏱ 00:00';
        autoSubmit(state);
        return;
      }
      t.textContent = '⏱ ' + fmtTimer(remaining);
      t.style.color = remaining < 600 ? 'var(--danger)' : 'var(--primary)';
    } else {
      t.textContent = '⏱ ' + fmtTimer(elapsed);
    }
  };
  state.tick = tick;
  tick();
  _timerInterval = setInterval(tick, 1000);
  state.timerInterval = _timerInterval;
}

function renderQuestion(state) {
  const main = document.getElementById('exam-main');
  if (!main) return;
  window.scrollTo({ top: 0, behavior: 'instant' });
  const q      = state.questions[state.currentIdx];
  const sel    = state.answers.get(q.qkey);
  const revealed = state.checkMode && state.revealedAnswer;

  main.innerHTML = '';

  // ── 헤더 ──
  const headerChildren = [
    el('div', { class: 'title', text: state.title }),
  ];
  if (state.checkMode) {
    headerChildren.push(el('span', { class: 'mode-badge', text: '📖 학습 모드' }));
  }
  headerChildren.push(el('div', { class: 'timer', id: 'timer' }));
  main.append(el('div', { class: 'exam-header' }, headerChildren));
  if (state.tick) state.tick();

  // ── 진행 현황 바 (맞은 것 / 틀린 것 / 남은 것) ──
  {
    const total    = state.questions.length;
    const answered = state.answers.size;

    let progressEl;
    if (state.checkMode && state.questions[0]?.answer != null) {
      const correct  = state.questions.filter(q2 => state.answers.get(q2.qkey) === q2.answer).length;
      const wrong    = answered - correct;
      const remain   = total - answered;
      const score    = total > 0 ? Math.round(correct / total * 100) : 0;
      const scoreColor = score >= 60 ? 'var(--success)' : 'var(--danger)';
      progressEl = el('div', { class: 'progress-bar-wrap' }, [
        el('div', { class: 'progress-counts' }, [
          el('span', { class: 'pcnt correct', text: `✅ 맞은 것: ${correct}` }),
          el('span', { class: 'pcnt wrong',   text: `❌ 틀린 것: ${wrong}` }),
          el('span', { class: 'pcnt remain',  text: `📝 남은 것: ${remain}` }),
          el('span', { class: 'pcnt score', style: { color: scoreColor }, text: `점수: ${score}%` }),
        ]),
      ]);
    } else {
      const remain = total - answered;
      progressEl = el('div', { class: 'progress-bar-wrap' }, [
        el('div', { class: 'progress-counts' }, [
          el('span', { class: 'pcnt answered', text: `✏️ 푼 것: ${answered}` }),
          el('span', { class: 'pcnt remain',   text: `📝 남은 것: ${remain}` }),
          el('span', { class: 'pcnt total',    text: `전체: ${total}` }),
        ]),
      ]);
    }
    main.append(progressEl);
  }

  // ── 문제 ──
  main.append(el('div', { class: 'qbox' }, [
    el('div', { class: 'qhead' }, [
      el('span', { class: 'qnum', text: `Q${state.currentIdx + 1} / ${state.questions.length}` }),
      el('span', { class: 'subject', text: q.subjectName || '' }),
      ...(q.sourceId ? [el('span', { class: 'source-badge', text: formatSource(q.sourceId) })] : []),
      el('button', {
        class: `bookmark-btn ${state.bookmarks.has(q.qkey) ? 'on' : ''}`,
        onClick: () => toggleBookmark(state, q.qkey),
        text: state.bookmarks.has(q.qkey) ? '★' : '☆',
      }),
    ]),
    ...renderStem(q.stem),
    ...(q.image ? [el('img', { class: 'qimg', src: q.image, alt: '문제 이미지' })] : []),
    ...(q.table ? [el('div', { class: 'qtable', html: q.table })] : []),
    el('div', { class: 'options' }, q.options.map((opt, i) => {
      const num = i + 1;
      let cls = 'opt';

      if (revealed) {
        // 정답 강조
        if (num === q.answer)                    cls += ' correct';
        else if (num === sel && sel !== q.answer) cls += ' wrong';
        cls += ' revealed-disabled';
      } else {
        if (sel === num) cls += ' selected';
      }

      return el('div', { class: cls, onClick: () => handleOptionClick(state, num) }, [
        el('div', { class: 'num', text: CIRCLES[i] }),
        el('div', { class: 'opt-text', text: opt }),
      ]);
    })),
  ]));

  // ── 학습 모드: 정오답 피드백 ──
  if (revealed) {
    const isCorrect  = sel === q.answer;
    const correctLabel = q.answer ? CIRCLES[q.answer - 1] : '?';
    main.append(
      el('div', { class: `check-feedback ${isCorrect ? 'correct' : 'wrong'}` },
        [ isCorrect ? `✅ 정답입니다!` : `❌ 틀렸습니다.  정답: ${correctLabel}` ]
      ),
      renderSelectedAnswerExplanation(q, sel),
      el('div', { class: 'check-next-hint', text: '→ 다음 문제  ·  ← 이전 문제  ·  ↑↓ 스크롤' }),
    );
    if (q.explanation) {
      main.append(renderExplanation(q.explanation, q.shuffleMap));
    }
  }

  // ── 내비 버튼 ──
  if (state.checkMode) {
    if (revealed) {
      const isLast = state.currentIdx === state.questions.length - 1;
      main.append(el('div', { class: 'exam-nav' }, [
        el('button', { class: 'btn primary', style: { flex: '1' },
          onClick: () => advanceCheckMode(state),
          text: isLast ? '결과 보기' : '다음 문제 ▶',
        }),
      ]));
    } else {
      main.append(el('div', { class: 'exam-nav' }, [
        el('button', {
          class: 'btn', disabled: state.currentIdx === 0,
          onClick: () => {
            if (state.currentIdx > 0) {
              state.revealedAnswer = false;
              state.currentIdx--;
              renderQuestion(state); updateOMR(state);
            }
          }, text: '◀ 이전',
        }),
        el('div', { style: { color: 'var(--muted)', fontSize: '0.88rem', textAlign: 'center', flex: '1' },
          text: '숫자(1~4) · ←①  ↓②  →③  ↑④',
        }),
      ]));
    }
  } else {
    // 일반 모드
    main.append(el('div', { class: 'exam-nav' }, [
      el('button', {
        class: 'btn',
        onClick: () => { if (state.currentIdx > 0) { state.currentIdx--; renderQuestion(state); updateOMR(state); } },
        disabled: state.currentIdx === 0, text: '◀ 이전',
      }),
      el('button', { class: 'btn', onClick: () => clearAnswer(state), text: '✕ 지우기' }),
      state.currentIdx === state.questions.length - 1
        ? el('button', { class: 'btn primary', onClick: () => submitExam(state), text: '제출하기' })
        : el('button', {
            class: 'btn primary',
            onClick: () => { state.currentIdx++; renderQuestion(state); updateOMR(state); },
            text: '다음 ▶',
          }),
    ]));
  }

  // ── 키보드 단축키 ──
  document.onkeydown = (e) => {
    if (state.submitted) return;

    // 현재 문제에 답이 선택됐는지 여부
    const hasAnswered = state.checkMode ? state.revealedAnswer : state.answers.has(q.qkey);

    // ── 방향키 ──
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();

      if (!hasAnswered) {
        // 답 선택 전: 방향키 → 보기 선택 (자동 이동 없음)
        const arrowToNum = { ArrowLeft: 1, ArrowDown: 2, ArrowRight: 3, ArrowUp: 4 };
        const num = arrowToNum[e.key];
        if (state.checkMode) {
          // 학습 모드: 선택 즉시 채점
          handleOptionClick(state, num);
        } else {
          // 일반 모드: 보기만 선택, 자동 이동 없음
          state.answers.set(q.qkey, num);
          updateOMR(state);
          renderQuestion(state);
        }
      } else {
        // 답 선택 후: 방향키 → 이동/스크롤
        if (e.key === 'ArrowRight') {
          if (state.checkMode) {
            advanceCheckMode(state);
          } else {
            if (state.currentIdx < state.questions.length - 1) { state.currentIdx++; renderQuestion(state); updateOMR(state); }
          }
        } else if (e.key === 'ArrowLeft') {
          if (state.checkMode) {
            if (state.currentIdx > 0) { state.revealedAnswer = false; state.currentIdx--; renderQuestion(state); updateOMR(state); }
          } else {
            if (state.currentIdx > 0) { state.currentIdx--; renderQuestion(state); updateOMR(state); }
          }
        } else if (e.key === 'ArrowDown') {
          window.scrollBy({ top: 200, behavior: 'smooth' });
        } else if (e.key === 'ArrowUp') {
          window.scrollBy({ top: -200, behavior: 'smooth' });
        }
      }
      return;
    }

    // ── 숫자키 ──
    if (e.key === '5' || e.key === ' ') { e.preventDefault(); window.scrollBy({ top: 200, behavior: 'smooth' }); return; }
    if (e.key === '6') { window.scrollBy({ top: -200, behavior: 'smooth' }); return; }

    if (state.checkMode) {
      if (state.revealedAnswer) {
        if ((e.key >= '1' && e.key <= '4') && Date.now() - state.revealReadyAt > 300) {
          advanceCheckMode(state);
        }
      } else {
        if (e.key >= '1' && e.key <= '4') handleOptionClick(state, parseInt(e.key, 10));
      }
    } else {
      // 일반 모드: 숫자키는 선택 후 자동으로 다음 문제
      if (e.key >= '1' && e.key <= '4') {
        const num = parseInt(e.key, 10);
        state.answers.set(q.qkey, num);
        updateOMR(state);
        if (state.currentIdx < state.questions.length - 1) {
          renderQuestion(state);
          setTimeout(() => { state.currentIdx++; renderQuestion(state); updateOMR(state); }, 300);
        } else {
          renderQuestion(state);
        }
      }
    }
  };
}

function isNegativeStem(stem = '') {
  return /(틀린 것은|맞지 않은 것은|아닌 것은|옳지 않은 것은|해당하지 않는|볼 수 없는|없는 것은|잘못된 것은|적절하지 않은|거리가 먼 것은|아닌|틀린)/.test(stem);
}

function extractAnswerReason(explanation = '') {
  const reason = String(explanation).match(/정답 이유 한 줄 요약:\s*([^\n]+)/);
  if (reason) return reason[1].trim();

  const basis = String(explanation).match(/판단 근거:\s*([^\n]+)/);
  if (basis) return basis[1].trim();

  const core = String(explanation).match(/🔔\s*한줄 핵심\s*\n([^\n]+)/);
  if (core) return core[1].trim();

  return '문제의 핵심 조건과 정답 보기를 비교하면 판단할 수 있습니다.';
}

function renderSelectedAnswerExplanation(q, selected) {
  if (!selected || !q.answer || !Array.isArray(q.options)) return null;

  const selectedText = q.options[selected - 1] || '';
  const correctText = q.options[q.answer - 1] || '';
  const isCorrect = selected === q.answer;
  const negative = isNegativeStem(q.stem || '');
  const reason = extractAnswerReason(q.explanation || '');

  const selectedWhy = isCorrect
    ? (negative
      ? '문제에서 틀린 설명을 고르라고 했고, 선택한 보기가 올바른 개념과 다르게 말합니다.'
      : '선택한 보기가 문제에서 묻는 핵심 조건과 일치합니다.')
    : (negative
      ? '문제는 틀린 설명을 묻는데, 선택한 보기는 올바른 설명 쪽에 가깝습니다.'
      : '선택한 보기는 정답 기준과 다른 개념이거나 문제 조건을 만족하지 않습니다.');

  const correctWhy = negative
    ? '정답 보기는 문제에서 요구한 틀린 설명 또는 해당하지 않는 설명입니다.'
    : '정답 보기는 문제의 핵심 조건과 직접 일치합니다.';

  const rows = [
    el('div', { class: `selected-reason-row ${isCorrect ? 'correct' : 'wrong'}` }, [
      el('div', { class: 'selected-reason-label', text: isCorrect ? '선택한 답' : '내가 고른 답' }),
      el('div', { class: 'selected-reason-text', text: selectedText }),
      el('div', { class: 'selected-reason-why', text: `${isCorrect ? '왜 정답' : '왜 오답'}: ${selectedWhy}` }),
    ]),
  ];

  if (!isCorrect) {
    rows.push(el('div', { class: 'selected-reason-row correct' }, [
      el('div', { class: 'selected-reason-label', text: '정답' }),
      el('div', { class: 'selected-reason-text', text: correctText }),
      el('div', { class: 'selected-reason-why', text: `왜 정답: ${correctWhy}` }),
    ]));
  }

  rows.push(el('div', { class: 'selected-reason-basis', text: `판단 근거: ${reason}` }));

  return el('div', { class: 'selected-reason-box' }, rows);
}

// 선택지 클릭 처리
function handleOptionClick(state, num) {
  if (state.submitted) return;
  const q = state.questions[state.currentIdx];

  if (state.checkMode) {
    if (state.revealedAnswer) {
      if (Date.now() - state.revealReadyAt > 300) advanceCheckMode(state);
    } else {
      state.answers.set(q.qkey, num);
      state.revealedAnswer = true;
      state.revealReadyAt = Date.now();
      renderQuestion(state);
      updateOMR(state);
    }
  } else {
    state.answers.set(q.qkey, num);
    updateOMR(state);
    if (state.currentIdx < state.questions.length - 1) {
      renderQuestion(state);
      setTimeout(() => { state.currentIdx++; renderQuestion(state); updateOMR(state); }, 300);
    } else {
      renderQuestion(state);
    }
  }
}

// 학습 모드: 다음 문제로 이동
function advanceCheckMode(state) {
  state.revealedAnswer = false;
  if (state.currentIdx < state.questions.length - 1) {
    state.currentIdx++;
    renderQuestion(state);
    updateOMR(state);
  } else {
    submitExam(state, true);
  }
}

function clearAnswer(state) {
  const q = state.questions[state.currentIdx];
  state.answers.delete(q.qkey);
  renderQuestion(state);
  updateOMR(state);
}

// OMR 카드 (요약 섹션 제거됨)
function renderOMR(state) {
  const wrapper = el('div', { class: 'omr', id: 'omr' });
  wrapper.appendChild(el('h3', { text: state.checkMode ? 'OMR · 학습 현황' : 'OMR · 답안 현황' }));
  const grid = el('div', { class: 'omr-grid', id: 'omr-grid' });
  state.questions.forEach((q, i) => {
    const ans    = state.answers.get(q.qkey);
    const isBook = state.bookmarks.has(q.qkey);
    const cur    = i === state.currentIdx;
    let cls = `${cur ? 'current' : ''} ${isBook ? 'bookmarked' : ''}`.trim();

    if (ans) {
      if (state.checkMode && q.answer) {
        cls += ans === q.answer ? ' correct-omr' : ' wrong-omr';
      } else {
        cls += ' answered';
      }
    }

    let cellText = `${i + 1}`;
    if (ans) {
      if (state.checkMode && q.answer && ans !== q.answer) {
        cellText = `${i + 1}.${CIRCLES[ans - 1]}→${CIRCLES[q.answer - 1]}`;
      } else {
        cellText = `${i + 1}.${CIRCLES[ans - 1]}`;
      }
    }
    grid.appendChild(el('button', {
      class: cls,
      onClick: () => {
        state.revealedAnswer = false;
        state.currentIdx = i;
        renderQuestion(state); updateOMR(state);
      },
      text: cellText,
    }));
  });
  wrapper.appendChild(grid);
  if (!state.checkMode) {
    wrapper.appendChild(el('button', { class: 'btn primary submit-btn', onClick: () => submitExam(state), text: '시험 제출하기' }));
  }
  return wrapper;
}

function updateOMR(state) {
  const omr = document.getElementById('omr');
  if (!omr) return;
  omr.replaceWith(renderOMR(state));
}

// 북마크 토글 - localStorage 사용 (API 불필요)
function toggleBookmark(state, qkey) {
  const q = state.questions.find(q2 => q2.qkey === qkey);
  if (state.bookmarks.has(qkey)) {
    Storage.delBookmark(qkey);
    state.bookmarks.delete(qkey);
  } else {
    // 문제 데이터도 함께 저장 (북마크 페이지에서 재조회 불필요)
    Storage.setBookmark(qkey, '', {
      stem: q?.stem,
      options: q?.options,       // 현재 배열 순서 그대로 저장
      answer: q?.answer ?? null, // checkMode에서만 존재
      explanation: q?.explanation || null,
      image: q?.image || null,
      table: q?.table || null,
      subjectName: q?.subjectName,
    });
    state.bookmarks.add(qkey);
  }
  renderQuestion(state);
  updateOMR(state);
}

async function autoSubmit(state) {
  alert('시간이 종료되어 자동 제출됩니다.');
  await submitExam(state, true);
}

async function submitExam(state, force = false) {
  if (state.submitted) return;
  if (!force) {
    const unanswered = state.questions.length - state.answers.size;
    const msg = unanswered > 0
      ? `미응답 ${unanswered}문제가 있습니다. 제출하시겠습니까?`
      : '시험을 제출하시겠습니까?';
    if (!(await modalConfirm('제출 확인', msg))) return;
  }

  state.submitted = true;
  clearGlobalTimer();
  document.onkeydown = null;

  const durationSec = Math.floor((Date.now() - state.startedAt) / 1000);

  // ── 선택 번호를 원본 위치로 역변환 ────────────────────────────────────────────
  // 클라이언트에서 보기를 섞었으므로, 서버에 원본 위치(1-4)로 전송해야 채점이 정확함
  const answers = state.questions.map(q => {
    let selected = state.answers.get(q.qkey) ?? null;
    if (selected != null && q.shuffleMap) {
      selected = q.shuffleMap[selected - 1] + 1; // 섞인 위치 → 원본 위치 (1-based)
    }
    return { qkey: q.qkey, selected };
  });

  const result = await api('/api/exam/submit', {
    method: 'POST',
    body: JSON.stringify({
      mode: state.mode, sourceId: state.sourceId,
      title: state.title, durationSec, answers,
    }),
  });

  // ── 오답 로그 업데이트 (localStorage) ─────────────────────────────────────────
  for (const g of result.graded) {
    if (g.correct != null) {
      if (g.isCorrect === false) Storage.recordWrong(g.qkey, g.selected ?? null);
      else if (g.isCorrect === true) Storage.clearWrong(g.qkey);
    }
  }

  // ── 세션 저장 (localStorage) ──────────────────────────────────────────────────
  const sessionId = Storage.nextId();
  const session = {
    id: sessionId,
    mode: state.mode, sourceId: state.sourceId,
    title: state.title,
    score: result.score,
    correct_count: result.correct, question_count: result.total,
    duration_sec: durationSec,
    started_at: new Date(Date.now() - durationSec * 1000).toISOString(),
    finished_at: new Date().toISOString(),
    subject_breakdown: result.subjectBreakdown,
    answers: result.graded.map(g => {
      // state.questions에서 image/table 보충 (서버 응답에 없을 수 있음)
      const sq = state.questions.find(q2 => q2.qkey === g.qkey);
      return {
        qkey:        g.qkey,
        qnum:        g.qnum,
        subject:     g.subject,
        subjectName: g.subjectName,
        stem:        g.stem,
        options:     g.options,   // 서버가 반환한 원본 선택지
        selected:    g.selected,
        correct:     g.correct,
        is_correct:  g.isCorrect === true ? 1 : (g.isCorrect === false ? 0 : null),
        explanation: g.explanation || null,
        image:       sq?.image || null,
        table:       sq?.table || null,
      };
    }),
  };
  Storage.addSession(session);

  navigate('result', { id: sessionId });
}

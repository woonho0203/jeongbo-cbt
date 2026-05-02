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

  const data = await api('/api/exam/start', {
    method: 'POST',
    body: JSON.stringify({ mode, sourceId, count, checkMode }),
  });

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

  // 북마크 미리 조회
  await Promise.all(state.questions.map(async q => {
    try {
      const r = await api(`/api/bookmarks/check/${encodeURIComponent(q.qkey)}`);
      if (r.bookmarked) state.bookmarks.add(q.qkey);
    } catch (e) {}
  }));

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

  // ── 문제 ──
  main.append(el('div', { class: 'qbox' }, [
    el('div', { class: 'qhead' }, [
      el('span', { class: 'qnum', text: `Q${state.currentIdx + 1} / ${state.questions.length}` }),
      el('span', { class: 'subject', text: q.subjectName || '' }),
      el('button', {
        class: `bookmark-btn ${state.bookmarks.has(q.qkey) ? 'on' : ''}`,
        onClick: () => toggleBookmark(state, q.qkey),
        text: state.bookmarks.has(q.qkey) ? '★' : '☆',
      }),
    ]),
    el('div', { class: 'qstem', text: q.stem }),
    ...(q.image ? [el('img', { class: 'qimg', src: q.image, alt: '문제 이미지' })] : []),
    ...(q.table ? [el('div', { class: 'qtable', html: q.table })] : []),
    el('div', { class: 'options' }, q.options.map((opt, i) => {
      const num = i + 1;
      let cls = 'opt';

      if (revealed) {
        // 정답 강조
        if (num === q.answer)                   cls += ' correct';
        else if (num === sel && sel !== q.answer) cls += ' wrong';
        cls += ' revealed-disabled';
      } else {
        if (sel === num) cls += ' selected';
      }

      return el('div', { class: cls, onClick: () => handleOptionClick(state, num) }, [
        el('div', { class: 'num', text: CIRCLES[i] }),
        el('div', { text: opt }),
      ]);
    })),
  ]));

  // ── 학습 모드: 정오답 피드백 ──
  if (revealed) {
    const isCorrect = sel === q.answer;
    const correctLabel = q.answer ? CIRCLES[q.answer - 1] : '?';
    main.append(
      el('div', { class: `check-feedback ${isCorrect ? 'correct' : 'wrong'}` },
        [ isCorrect ? `✅ 정답입니다!` : `❌ 틀렸습니다.  정답: ${correctLabel}` ]
      ),
      el('div', { class: 'check-next-hint', text: '아무 번호나 눌러 다음 문제로 →' }),
    );
    if (q.explanation) {
      main.append(el('div', { class: 'explanation' }, [
        el('strong', { text: '해설: ' }),
        el('span', { text: q.explanation }),
      ]));
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
          text: '번호키(1~4)로 선택하면 바로 채점됩니다',
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

    if (state.checkMode) {
      if (state.revealedAnswer) {
        // 어떤 키든 다음으로
        if (Date.now() - state.revealReadyAt > 300) {
          advanceCheckMode(state);
        }
      } else {
        if (e.key >= '1' && e.key <= '4') {
          handleOptionClick(state, parseInt(e.key, 10));
        } else if (e.key === 'ArrowLeft' && state.currentIdx > 0) {
          state.revealedAnswer = false;
          state.currentIdx--;
          renderQuestion(state); updateOMR(state);
        }
      }
      return;
    }

    // 일반 모드 단축키
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
    } else if (e.key === 'ArrowRight') {
      if (state.currentIdx < state.questions.length - 1) { state.currentIdx++; renderQuestion(state); updateOMR(state); }
    } else if (e.key === 'ArrowLeft') {
      if (state.currentIdx > 0) { state.currentIdx--; renderQuestion(state); updateOMR(state); }
    }
  };
}

// 선택지 클릭 처리
function handleOptionClick(state, num) {
  if (state.submitted) return;
  const q = state.questions[state.currentIdx];

  if (state.checkMode) {
    if (state.revealedAnswer) {
      // 이미 공개 상태 → 다음으로
      if (Date.now() - state.revealReadyAt > 300) advanceCheckMode(state);
    } else {
      state.answers.set(q.qkey, num);
      state.revealedAnswer = true;
      state.revealReadyAt = Date.now();
      renderQuestion(state);
      updateOMR(state);
    }
  } else {
    // 일반 모드: 선택 후 300ms 뒤 자동 다음
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
  wrapper.appendChild(el('div', { class: 'omr-summary', id: 'omr-summary' }, omrSummaryContents(state)));
  if (!state.checkMode) {
    wrapper.appendChild(el('button', { class: 'btn primary submit-btn', onClick: () => submitExam(state), text: '시험 제출하기' }));
  }
  return wrapper;
}

function omrSummaryContents(state) {
  const total    = state.questions.length;
  const answered = state.answers.size;
  if (state.checkMode && state.questions[0]?.answer != null) {
    const correct = state.questions.filter(q => state.answers.get(q.qkey) === q.answer).length;
    const wrong   = answered - correct;
    const gradable = state.questions.filter(q => q.answer != null).length;
    const score = gradable > 0 ? Math.round(correct / gradable * 100) : 0;
    return [
      el('div', {}, [el('span', { text: '현재 점수' }), el('span', { style: { color: score >= 60 ? 'var(--success)' : 'var(--danger)', fontWeight: '700' }, text: `${score} / 100` })]),
      el('div', {}, [el('span', { text: '정답' }), el('span', { style: { color: 'var(--success)', fontWeight: '600' }, text: `${correct}` })]),
      el('div', {}, [el('span', { text: '오답' }), el('span', { style: { color: 'var(--danger)',  fontWeight: '600' }, text: `${wrong}` })]),
      el('div', {}, [el('span', { text: '미풀이' }), el('span', { text: `${total - answered}` })]),
    ];
  }
  return [
    el('div', {}, [el('span', { text: '응답 완료' }), el('span', { text: `${answered} / ${total}` })]),
    el('div', {}, [el('span', { text: '미응답' }),   el('span', { text: `${total - answered}` })]),
    el('div', {}, [el('span', { text: '북마크' }),   el('span', { text: `${state.bookmarks.size}` })]),
  ];
}

function updateOMR(state) {
  const omr = document.getElementById('omr');
  if (!omr) return;
  omr.replaceWith(renderOMR(state));
}

async function toggleBookmark(state, qkey) {
  if (state.bookmarks.has(qkey)) {
    await api(`/api/bookmarks/${encodeURIComponent(qkey)}`, { method: 'DELETE' });
    state.bookmarks.delete(qkey);
  } else {
    await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ qkey }) });
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
  const answers = state.questions.map(q => ({
    qkey: q.qkey,
    selected: state.answers.get(q.qkey) || null,
  }));

  const result = await api('/api/exam/submit', {
    method: 'POST',
    body: JSON.stringify({
      mode: state.mode, sourceId: state.sourceId,
      title: state.title, durationSec, answers,
    }),
  });

  navigate('result', { id: result.sessionId });
}

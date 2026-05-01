// 시험 화면 - 가장 핵심 페이지
defineRoute('exam', async (app, params) => {
  const mode = params.mode || 'past';
  const sourceId = params.sourceId || '';
  const count = params.count ? parseInt(params.count, 10) : null;

  // 시험 시작 API 호출
  const data = await api('/api/exam/start', {
    method: 'POST',
    body: JSON.stringify({ mode, sourceId, count }),
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
    answers: new Map(),    // qkey -> selected (1-4)
    bookmarks: new Set(),
    startedAt: Date.now(),
    timerInterval: null,
    submitted: false,
    timeLimit: mode === 'past' || mode === 'random' ? 150 * 60 : 0,  // 150분 (선택)
  };

  // 북마크 미리 조회 (간단히 1개씩)
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
  // 모바일: 하단 고정 내비가 콘텐츠를 가리지 않도록 패딩 확보
  if (window.innerWidth <= 768) {
    app.style.paddingBottom = '70px';
  }
}

function startTimer(state) {
  if (state.timerInterval) clearInterval(state.timerInterval);
  const tick = () => {
    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    const remaining = state.timeLimit ? state.timeLimit - elapsed : null;
    const t = document.getElementById('timer');
    if (!t) return;
    if (remaining != null) {
      if (remaining <= 0) {
        clearInterval(state.timerInterval);
        t.textContent = '00:00';
        autoSubmit(state);
        return;
      }
      t.textContent = '⏱ ' + fmtTimer(remaining);
      t.style.color = remaining < 600 ? 'var(--danger)' : 'var(--primary)';
    } else {
      t.textContent = '⏱ ' + fmtTimer(elapsed);
    }
  };
  tick();
  state.timerInterval = setInterval(tick, 1000);
}

function renderQuestion(state) {
  const main = document.getElementById('exam-main');
  if (!main) return;
  const q = state.questions[state.currentIdx];
  main.innerHTML = '';

  main.append(
    el('div', { class: 'exam-header' }, [
      el('div', { class: 'title', text: state.title }),
      el('div', { class: 'timer', id: 'timer', text: '⏱ 00:00' }),
    ]),
    el('div', { class: 'qbox' }, [
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
      el('div', { class: 'options' }, q.options.map((opt, i) => {
        const num = i + 1;
        const selected = state.answers.get(q.qkey) === num;
        return el('div', { class: `opt ${selected ? 'selected' : ''}`, onClick: () => {
          state.answers.set(q.qkey, num);
          updateOMR(state);
          // 답 선택 시 300ms 후 자동으로 다음 문제로 이동
          if (state.currentIdx < state.questions.length - 1) {
            renderQuestion(state); // 선택 표시 먼저
            setTimeout(() => {
              state.currentIdx++;
              renderQuestion(state);
              updateOMR(state);
            }, 300);
          } else {
            renderQuestion(state);
          }
        } }, [
          el('div', { class: 'num', text: CIRCLES[i] }),
          el('div', { text: opt }),
        ]);
      })),
    ]),
    el('div', { class: 'exam-nav' }, [
      el('button', {
        class: 'btn',
        onClick: () => { if (state.currentIdx > 0) { state.currentIdx--; renderQuestion(state); updateOMR(state); } },
        disabled: state.currentIdx === 0,
        text: '◀ 이전',
      }),
      el('button', {
        class: 'btn',
        onClick: () => clearAnswer(state),
        text: '✕ 답 지우기',
      }),
      state.currentIdx === state.questions.length - 1
        ? el('button', { class: 'btn primary', onClick: () => submitExam(state), text: '제출하기' })
        : el('button', {
            class: 'btn primary',
            onClick: () => { state.currentIdx++; renderQuestion(state); updateOMR(state); },
            text: '다음 ▶',
          }),
    ]),
  );

  // 키보드 단축키 (1~4: 답 선택, ←/→: 이동)
  document.onkeydown = (e) => {
    if (state.submitted) return;
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

function clearAnswer(state) {
  const q = state.questions[state.currentIdx];
  state.answers.delete(q.qkey);
  renderQuestion(state);
  updateOMR(state);
}

function renderOMR(state) {
  const wrapper = el('div', { class: 'omr', id: 'omr' });
  wrapper.appendChild(el('h3', { text: 'OMR · 답안 현황' }));
  const grid = el('div', { class: 'omr-grid', id: 'omr-grid' });
  state.questions.forEach((q, i) => {
    const ans = state.answers.get(q.qkey);
    const isBook = state.bookmarks.has(q.qkey);
    const cur = i === state.currentIdx;
    const cls = `${ans ? 'answered' : ''} ${cur ? 'current' : ''} ${isBook ? 'bookmarked' : ''}`.trim();
    grid.appendChild(el('button', {
      class: cls,
      onClick: () => { state.currentIdx = i; renderQuestion(state); updateOMR(state); },
      text: ans ? `${i + 1}.${CIRCLES[ans - 1]}` : `${i + 1}`,
    }));
  });
  wrapper.appendChild(grid);
  wrapper.appendChild(el('div', { class: 'omr-summary', id: 'omr-summary' }, omrSummaryContents(state)));
  wrapper.appendChild(el('button', { class: 'btn primary submit-btn', onClick: () => submitExam(state), text: '시험 제출하기' }));
  return wrapper;
}

function omrSummaryContents(state) {
  const total = state.questions.length;
  const answered = state.answers.size;
  return [
    el('div', {}, [el('span', { text: '응답 완료' }), el('span', { text: `${answered} / ${total}` })]),
    el('div', {}, [el('span', { text: '미응답' }), el('span', { text: `${total - answered}` })]),
    el('div', {}, [el('span', { text: '북마크' }), el('span', { text: `${state.bookmarks.size}` })]),
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
    if (unanswered > 0) {
      const ok = await modalConfirm('제출 확인', `미응답 ${unanswered}문제가 있습니다. 제출하시겠습니까?`);
      if (!ok) return;
    } else {
      const ok = await modalConfirm('제출 확인', '시험을 제출하시겠습니까?');
      if (!ok) return;
    }
  }

  state.submitted = true;
  if (state.timerInterval) clearInterval(state.timerInterval);

  const durationSec = Math.floor((Date.now() - state.startedAt) / 1000);
  const answers = state.questions.map(q => ({
    qkey: q.qkey,
    selected: state.answers.get(q.qkey) || null,
  }));

  const result = await api('/api/exam/submit', {
    method: 'POST',
    body: JSON.stringify({
      mode: state.mode,
      sourceId: state.sourceId,
      title: state.title,
      durationSec,
      answers,
    }),
  });

  // 결과 화면으로 이동
  navigate('result', { id: result.sessionId });
}

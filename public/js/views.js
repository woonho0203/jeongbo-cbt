// 페이지별 렌더러: 홈, 대시보드, 시험기록, 오답노트, 북마크, 결과

// =================== 홈 ===================
defineRoute('home', async (app) => {
  const { exams, categories } = await api('/api/exams');
  const stats = await api('/api/stats');
  const wrong = await api('/api/wrong/count');

  const examModes = el('div', { class: 'mode-grid' }, [
    modeCard('📝', '회차별 기출문제', '2024-2025년 6회분, 100문제 시험형식', () => navigate('past-list')),
    modeCard('🎲', '랜덤 모의고사', '전체 문제에서 랜덤 100문제 추출', () => navigate('exam', { mode: 'random', count: 100 })),
    modeCard('📚', '유형별 연습', '계산/코드/문장/키워드/순서 5개 카테고리', () => navigate('category-list')),
    modeCard(`❌`, `오답 노트 (${wrong.count})`, '이전에 틀린 문제만 다시 풀기', () => {
      if (wrong.count === 0) return alert('아직 오답이 없습니다. 시험을 한 번 응시해 주세요.');
      navigate('exam', { mode: 'wrong' });
    }),
  ]);

  const studyModes = el('div', { class: 'mode-grid' }, [
    modeCard('📖', '회차별 학습', '회차별 기출문제 즉시 채점 모드', () => navigate('study-list'), 'study-mode'),
    modeCard('🔀', '랜덤 학습', '랜덤 문제 즉시 채점 모드', () => navigate('exam', { mode: 'random', count: 100, check: '1' }), 'study-mode'),
    modeCard('📂', '유형별 학습', '유형별 문제 즉시 채점 모드', () => navigate('study-list'), 'study-mode'),
    modeCard('❌', `오답 학습 (${wrong.count})`, '틀린 문제만 즉시 채점 모드', () => {
      if (wrong.count === 0) return alert('아직 오답이 없습니다. 시험을 한 번 응시해 주세요.');
      navigate('exam', { mode: 'wrong', check: '1' });
    }, 'study-mode'),
  ]);

  const lastScore = stats.lastScore != null ? stats.lastScore : null;
  const scoreColor = lastScore != null ? (lastScore >= 60 ? 'var(--success)' : 'var(--danger)') : 'var(--muted)';
  const summary = el('div', { class: 'dash-grid' }, [
    dashCard('총 응시 횟수', stats.totalSessions),
    dashCard('평균 점수', stats.totalSessions ? `${Math.round(stats.avgScore)}%` : '-'),
    dashCard('최고 점수', stats.bestScore != null ? `${Math.round(stats.bestScore)}%` : '-'),
    dashCard('최근 점수', lastScore != null ? `${Math.round(lastScore)}%` : '-', scoreColor),
  ]);

  app.innerHTML = '';
  app.append(
    el('h1', { class: 'section-title', text: '🗒 시험 모드' }),
    examModes,
    el('h2', { class: 'section-title', text: '📖 학습 모드' }),
    studyModes,
    el('h2', { class: 'section-title', text: '📊 학습 현황 요약' }),
    summary,
  );
});

function modeCard(icon, title, desc, onClick, extraClass = '') {
  return el('div', { class: `mode-card ${extraClass}`.trim(), onClick }, [
    el('div', { class: 'icon', text: icon }),
    el('h3', { text: title }),
    el('p', { text: desc }),
  ]);
}
function dashCard(label, value, color = '') {
  return el('div', { class: 'dash-card' }, [
    el('div', { class: 'label', text: label }),
    el('div', { class: 'value', text: value, style: color ? { color } : {} }),
  ]);
}

// =================== 회차별 기출문제 목록 ===================
defineRoute('past-list', async (app) => {
  const { exams } = await api('/api/exams');
  app.innerHTML = '';
  app.append(
    el('h1', { class: 'section-title', text: '회차별 기출문제' }),
    el('div', { class: 'list' }, exams.map(e =>
      el('div', { class: 'list-item' }, [
        el('div', { class: 'info' }, [
          el('div', { class: 'title', text: e.title }),
          el('div', { class: 'meta', text: `${e.count}문제 / 시험 시간 150분` }),
        ]),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn primary', onClick: () => navigate('exam', { mode: 'past', sourceId: e.examId }), text: '시험 시작' }),
        ]),
      ])
    )),
  );
});

// =================== 유형별 연습 목록 ===================
defineRoute('category-list', async (app) => {
  const { categories } = await api('/api/exams');
  app.innerHTML = '';
  app.append(
    el('h1', { class: 'section-title', text: '유형별 연습 모드' }),
    el('p', { class: 'card', text: '※ 유형별 자료는 정답 자동 채점 대신 학습용 해설이 함께 제공됩니다. 자체 채점 후 결과는 통계에 일부 반영됩니다.' }),
    el('div', { class: 'list' }, categories.map(c =>
      el('div', { class: 'list-item' }, [
        el('div', { class: 'info' }, [
          el('div', { class: 'title', text: c.title }),
          el('div', { class: 'meta', text: `${c.count}문제` }),
        ]),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn primary', onClick: () => navigate('exam', { mode: 'category', sourceId: c.categoryId }), text: '연습 시작' }),
        ]),
      ])
    )),
  );
});

// =================== 시험기록 ===================
defineRoute('history', async (app) => {
  const { sessions } = await api('/api/sessions');
  app.innerHTML = '';

  app.append(el('h1', { class: 'section-title', text: '📋 학습 기록' }));

  if (sessions.length === 0) {
    app.append(el('div', { class: 'card', text: '아직 응시한 시험이 없습니다.' }));
    return;
  }

  // 요약 통계
  const total = sessions.length;
  const avg = Math.round(sessions.reduce((a, s) => a + (s.score || 0), 0) / total);
  const best = Math.max(...sessions.map(s => s.score || 0));
  const passed = sessions.filter(s => s.score >= 60).length;
  app.append(el('div', { class: 'history-summary' }, [
    histStatCard('총 응시', `${total}회`),
    histStatCard('평균 점수', `${avg}%`),
    histStatCard('최고 점수', `${Math.round(best)}%`),
    histStatCard('합격권', `${passed}회`, passed > 0 ? 'var(--success)' : ''),
  ]));

  // 필터 탭 (전체 / 합격권 / 미달)
  let filter = 'all';
  const listWrap = el('div', { class: 'history-list' });

  const renderList = () => {
    listWrap.innerHTML = '';
    const filtered = filter === 'pass' ? sessions.filter(s => s.score >= 60)
                   : filter === 'fail' ? sessions.filter(s => s.score < 60)
                   : sessions;
    if (filtered.length === 0) {
      listWrap.append(el('p', { style: { padding: '16px', color: 'var(--muted)' }, text: '해당하는 기록이 없습니다.' }));
      return;
    }
    filtered.forEach(s => listWrap.append(historyCard(s)));
  };

  const tabs = ['all', 'pass', 'fail'];
  const tabLabels = { all: '전체', pass: '합격권(60%↑)', fail: '미달(60%↓)' };
  const tabBar = el('div', { class: 'filter-tabs' });
  tabs.forEach(t => {
    const btn = el('button', { class: `filter-tab${t === filter ? ' active' : ''}`, onClick: () => {
      filter = t;
      tabBar.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderList();
    }, text: tabLabels[t] });
    tabBar.append(btn);
  });

  app.append(tabBar, listWrap);
  renderList();
});

function histStatCard(label, value, color = '') {
  return el('div', { class: 'hist-stat' }, [
    el('div', { class: 'hist-stat-value', style: color ? { color } : {}, text: value }),
    el('div', { class: 'hist-stat-label', text: label }),
  ]);
}

function historyCard(s) {
  const score = Math.round(s.score);
  const pass = s.score >= 60;
  const modeLabel = { past: '기출문제', random: '랜덤 모의고사', category: '유형별 연습', wrong: '오답 풀기' };
  const card = el('div', { class: `history-card ${pass ? 'pass' : 'fail'}` });

  // 점수 원형 표시
  const ring = el('div', { class: 'score-ring' }, [
    el('div', { class: `score-ring-inner ${pass ? 'pass' : 'fail'}` }, [
      el('div', { class: 'score-ring-pct', text: `${score}%` }),
      el('div', { class: 'score-ring-label', text: pass ? '합격권' : '미달' }),
    ]),
  ]);

  // 정보 영역
  const info = el('div', { class: 'history-card-info' }, [
    el('div', { class: 'history-card-title', text: s.title || modeLabel[s.mode] || s.mode }),
    el('div', { class: 'history-card-meta' }, [
      el('span', { text: fmtDate(s.finished_at) }),
      el('span', { class: 'sep', text: '·' }),
      el('span', { text: `${s.correct_count}/${s.question_count}문제 정답` }),
      el('span', { class: 'sep', text: '·' }),
      el('span', { text: fmtDuration(s.duration_sec) }),
    ]),
  ]);

  // 과목별 미니 바
  if (s.subject_breakdown && Object.keys(s.subject_breakdown).length > 0) {
    const subjWrap = el('div', { class: 'history-subj-bars' });
    for (const sid of [1, 2, 3, 4, 5]) {
      const v = s.subject_breakdown[sid];
      if (!v || !v.total) continue;
      const r = Math.round(v.correct / v.total * 100);
      subjWrap.append(el('div', { class: 'history-subj-bar' }, [
        el('div', { class: 'history-subj-name', text: `과목${sid}` }),
        el('div', { class: 'history-mini-track' }, [
          el('div', { class: `history-mini-fill ${r >= 40 ? 'ok' : 'low'}`, style: { width: `${r}%` } }),
        ]),
        el('div', { class: 'history-subj-pct', text: `${r}%` }),
      ]));
    }
    info.append(subjWrap);
  }

  // 버튼
  const btns = el('div', { class: 'history-card-btns' }, [
    el('button', { class: 'btn small primary', onClick: () => navigate('result', { id: s.id }), text: '상세 보기' }),
    el('button', { class: 'btn small danger', onClick: async () => {
      if (await modalConfirm('삭제 확인', '이 기록을 삭제할까요?')) {
        await api(`/api/sessions/${s.id}`, { method: 'DELETE' });
        renderRoute();
      }
    }, text: '삭제' }),
  ]);

  card.append(ring, info, btns);
  return card;
}

// =================== 결과 상세 ===================
defineRoute('result', async (app, params) => {
  const id = params.id;
  const { session, answers } = await api(`/api/sessions/${id}`);
  let bd = session.subject_breakdown || {};

  app.innerHTML = '';

  // 헤더 + 요약
  app.append(
    el('h1', { class: 'section-title', text: `결과: ${session.title || session.mode}` }),
    el('div', { class: 'result-summary' }, [
      summaryCard('점수', `${Math.round(session.score)}%`, session.score >= 60 ? 'success' : 'danger'),
      summaryCard('정답', `${session.correct_count}/${session.question_count}`),
      summaryCard('소요 시간', fmtDuration(session.duration_sec)),
      summaryCard('합격 여부', session.score >= 60 ? '합격권' : '미달', session.score >= 60 ? 'success' : 'danger'),
    ]),
  );

  // 과목별 점수
  const subjEl = el('div', { class: 'card' }, [el('h2', { text: '과목별 정답률' })]);
  for (const sid of [1, 2, 3, 4, 5]) {
    const v = bd[sid];
    const rate = v && v.total ? Math.round(v.correct / v.total * 1000) / 10 : 0;
    const klass = !v || !v.total ? '' : rate >= 60 ? 'pass' : 'fail';
    subjEl.appendChild(el('div', { class: `subject-bar ${klass}` }, [
      el('div', { class: 'name', text: SUBJECT_NAMES[sid] }),
      el('div', { class: 'bar-track' }, [el('div', { class: 'bar-fill', style: { width: `${rate}%` } })]),
      el('div', { class: 'score', text: v && v.total ? `${rate}% (${v.correct}/${v.total})` : '-' }),
    ]));
  }
  app.append(subjEl);

  // 합격 기준 안내
  app.append(el('div', { class: 'card', text: '※ 합격 기준: 전체 평균 60점 이상 + 모든 과목 40점 이상 (정보처리기사 필기)' }));

  // 문제 리뷰
  app.append(el('h2', { class: 'section-title', text: '문제별 결과' }));
  const list = el('div', { class: 'review-list' });
  answers.forEach((a, i) => {
    const klass = a.is_correct === 1 ? 'correct' : a.is_correct === 0 ? 'wrong' : 'unknown';
    const item = el('div', { class: `review-item ${klass}` });
    item.appendChild(el('div', { class: 'qhead' }, [
      el('span', { class: 'qnum', text: `Q${i + 1}` }),
      el('span', { class: 'subject', text: a.subjectName || '' }),
    ]));
    for (const node of renderStem(a.stem || '(문제 본문 없음)')) item.appendChild(node);
    if (a.image) item.appendChild(el('img', { class: 'qimg', src: a.image, alt: '문제 이미지' }));
    if (a.table) item.appendChild(el('div', { class: 'qtable', html: a.table }));
    if (a.options) {
      const opts = el('div', { class: 'options' });
      a.options.forEach((txt, oi) => {
        const num = oi + 1;
        let oclass = 'opt';
        if (a.correct === num) oclass += ' correct';
        if (a.selected === num && a.is_correct === 0) oclass += ' wrong';
        opts.appendChild(el('div', { class: oclass }, [
          el('div', { class: 'num', text: CIRCLES[oi] }),
          el('div', { text: txt }),
        ]));
      });
      item.appendChild(opts);
    }
    if (a.explanation) {
      item.appendChild(el('div', { class: 'explanation' }, [
        el('strong', { text: '해설: ' }),
        el('span', { text: a.explanation }),
      ]));
    }
    list.appendChild(item);
  });
  app.append(list);
});

function summaryCard(label, value, kind = '') {
  return el('div', { class: `summary-card ${kind}` }, [
    el('div', { class: 'label', text: label }),
    el('div', { class: 'value', text: value }),
  ]);
}

// =================== 대시보드 ===================
defineRoute('dashboard', async (app) => {
  const stats = await api('/api/stats');
  app.innerHTML = '';
  app.append(el('h1', { class: 'section-title', text: '학습 통계 대시보드' }));

  if (stats.totalSessions === 0) {
    app.append(el('div', { class: 'card', text: '아직 데이터가 없습니다. 시험을 응시하면 여기에 통계가 나타납니다.' }));
    return;
  }

  // 핵심 지표
  app.append(el('div', { class: 'dash-grid' }, [
    dashCard('총 응시 횟수', stats.totalSessions),
    dashCard('평균 점수', `${Math.round(stats.avgScore)}%`),
    dashCard('최고 점수', `${Math.round(stats.bestScore)}%`),
    dashCard('최근 점수', `${Math.round(stats.lastScore)}%`),
  ]));

  // 점수 추세 차트 (간단 SVG)
  app.append(scoreTrendChart(stats.recentTrend));

  // 과목별 평균
  const subjEl = el('div', { class: 'card' }, [el('h2', { text: '과목별 평균 정답률' })]);
  for (const sid of [1, 2, 3, 4, 5]) {
    const v = stats.subjectAvg[sid];
    const rate = v ? v.rate : 0;
    const klass = rate >= 60 ? 'pass' : rate > 0 ? 'fail' : '';
    subjEl.appendChild(el('div', { class: `subject-bar ${klass}` }, [
      el('div', { class: 'name', text: SUBJECT_NAMES[sid] }),
      el('div', { class: 'bar-track' }, [el('div', { class: 'bar-fill', style: { width: `${rate}%` } })]),
      el('div', { class: 'score', text: v ? `${rate}% (${v.correct}/${v.total})` : '-' }),
    ]));
  }
  app.append(subjEl);

  // 최근 5개 응시
  app.append(
    el('h2', { class: 'section-title', text: '최근 응시 기록' }),
    el('div', { class: 'list' }, stats.recent.map(r =>
      el('div', { class: 'list-item' }, [
        el('div', { class: 'info' }, [
          el('div', { class: 'title', text: r.title }),
          el('div', { class: 'meta', text: `${fmtDate(r.finishedAt)} · ${r.correct}/${r.total}` }),
        ]),
        el('div', { class: 'actions' }, [
          el('div', { class: `summary-card ${r.score >= 60 ? 'success' : 'danger'}`, style: { padding: '6px 14px', minWidth: '70px' } }, [
            el('div', { class: 'value', style: { fontSize: '1.2rem' }, text: `${Math.round(r.score)}%` }),
          ]),
          el('button', { class: 'btn small', onClick: () => navigate('result', { id: r.id }), text: '상세' }),
        ]),
      ])
    )),
  );
});

function scoreTrendChart(trend) {
  const w = 720, h = 200, pad = 30;
  const wrapper = el('div', { class: 'chart-container' }, [el('h2', { text: '최근 점수 추세' })]);
  if (!trend || trend.length === 0) {
    wrapper.appendChild(el('p', { text: '데이터 없음', style: { color: 'var(--muted)' } }));
    return wrapper;
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');

  // 격자선 (60점)
  const y60 = h - pad - (60 / 100) * (h - pad * 2);
  const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  baseline.setAttribute('x1', pad); baseline.setAttribute('x2', w - pad);
  baseline.setAttribute('y1', y60); baseline.setAttribute('y2', y60);
  baseline.setAttribute('stroke', '#e64545'); baseline.setAttribute('stroke-dasharray', '4 3');
  svg.appendChild(baseline);

  const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  txt.setAttribute('x', w - pad - 4); txt.setAttribute('y', y60 - 4);
  txt.setAttribute('text-anchor', 'end'); txt.setAttribute('font-size', 11); txt.setAttribute('fill', '#e64545');
  txt.textContent = '합격선 60점';
  svg.appendChild(txt);

  const n = trend.length;
  const xStep = (w - pad * 2) / Math.max(1, n - 1);
  const pts = trend.map((p, i) => ({
    x: pad + i * xStep,
    y: h - pad - ((p.score || 0) / 100) * (h - pad * 2),
    s: p.score, t: p.title,
  }));

  // 선
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  path.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#3b6ef5'); path.setAttribute('stroke-width', '2');
  svg.appendChild(path);

  // 점
  pts.forEach(p => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 4);
    c.setAttribute('fill', '#3b6ef5');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${p.s}점 - ${p.t}`;
    c.appendChild(title);
    svg.appendChild(c);

    const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lbl.setAttribute('x', p.x); lbl.setAttribute('y', p.y - 8);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('font-size', 11); lbl.setAttribute('fill', isDark ? '#dde2f0' : '#232a3b');
    lbl.textContent = p.s;
    svg.appendChild(lbl);
  });

  wrapper.appendChild(svg);
  return wrapper;
}

// =================== 학습 모드 목록 ===================
defineRoute('study-list', async (app) => {
  const { exams, categories } = await api('/api/exams');
  app.innerHTML = '';
  app.append(
    el('h1', { class: 'section-title', text: '📖 학습 모드' }),
    el('div', { class: 'card' }, [
      el('p', { text: '번호키(1~4)로 답 선택 → 즉시 정오답 확인 → 번호키 한 번 더 누르면 다음 문제로 이동합니다.' }),
    ]),
    el('h2', { class: 'section-title', style: { fontSize: '1.1rem', marginTop: '8px' }, text: '회차별 기출' }),
    el('div', { class: 'list' }, exams.map(e =>
      el('div', { class: 'list-item' }, [
        el('div', { class: 'info' }, [
          el('div', { class: 'title', text: e.title }),
          el('div', { class: 'meta', text: `${e.count}문제` }),
        ]),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn success', onClick: () => navigate('exam', { mode: 'past', sourceId: e.examId, check: '1' }), text: '학습 시작' }),
        ]),
      ])
    )),
    el('h2', { class: 'section-title', style: { fontSize: '1.1rem', marginTop: '16px' }, text: '유형별 연습' }),
    el('div', { class: 'list' }, categories.map(c =>
      el('div', { class: 'list-item' }, [
        el('div', { class: 'info' }, [
          el('div', { class: 'title', text: c.title }),
          el('div', { class: 'meta', text: `${c.count}문제` }),
        ]),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn success', onClick: () => navigate('exam', { mode: 'category', sourceId: c.categoryId, check: '1' }), text: '학습 시작' }),
        ]),
      ])
    )),
  );
});

// =================== 오답 노트 ===================
defineRoute('wrong', async (app) => {
  const wrong = await api('/api/wrong/count');
  app.innerHTML = '';
  app.append(
    el('h1', { class: 'section-title', text: '오답 노트' }),
    el('div', { class: 'card' }, [
      el('p', { text: `현재 미해결 오답: ${wrong.count}문제` }),
      el('br'),
      wrong.count > 0
        ? el('button', { class: 'btn primary large', onClick: () => navigate('exam', { mode: 'wrong' }), text: '오답 다시 풀기' })
        : el('p', { text: '아직 오답이 없습니다. 시험을 응시하면 자동으로 기록됩니다.' }),
    ]),
  );
});

// =================== 북마크 ===================
defineRoute('bookmarks', async (app) => {
  const { bookmarks } = await api('/api/bookmarks');
  app.innerHTML = '';
  app.append(
    el('h1', { class: 'section-title', text: '북마크 한 문제' }),
  );
  if (bookmarks.length === 0) {
    app.append(el('div', { class: 'card', text: '아직 북마크된 문제가 없습니다. 시험 화면에서 ⭐ 버튼을 누르면 추가됩니다.' }));
    return;
  }
  const list = el('div', { class: 'review-list' });
  bookmarks.forEach((b, i) => {
    const item = el('div', { class: 'review-item' });
    item.appendChild(el('div', { class: 'qhead' }, [
      el('span', { class: 'qnum', text: `★ ${i + 1}` }),
      el('span', { class: 'subject', text: b.subjectName || '' }),
      el('button', { class: 'btn small danger', onClick: async () => {
        await api(`/api/bookmarks/${encodeURIComponent(b.qkey)}`, { method: 'DELETE' });
        renderRoute();
      }, text: '북마크 해제' }),
    ]));
    for (const node of renderStem(b.stem || '')) item.appendChild(node);
    if (b.image) item.appendChild(el('img', { class: 'qimg', src: b.image, alt: '문제 이미지' }));
    if (b.table) item.appendChild(el('div', { class: 'qtable', html: b.table }));
    if (b.options) {
      const opts = el('div', { class: 'options' });
      b.options.forEach((txt, oi) => {
        const num = oi + 1;
        let oclass = 'opt';
        if (b.answer === num) oclass += ' correct';
        opts.appendChild(el('div', { class: oclass }, [
          el('div', { class: 'num', text: CIRCLES[oi] }),
          el('div', { text: txt }),
        ]));
      });
      item.appendChild(opts);
    }
    if (b.explanation) {
      item.appendChild(el('div', { class: 'explanation' }, [el('strong', { text: '해설: ' }), el('span', { text: b.explanation })]));
    }
    list.appendChild(item);
  });
  app.append(list);
});

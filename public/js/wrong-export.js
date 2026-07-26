// 기기별 미해결 오답 JSON 내보내기
const WrongExport = (() => {
  const FORMAT = 'jeongbo-cbt-wrong-export';
  const VERSION = 1;

  function readLocalJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : (JSON.parse(raw) ?? fallback);
    } catch {
      return fallback;
    }
  }

  function detectDevice() {
    const userAgent = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const touchPoints = navigator.maxTouchPoints || 0;
    const isIPad = /iPad/i.test(userAgent)
      || (/Macintosh/i.test(userAgent) && platform === 'MacIntel' && touchPoints > 1);

    if (isIPad) return '아이패드';
    if (/Android/i.test(userAgent)) {
      return /Samsung|SM-|Galaxy/i.test(userAgent) ? '갤럭시' : '안드로이드';
    }
    return 'PC';
  }

  function localDateString(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function unresolvedWrongEntries(wrongLog) {
    if (!wrongLog || typeof wrongLog !== 'object' || Array.isArray(wrongLog)) return [];
    return Object.entries(wrongLog)
      .filter(([, record]) => record && record.cleared === false)
      .sort(([, a], [, b]) => String(b.lastWrongAt || '').localeCompare(String(a.lastWrongAt || '')));
  }

  function sessionWrongHistory(sessions, qkey) {
    if (!Array.isArray(sessions)) return [];

    const history = [];
    for (const session of sessions) {
      if (!session || !Array.isArray(session.answers)) continue;
      for (const answer of session.answers) {
        if (!answer || answer.qkey !== qkey) continue;
        const result = answer.is_correct ?? answer.isCorrect;
        const isWrong = result === 0 || result === false || result === '0';
        if (!isWrong) continue;

        history.push({
          sessionId: session.id ?? null,
          mode: session.mode ?? null,
          title: session.title ?? null,
          finishedAt: session.finished_at ?? session.finishedAt ?? null,
          selected: answer.selected ?? null,
          correct: answer.correct ?? null,
          isCorrect: false,
        });
      }
    }
    return history;
  }

  function triggerDownload(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      // iOS Safari가 JSON을 새 탭에 표시하지 않고 파일로 처리하도록 강제한다.
      type: 'application/octet-stream',
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();

    // 모바일 Safari가 다운로드 스트림을 충분히 읽은 뒤 URL을 해제하도록 여유를 둔다.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }

  async function download() {
    const wrongLog = readLocalJson('cbt_wrong', {});
    const sessions = readLocalJson('cbt_sessions', []);
    const unresolved = unresolvedWrongEntries(wrongLog);
    const device = detectDevice();

    if (unresolved.length === 0) {
      return {
        downloaded: false,
        device,
        wrongCount: 0,
        message: '저장할 미해결 오답이 없습니다.',
      };
    }

    const wrongKeys = unresolved.map(([qkey]) => qkey);
    const data = await api('/api/exam/start', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'wrong',
        sourceId: '',
        count: null,
        checkMode: true,
        wrongKeys,
        seenKeys: [],
      }),
    });

    const questionByKey = new Map((data.questions || []).map(question => [question.qkey, question]));
    const questions = unresolved.flatMap(([qkey, wrongRecord]) => {
      const question = questionByKey.get(qkey);
      if (!question) return [];
      return [{
        qkey,
        '과목명': question.subjectName || '',
        '문제': question.stem || '',
        '선택지': Array.isArray(question.options) ? question.options : [],
        '정답': question.answer ?? null,
        '사용자가 마지막으로 선택한 답': wrongRecord.lastSelected ?? null,
        '누적 오답 횟수': wrongRecord.wrongCount || 0,
        '마지막 오답 날짜': wrongRecord.lastWrongAt || null,
        '해설': question.explanation || null,
        '기존 오답 기록': sessionWrongHistory(sessions, qkey),
      }];
    });

    const exportedAt = new Date();
    const payload = {
      format: FORMAT,
      version: VERSION,
      exportedAt: exportedAt.toISOString(),
      device,
      wrongCount: questions.length,
      questions,
    };
    const filename = `정보처리기사_CBT_오답원본_${device}_${localDateString(exportedAt)}.json`;
    triggerDownload(payload, filename);

    return {
      downloaded: true,
      device,
      wrongCount: questions.length,
      filename,
      payload,
      message: `${device}의 오답 ${questions.length}문제를 저장했습니다.`,
    };
  }

  function showMessage(message, type = 'success') {
    document.getElementById('wrong-export-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'wrong-export-toast';
    toast.className = `export-toast ${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  return { download, detectDevice, showMessage };
})();

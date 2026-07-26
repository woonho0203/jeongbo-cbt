import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../public/js/wrong-export.js', import.meta.url), 'utf8');

function createHarness({
  wrongLog = {},
  sessions = [],
  userAgent = 'Mozilla/5.0',
  platform = 'Win32',
  maxTouchPoints = 0,
  questions = [],
} = {}) {
  const stored = new Map([
    ['cbt_wrong', JSON.stringify(wrongLog)],
    ['cbt_sessions', JSON.stringify(sessions)],
  ]);
  const apiCalls = [];
  let clicked = false;
  let downloadedFilename = '';
  let createdBlob = null;
  let revokedUrl = null;

  const context = vm.createContext({
    console,
    Blob,
    navigator: { userAgent, platform, maxTouchPoints },
    localStorage: {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    },
    api: async (path, options) => {
      apiCalls.push({ path, options });
      return { questions };
    },
    URL: {
      createObjectURL: blob => {
        createdBlob = blob;
        return 'blob:test-download';
      },
      revokeObjectURL: url => {
        revokedUrl = url;
      },
    },
    document: {
      body: { appendChild() {} },
      createElement: tag => {
        assert.equal(tag, 'a');
        return {
          style: {},
          set href(value) {
            assert.equal(value, 'blob:test-download');
          },
          set download(value) {
            downloadedFilename = value;
          },
          click() {
            clicked = true;
          },
          remove() {},
        };
      },
    },
    setTimeout: callback => {
      callback();
      return 1;
    },
  });

  vm.runInContext(`${source}\n;globalThis.__WrongExport = WrongExport;`, context);
  return {
    exportApi: context.__WrongExport,
    apiCalls,
    stored,
    get clicked() { return clicked; },
    get downloadedFilename() { return downloadedFilename; },
    get createdBlob() { return createdBlob; },
    get revokedUrl() { return revokedUrl; },
  };
}

test('미해결 오답만 전체 내용과 기존 오답 기록을 포함해 다운로드한다', async () => {
  const qkey = 'past:2023-1:1';
  const harness = createHarness({
    wrongLog: {
      [qkey]: {
        cleared: false,
        lastSelected: 2,
        wrongCount: 3,
        lastWrongAt: '2026-07-26T01:02:03.000Z',
      },
      'past:2023-1:2': {
        cleared: true,
        lastSelected: 1,
        wrongCount: 1,
        lastWrongAt: '2026-07-25T01:02:03.000Z',
      },
    },
    sessions: [
      {
        id: 20,
        mode: 'past',
        title: '2023년 1회',
        finished_at: '2026-07-26T01:02:03.000Z',
        answers: [
          { qkey, selected: 2, correct: 3, is_correct: 0 },
          { qkey: 'past:2023-1:2', selected: 1, correct: 1, is_correct: 1 },
        ],
      },
      {
        id: 10,
        mode: 'past',
        title: '2023년 1회',
        finished_at: '2026-07-20T01:02:03.000Z',
        answers: [{ qkey, selected: 3, correct: 3, is_correct: 1 }],
      },
    ],
    questions: [{
      qkey,
      subjectName: '소프트웨어 설계',
      stem: '워크스루에 대한 설명으로 틀린 것은?',
      options: ['보기 1', '보기 2', '보기 3', '보기 4'],
      answer: 3,
      explanation: '워크스루와 인스펙션은 서로 다르다.',
    }],
  });

  const result = await harness.exportApi.download();
  assert.equal(result.downloaded, true);
  assert.equal(harness.clicked, true);
  assert.match(harness.downloadedFilename, /^정보처리기사_CBT_오답원본_PC_\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(harness.revokedUrl, 'blob:test-download');

  assert.equal(harness.apiCalls.length, 1);
  assert.equal(harness.apiCalls[0].path, '/api/exam/start');
  assert.deepEqual(JSON.parse(harness.apiCalls[0].options.body), {
    mode: 'wrong',
    sourceId: '',
    count: null,
    checkMode: true,
    wrongKeys: [qkey],
    seenKeys: [],
  });

  const payload = JSON.parse(await harness.createdBlob.text());
  assert.equal(harness.createdBlob.type, 'application/octet-stream');
  assert.equal(payload.format, 'jeongbo-cbt-wrong-export');
  assert.equal(payload.version, 1);
  assert.equal(payload.device, 'PC');
  assert.equal(payload.wrongCount, 1);
  assert.equal(payload.questions[0].qkey, qkey);
  assert.equal(payload.questions[0]['과목명'], '소프트웨어 설계');
  assert.equal(payload.questions[0]['문제'], '워크스루에 대한 설명으로 틀린 것은?');
  assert.deepEqual(payload.questions[0]['선택지'], ['보기 1', '보기 2', '보기 3', '보기 4']);
  assert.equal(payload.questions[0]['정답'], 3);
  assert.equal(payload.questions[0]['사용자가 마지막으로 선택한 답'], 2);
  assert.equal(payload.questions[0]['누적 오답 횟수'], 3);
  assert.equal(payload.questions[0]['마지막 오답 날짜'], '2026-07-26T01:02:03.000Z');
  assert.equal(payload.questions[0]['해설'], '워크스루와 인스펙션은 서로 다르다.');
  assert.equal(payload.questions[0]['기존 오답 기록'].length, 1);
  assert.equal(payload.questions[0]['기존 오답 기록'][0].sessionId, 20);
  assert.match(payload.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('미해결 오답이 없으면 API와 다운로드를 실행하지 않는다', async () => {
  const harness = createHarness({
    wrongLog: {
      'past:2023-1:1': { cleared: true, wrongCount: 1 },
    },
  });

  const result = await harness.exportApi.download();
  assert.equal(result.downloaded, false);
  assert.equal(result.wrongCount, 0);
  assert.equal(harness.apiCalls.length, 0);
  assert.equal(harness.clicked, false);
});

test('아이패드·갤럭시·일반 Android·PC를 구분한다', () => {
  assert.equal(createHarness({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Mobile/15E148',
    platform: 'MacIntel',
    maxTouchPoints: 5,
  }).exportApi.detectDevice(), '아이패드');

  assert.equal(createHarness({
    userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S928N) AppleWebKit Chrome Mobile',
    platform: 'Linux armv8l',
  }).exportApi.detectDevice(), '갤럭시');

  assert.equal(createHarness({
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit Chrome Mobile',
    platform: 'Linux armv8l',
  }).exportApi.detectDevice(), '안드로이드');

  assert.equal(createHarness().exportApi.detectDevice(), 'PC');
});

test('오답노트 버튼과 자동 내보내기 해시 라우트가 등록되어 있다', async () => {
  const views = await readFile(new URL('../public/js/views.js', import.meta.url), 'utf8');
  const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(views, /📥 오답 파일 다운로드/);
  assert.match(views, /defineRoute\('export-wrong'/);
  assert.match(index, /\/js\/wrong-export\.js/);
});

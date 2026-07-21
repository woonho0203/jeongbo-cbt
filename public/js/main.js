// 진입점: 라우터에 의해 자동으로 home 렌더링됨
console.log('정보처리기사 CBT 앱 로드 완료');

fetch('/version.json').then(r => r.ok ? r.json() : null).then(v => {
  if (!v) return;
  const el = document.getElementById('app-version');
  if (el) el.textContent = `v${v.version}`;
}).catch(() => {});

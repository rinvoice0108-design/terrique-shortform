/**
 * 구글 시트에 AI 추천 주제를 추가하는 스크립트
 * 실행: node scripts/add-topics.js
 */

import { google } from 'googleapis';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SERVICE_ACCOUNT_PATH = join(ROOT, 'service-account.json');
const SHEETS_ID = '17LkxbMlrbq9gRv4s2d7-Yts53N-ex4q4iXEy4B8Dv6c';

const AI_TOPICS = [
  ['섬유유연제가 수건 흡수력을 망치는 이유', '수건'],
  ['호텔 수건이 항상 부드러운 비밀', '수건'],
  ['수건 교체 시기, 이 신호 보이면 바꾸세요', '수건'],
  ['뻣뻣해진 수건 다시 부드럽게 만드는 법', '수건'],
  ['새 수건 처음 세탁하는 올바른 방법', '수건'],
  ['수건 냄새 완전히 없애는 방법', '수건'],
  ['수건 색이 바래는 진짜 이유', '수건'],
  ['면 100% 수건이 피부에 좋은 이유', '수건'],
  ['수건 건조 방법, 이렇게 해야 오래 쓴다', '수건'],
  ['먼지(보풀) 없는 수건 고르는 기준', '수건'],
  ['수건 세탁 온도, 몇 도가 정답일까', '수건'],
  ['욕실 인테리어, 수건 컬러 하나로 바꾸는 법', '수건'],
  ['수건으로 알 수 있는 내 피부 타입', '수건'],
  ['수건 흡수력이 갑자기 떨어지는 이유', '수건'],
  ['목욕 수건 vs 핸드 타월 구분해서 쓰는 법', '수건'],
  ['올풀림 없는 수건 오래 쓰는 관리법', '수건'],
  ['수건 정리법, 욕실이 호텔처럼 보이는 방법', '수건'],
  ['아이 피부에 좋은 수건 소재 고르는 기준', '수건'],
  ['아직도 수건을 뜨거운 물로 세탁하세요', '수건'],
  ['수건 한 장으로 욕실 분위기 바꾸는 법', '수건'],
  ['결혼 답례품 준비 타임라인', '답례품'],
  ['하객들이 가장 좋아하는 답례품 1위', '답례품'],
  ['돌잔치 답례품으로 수건이 좋은 이유', '답례품'],
  ['답례품 예산별 추천 구성', '답례품'],
  ['답례품 수건 포장, 이렇게 하면 퀄리티 달라진다', '답례품'],
  ['결혼 준비 D-30, 답례품 체크리스트', '답례품'],
  ['실용적인 답례품 vs 예쁜 답례품, 뭐가 나을까', '답례품'],
  ['수건 + 핸드워시 세트가 답례품으로 인기인 이유', '답례품'],
  ['소규모 결혼식 답례품 추천', '답례품'],
  ['답례품 수량 계산하는 법', '답례품'],
  ['결혼식 테마 컬러에 맞는 답례품 매칭법', '답례품'],
  ['답례품 받는 사람이 진짜 원하는 것', '답례품'],
  ['명절 선물로 수건이 좋은 이유', '답례품'],
  ['답례품 직접 포장 vs 업체 의뢰 비교', '답례품'],
  ['답례품 수건 색상 고르는 팁', '답례품'],
];

async function main() {
  if (!existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ service-account.json 파일이 없습니다.');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // 헤더 확인 및 설정
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_ID,
    range: 'A1:D1',
  });
  const firstRow = (headerRes.data.values || [])[0] || [];
  if (firstRow[0] !== '주제') {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEETS_ID,
      range: 'A1:D1',
      valueInputOption: 'RAW',
      requestBody: { values: [['주제', '카테고리', '출처', '상태']] },
    });
    console.log('✅ 헤더 추가 완료');
  }

  // 기존 주제 목록 읽기 (중복 방지)
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_ID,
    range: 'A:A',
  });
  const existing = new Set(
    (existingRes.data.values || []).flat().map(t => t.trim().toLowerCase())
  );
  console.log(`📋 기존 주제 수: ${existing.size - 1}개`); // 헤더 제외

  // 추가할 주제 필터링
  const toAdd = AI_TOPICS.filter(([topic]) => !existing.has(topic.toLowerCase()));
  if (toAdd.length === 0) {
    console.log('✅ 추가할 주제 없음 (이미 모두 시트에 있음)');
    return;
  }

  // 시트에 추가
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEETS_ID,
    range: 'A:D',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: toAdd.map(([topic, category]) => [topic, category, 'AI추천', '']),
    },
  });

  console.log(`✅ ${toAdd.length}개 주제 추가 완료!`);
  toAdd.forEach(([t, c]) => console.log(`   [${c}] ${t}`));
}

main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});

import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const USED_PATH           = join(ROOT, 'used-topics.json');
const SERVICE_ACCOUNT_PATH = join(ROOT, 'service-account.json');

// ──────────────────────────────────────────────
// 구글 시트 읽기 (CSV — 인증 불필요)
// ──────────────────────────────────────────────
export async function fetchTopicsFromSheets(sheetsId) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetsId}/export?format=csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Sheets 접근 실패 (${res.status})`);

  const csv = await res.text();
  const rows = csv.split('\n').map(row =>
    row.split(',').map(c => c.trim().replace(/^"|"$/g, '').trim())
  );

  // 헤더 제거, 빈 행 제거
  const allTopics = rows.slice(1)
    .filter(row => row[0]?.trim())
    .map(row => ({
      topic:    row[0].trim(),
      category: row[1]?.trim() || '수건',
      source:   row[2]?.trim() || '직접입력',  // C열: 비어있으면 직접입력
      status:   row[3]?.trim() || ''   // D열: 완료 시 건너뜀
    }));

  // D열에 "완료" 표시된 주제 제외
  const available = allTopics.filter(t => t.status !== '완료');

  // 중복 주제명 제거 (첫 번째만 사용)
  const seen = new Set();
  return available.filter(t => {
    const key = t.topic.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ──────────────────────────────────────────────
// 구글 시트 전체 주제명 읽기 (중복 방지용, 완료 포함)
// ──────────────────────────────────────────────
export async function fetchAllTopicNames(sheetsId) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetsId}/export?format=csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Sheets 접근 실패 (${res.status})`);
  const csv = await res.text();
  return csv.split('\n')
    .slice(1)
    .map(row => row.split(',')[0]?.trim().replace(/^"|"$/g, '').trim())
    .filter(Boolean);
}

// ──────────────────────────────────────────────
// 구글 시트 신규 주제 추가
// ──────────────────────────────────────────────
export async function addTopicsToSheet(newTopics, sheetsId) {
  const sheets = await getSheetClient();
  if (!sheets) return false;
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetsId,
    range: 'A:D',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: newTopics.map(t => [t.topic, t.category, 'AI추천', ''])
    }
  });
  return true;
}

// ──────────────────────────────────────────────
// 구글 시트 쓰기 — "완료" 표시 (Service Account)
// ──────────────────────────────────────────────
async function getSheetClient() {
  if (!existsSync(SERVICE_ACCOUNT_PATH)) return null;
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export async function markTopicUsedInSheet(topicName, sheetsId) {
  const sheets = await getSheetClient();
  if (!sheets) return false; // service-account.json 없으면 skip

  try {
    // A열 전체 읽어서 해당 주제의 행 번호 찾기
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetsId,
      range: 'A:A',
    });

    const rows = res.data.values || [];
    // 헤더 포함 검색 (1-based row number)
    const rowNum = rows.findIndex(r => r[0]?.trim() === topicName) + 1;
    if (rowNum <= 0) return false;

    // D열 해당 행에 "완료" 기록
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetsId,
      range: `D${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['완료']] },
    });

    return true;
  } catch (e) {
    console.warn('⚠️  구글 시트 완료 표시 실패 (used-topics.json으로 대체):', e.message);
    return false;
  }
}

// ──────────────────────────────────────────────
// 로컬 used-topics.json 관리
// ──────────────────────────────────────────────
export function getUsedTopics() {
  if (!existsSync(USED_PATH)) return { used: [], lastCategory: null };
  try {
    return JSON.parse(readFileSync(USED_PATH, 'utf8'));
  } catch {
    return { used: [], lastCategory: null };
  }
}

export function markTopicUsedLocal(topicObj) {
  const data = getUsedTopics();
  if (!data.used.includes(topicObj.topic)) {
    data.used.push(topicObj.topic);
  }
  data.lastCategory = topicObj.category;
  writeFileSync(USED_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ──────────────────────────────────────────────
// 다음 주제 쌍 선택 (수건 1개 + 답례품 1개)
// ──────────────────────────────────────────────
export function getNextTopicPair(topics, usedData) {
  const { used } = usedData;
  const unused = topics.filter(t => !used.includes(t.topic));
  const towel = unused.find(t => t.category === '수건')   || null;
  const gift  = unused.find(t => t.category === '답례품') || null;
  return { towel, gift };
}

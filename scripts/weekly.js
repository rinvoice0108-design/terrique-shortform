import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchTopicsFromSheets, fetchAllTopicNames, addTopicsToSheet, getUsedTopics, getNextTopicPair, markTopicUsedLocal, markTopicUsedInSheet } from './sheets.js';
import { generateContent, generateTopicSuggestions } from './generator.js';
import { sendEmail } from './send-email.js';
import { isSendDay } from './send-day-check.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

export function loadEnv() {
  const envPath = join(ROOT, '.env');
  const env = {};
  if (existsSync(envPath)) {
    readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const i = t.indexOf('=');
      if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    });
  }
  return { ...process.env, ...env };
}

// topic-override.txt 에 주제를 적어두면 그 주제로 생성
// 형식: "주제|카테고리" (예: "수건 색이 바래는 이유|수건")
// 카테고리 생략 시 기본값: 수건
function checkTopicOverride() {
  const p = join(ROOT, 'topic-override.txt');
  if (!existsSync(p)) return null;
  const content = readFileSync(p, 'utf8');
  const activeLine = content.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'));
  if (!activeLine) return null;
  const [topic, category] = activeLine.split('|').map(s => s.trim());
  return { topic, category: category || '수건' };
}

async function main() {
  const isTest = process.argv.includes('--test');
  const env = loadEnv();

  if (!isTest && !isSendDay()) {
    console.log('오늘은 발송일이 아닙니다 (월요일 또는 월요일 공휴일 시 화요일만 발송). 종료합니다.');
    process.exit(0);
  }

  if (!env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY가 .env에 없습니다.');
    process.exit(1);
  }

  console.log('🚀 테리크 숏폼 시스템 시작...\n');

  // 1. 주제 결정
  let pair = { towel: null, gift: null };   // { towel: topicObj, gift: topicObj }
  let topics = [];
  const override = checkTopicOverride();

  if (override) {
    // 수동 오버라이드: 카테고리에 맞는 슬롯에 배치
    if (override.category === '답례품') pair.gift  = override;
    else                                 pair.towel = override;
    console.log(`📌 수동 주제: [${override.category}] ${override.topic}`);
  } else {
    if (!env.GOOGLE_SHEETS_ID) {
      console.error('❌ GOOGLE_SHEETS_ID가 .env에 없습니다.');
      process.exit(1);
    }

    const usedData = getUsedTopics();
    console.log(`📊 구글 시트에서 주제 로드 중...`);

    try {
      // 기존 전체 주제명 (완료 포함) — 중복 방지용
      const allNames = await fetchAllTopicNames(env.GOOGLE_SHEETS_ID);
      console.log(`✅ 기존 주제 ${allNames.length}개 확인`);

      // AI가 새 주제 3+3 생성 → 시트에 추가
      console.log(`🤖 AI 신규 주제 생성 중...`);
      const suggestions = await generateTopicSuggestions(allNames, env);
      const newRows = [
        ...suggestions.towel.map(t => ({ topic: t, category: '수건' })),
        ...suggestions.gift.map(t  => ({ topic: t, category: '답례품' })),
      ];
      await addTopicsToSheet(newRows, env.GOOGLE_SHEETS_ID);
      console.log(`✅ 새 주제 ${newRows.length}개 시트 추가 완료`);

      // 시트 재로드 (새 주제 포함)
      topics = await fetchTopicsFromSheets(env.GOOGLE_SHEETS_ID);
      console.log(`📋 사용 가능한 주제: ${topics.length}개`);
    } catch (e) {
      console.error('❌ 구글 시트 접근 실패:', e.message);
      process.exit(1);
    }

    pair = getNextTopicPair(topics, usedData);
    if (!pair.towel && !pair.gift) {
      console.log('✅ 모든 주제를 사용했습니다. used-topics.json을 삭제하면 처음부터 다시 시작합니다.');
      return;
    }

    if (pair.towel) console.log(`📌 수건 주제: ${pair.towel.topic}`);
    if (pair.gift)  console.log(`📌 답례품 주제: ${pair.gift.topic}`);
  }

  // 2. 원고 생성 (수건 + 답례품 병렬)
  console.log('\n✍️  원고 생성 중...');
  const [towelContent, giftContent] = await Promise.all([
    pair.towel ? generateContent(pair.towel.topic, pair.towel.category, env) : null,
    pair.gift  ? generateContent(pair.gift.topic,  pair.gift.category,  env) : null,
  ]);
  if (towelContent) console.log(`✅ 수건 구조: ${towelContent.structure}`);
  if (giftContent)  console.log(`✅ 답례품 구조: ${giftContent.structure}`);

  // 3. 이메일 발송
  if (isTest) {
    console.log('\n=== 테스트 모드 (이메일 미발송) ===');
    if (towelContent) console.log('[수건]\n', JSON.stringify(towelContent, null, 2));
    if (giftContent)  console.log('[답례품]\n', JSON.stringify(giftContent, null, 2));
    return;
  }

  console.log('\n📧 이메일 발송 중...');
  await sendEmail({ towel: towelContent, gift: giftContent }, pair, env);

  // 수동 오버라이드가 아닐 때만 사용 기록
  if (!override) {
    for (const topicObj of [pair.towel, pair.gift].filter(Boolean)) {
      markTopicUsedLocal(topicObj);
      console.log(`📝 로컬 기록 저장: ${topicObj.topic}`);
      const marked = await markTopicUsedInSheet(topicObj.topic, env.GOOGLE_SHEETS_ID);
      if (marked) console.log(`✅ 구글 시트 완료 표시: ${topicObj.topic}`);
    }
  }

  console.log('\n🎉 완료!');
}

main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});

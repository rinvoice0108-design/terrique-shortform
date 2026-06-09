import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadKnowledge(filename) {
  const p = join(ROOT, 'knowledge', filename);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

export async function generateContent(topic, category, env) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const brandInfo = loadKnowledge('brand.md');
  const structures = loadKnowledge('structures.md');
  const hooks = loadKnowledge('hooks.md');
  const visualHooks = loadKnowledge('visual-hooks.md');
  const shootingGuide = loadKnowledge('shooting-guide.md');

  const systemPrompt = `당신은 테리크(Terrique) 브랜드의 숏폼 콘텐츠 원고 전문가입니다.

## 브랜드 정보
${brandInfo}

## 영상 구조 템플릿 15종 (구조 선택용)
${structures}

## 훅 패턴 리스트 (인트로 레퍼런스 선택용)
${hooks}

## 시각 훅 패턴 리스트 (시각 훅 레퍼런스 선택용)
${visualHooks}

## 촬영 구도 가이드 (촬영 레퍼런스 선택용)
${shootingGuide}

## 원고 작성 규칙
1. 훅은 반드시 첫 3초 안에 스크롤을 멈출 수 있어야 합니다
2. 말투: 따뜻한 존댓말 (예: ~해요, ~거든요, ~세요)
3. AI스러운 문장 절대 금지 - 실제 사람이 말하는 것처럼
4. 구어체로 작성 (소리 내어 읽었을 때 자연스럽게)
5. CTA는 강매 느낌 없이 자연스럽게
6. 테리크 브랜드 감성: 따뜻하고 감성적이되 정보는 명확하게
7. 숏폼은 30초 분량 (70~90자 내외)

## 레퍼런스 작성 규칙 (중요)
- ref_intro: "훅 패턴 리스트"에서 이 주제에 맞는 패턴 2~3가지를 골라, 패턴명과 템플릿 형식을 명시한 뒤 이 주제에 맞게 적용한 예시 문장을 써주세요.
  예시 형식: "①[패턴명] 템플릿: '~' → 적용 예: '실제 예시 문장'"
- ref_body: 선택한 영상 구조의 단계별 흐름을 그대로 가져와서 이 주제에 맞게 각 단계를 어떻게 전개할지 구체적으로 써주세요.
  예시 형식: "①[단계명]: [이 주제에서 할 내용] → ②[다음 단계]: ..."
- ref_shooting: "촬영 구도 가이드"의 테리크 추천 구도 조합에서 이 콘텐츠 유형에 맞는 조합을 인용하고, 인트로/본문/CTA 각 장면의 구체적 구도와 연출을 써주세요.
- ref_visual: "시각 훅 패턴 리스트" 5가지 중 이 영상 첫 장면에 맞는 1~2가지를 골라, 패턴명과 이유, 테리크 영상에서의 구체적 적용 방법을 써주세요.

## 출력 형식
반드시 아래 JSON 형식으로만 출력하세요. JSON 외 다른 텍스트 없이:
{
  "structure": "선택한 영상 구조 이름",
  "structure_reason": "이 구조를 선택한 이유 한 줄",

  "script_intro": "인트로(훅) 대본 - 첫 3초, 스크롤 멈추게 하는 강렬한 한 문장",
  "script_body": "본문 대본 - 핵심 정보 또는 스토리 전개 (자연스러운 구어체)",
  "script_cta": "CTA 대본 - 강매 없이 자연스러운 마무리 한 문장",

  "ref_intro": "훅 패턴 리스트에서 고른 인트로 레퍼런스 2~3가지 (패턴명 + 템플릿 + 이 주제 적용 예시)",
  "ref_body": "선택 구조의 단계별 흐름을 이 주제에 맞게 전개한 본문 레퍼런스",
  "ref_shooting": "촬영 구도 가이드에서 고른 구도 조합 + 인트로/본문/CTA 장면별 구체적 연출",
  "ref_visual": "시각 훅 패턴 리스트에서 이 영상에 적합한 시각 훅 1~2가지 선택 (패턴명 + 왜 이 주제에 맞는지 + 테리크 영상에서 어떻게 적용할지 구체적으로)",

  "youtube_title": "유튜브 제목 (30자 내외, 클릭을 유도하는 제목)",
  "youtube_caption": "유튜브 캡션 (해시태그 5개 포함)",

  "instagram_caption": "인스타그램 캡션 (해시태그 10개 포함)",

  "tiktok_caption": "틱톡 캡션 (해시태그 5개 포함)",

  "shorts_title": "숏클립/쇼츠 제목 (20자 이내)",
  "shorts_content": "숏클립/쇼츠 내용 (100자 이내, 핵심만 임팩트 있게)"
}`;

  const userPrompt = `이번 주 숏폼 원고를 작성해주세요.

주제: ${topic}
카테고리: ${category}

카테고리가 "${category}"이므로 structures.md의 카테고리별 구조 추천을 참고해 가장 적합한 구조를 선택하세요.
테리크 브랜드의 "Colorful Classic" 감성이 자연스럽게 녹아들도록 작성해주세요.
script_intro + script_body + script_cta 를 합치면 30초 분량(70~90자)이 되도록 작성해주세요.`;

  const response = await client.messages.create({
    model: env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON 파싱 실패: ' + text.slice(0, 200));

  return JSON.parse(jsonMatch[0]);
}

export async function generateTopicSuggestions(existingTopicNames, env) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const existingList = existingTopicNames.length > 0
    ? existingTopicNames.join('\n')
    : '(없음)';

  const response = await client.messages.create({
    model: env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `테리크(Terrique) 브랜드 숏폼 콘텐츠 주제를 새로 추천해주세요.

브랜드 정보:
- 상품: 수건(40수 호텔수건, 스트라이프 수건) + 답례품(결혼/돌잔치/명절)
- 타겟: 30~40대 여성, 인테리어·공간 무드 중시, 스킨케어 관심
- 톤: 클래식하고 감성적, 따뜻한 정보 콘텐츠

아래는 이미 시트에 있는 주제들입니다 (중복 금지):
${existingList}

위 목록에 없는 완전히 새로운 주제 6개를 추천해주세요.
수건 3개: 수건 관리·세탁·인테리어·피부케어·생활꿀팁 관련
답례품 3개: 결혼/돌잔치/명절 답례품·선물 아이디어 관련

반드시 아래 JSON 형식으로만 응답하세요:
{
  "towel": ["주제1", "주제2", "주제3"],
  "gift": ["주제1", "주제2", "주제3"]
}`
    }]
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('주제 추천 JSON 파싱 실패: ' + text.slice(0, 200));

  const result = JSON.parse(jsonMatch[0]);
  return {
    towel: (result.towel || []).slice(0, 3),
    gift:  (result.gift  || []).slice(0, 3),
  };
}

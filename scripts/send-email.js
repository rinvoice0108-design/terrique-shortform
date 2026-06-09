import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';

function escape(str) {
  if (Array.isArray(str)) str = str.join('\n');
  return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function row(label, color, bg, value) {
  return `
    <div style="margin:10px 0;">
      <p style="margin:0 0 5px;font-size:12px;font-weight:bold;color:${color};">${label}</p>
      <div style="background:${bg};border-radius:6px;padding:14px 16px;font-size:14px;line-height:1.9;color:#333;white-space:pre-wrap;word-break:break-word;">${escape(value)}</div>
    </div>`;
}

function buildScriptBlock(content, topic, category) {
  const isTowel = category === '수건';
  const accentColor = isTowel ? '#4A90A4' : '#C9986A';
  const accentBg    = isTowel ? '#EBF4F7' : '#FBF3EA';
  const icon        = isTowel ? '🏨' : '🎁';

  return `
    <!-- ${category} 구분선 -->
    <div style="background:${accentColor};padding:14px 32px;">
      <p style="margin:0;font-size:13px;font-weight:bold;color:#FFF;letter-spacing:1px;">${icon} ${escape(category)} 원고</p>
    </div>

    <!-- 주제 + 구조 -->
    <div style="background:#FFFFFF;padding:20px 32px;border-bottom:1px solid #EEEEEE;">
      <span style="display:inline-block;background:${accentBg};color:${accentColor};font-size:12px;font-weight:bold;padding:4px 12px;border-radius:20px;margin-bottom:10px;">${escape(category)}</span>
      <h2 style="margin:0 0 8px;font-size:19px;color:#1A1A1A;">${escape(topic)}</h2>
      <p style="margin:0;font-size:13px;color:#666;">📐 구조: <strong>${escape(content.structure)}</strong> — ${escape(content.structure_reason)}</p>
    </div>

    <!-- 원고 -->
    <div style="background:#FFFFFF;padding:22px 32px;border-bottom:1px solid #EEEEEE;">
      <h3 style="margin:0 0 14px;font-size:14px;color:#1A1A1A;">원고</h3>
      ${row('인트로 (훅)', '#E67E22', '#FFF8F0', content.script_intro)}
      ${row('본문', '#2980B9', '#F0F6FF', content.script_body)}
      ${row('CTA', '#27AE60', '#F0FFF4', content.script_cta)}
      <div style="height:10px;"></div>
      ${row('인트로 레퍼런스', '#888', '#F4F4F4', content.ref_intro)}
      ${row('본문 레퍼런스', '#888', '#F4F4F4', content.ref_body)}
      ${row('촬영 레퍼런스', '#888', '#F4F4F4', content.ref_shooting)}
      ${row('시각 훅 레퍼런스', '#5B6B7C', '#EEF2F5', content.ref_visual)}
    </div>

    <!-- 캡션 -->
    <div style="background:#FFFFFF;padding:22px 32px;border-bottom:1px solid #EEEEEE;">
      <h3 style="margin:0 0 14px;font-size:14px;color:#1A1A1A;">캡션</h3>
      ${row('유튜브 제목', '#FF0000', '#FFF5F5', content.youtube_title)}
      ${row('유튜브 캡션', '#FF0000', '#FFF5F5', content.youtube_caption)}
      ${row('인스타그램', '#C13584', '#FDF5FF', content.instagram_caption)}
      ${row('틱톡', '#010101', '#F5F5F5', content.tiktok_caption)}
      ${row('숏클립·쇼츠 제목 (20자 이내)', '#6C3483', '#F9F0FF', content.shorts_title)}
      ${row('숏클립·쇼츠 내용 (100자 이내)', '#6C3483', '#F9F0FF', content.shorts_content)}
    </div>`;
}

const CHECKLIST_HTML = `
  <div style="background:#FFFFFF;padding:22px 32px;border-bottom:1px solid #EEEEEE;">
    <h3 style="margin:0 0 16px;font-size:15px;color:#1A1A1A;display:flex;align-items:center;gap:8px;">
      <span style="background:#1A1A1A;color:#FFF;font-size:11px;font-weight:bold;padding:3px 8px;border-radius:20px;">체크</span>
      업로드 전 체크리스트
    </h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="background:#F8F8F8;border-radius:8px;padding:14px 16px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#E67E22;">🎣 훅 점검 (첫 1~3초)</p>
        <p style="margin:0;font-size:12px;color:#555;line-height:1.8;">
          ☐ 첫 1초 안에 시선 잡는 요소 있는가<br>
          ☐ "~입니다" "안녕하세요"로 시작하지 않는가<br>
          ☐ 훅이 영상 핵심 내용과 연결되는가<br>
          ☐ 썸네일(커버)이 인트로와 동일한가
        </p>
      </div>
      <div style="background:#F8F8F8;border-radius:8px;padding:14px 16px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#2980B9;">⏱️ 시청 지속 점검</p>
        <p style="margin:0;font-size:12px;color:#555;line-height:1.8;">
          ☐ 불필요한 인트로/자기소개 없는가<br>
          ☐ 5초 이상 변화 없는 구간 없는가<br>
          ☐ 자막/효과음/BGM이 몰입을 돕는가<br>
          ☐ 1영상 1메시지로 집중되는가
        </p>
      </div>
      <div style="background:#F8F8F8;border-radius:8px;padding:14px 16px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#27AE60;">🎯 CTA 점검</p>
        <p style="margin:0;font-size:12px;color:#555;line-height:1.8;">
          ☐ 영상 끝에 명확한 CTA 있는가<br>
          ☐ CTA가 1개로 집중되는가<br>
          ☐ 댓글 유도 질문이나 장치 있는가
        </p>
      </div>
      <div style="background:#F8F8F8;border-radius:8px;padding:14px 16px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#8E44AD;">📝 캡션·기술 점검</p>
        <p style="margin:0;font-size:12px;color:#555;line-height:1.8;">
          ☐ 캡션 첫 줄이 호기심을 자극하는가<br>
          ☐ 해시태그 3~5개 적정 수준인가<br>
          ☐ 음성 깨끗하고 자막 오탈자 없는가<br>
          ☐ 세로 비율(9:16) 맞는가
        </p>
      </div>
    </div>
    <div style="margin-top:12px;background:#F8F8F8;border-radius:8px;padding:14px 16px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#555;">📊 업로드 세팅</p>
      <p style="margin:0;font-size:12px;color:#555;line-height:1.8;">
        ☐ 업로드 시간이 타겟 활동 시간대인가 &nbsp;&nbsp; ☐ 커버 이미지(썸네일) 직접 설정했는가 &nbsp;&nbsp; ☐ 릴스 게시 시 피드에도 공유 설정했는가
      </p>
    </div>
  </div>`;

function buildHtml(contents, pair, date) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F5F5F0;font-family:-apple-system,BlinkMacSystemFont,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;">
<div style="max-width:660px;margin:0 auto;padding:32px 16px;">

  <!-- 헤더 -->
  <div style="background:#1A1A1A;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
    <p style="margin:0 0 4px;font-size:11px;color:#C9986A;letter-spacing:3px;">COLORFUL CLASSIC</p>
    <h1 style="margin:0 0 6px;font-size:22px;color:#FFFFFF;font-weight:600;">이번 주 숏폼 원고</h1>
    <p style="margin:0;font-size:13px;color:#888;">${escape(date)}</p>
  </div>

  ${contents.towel ? buildScriptBlock(contents.towel, pair.towel.topic, '수건') : ''}
  ${contents.gift  ? buildScriptBlock(contents.gift,  pair.gift.topic,  '답례품') : ''}

  ${CHECKLIST_HTML}

  <!-- 푸터 -->
  <div style="text-align:center;padding:20px 0;">
    <p style="margin:0;font-size:12px;color:#BBB;">Colorful Classic, Terrique · 자동 생성 시스템</p>
  </div>

</div>
</body>
</html>`;
}

// contents = { towel: contentObj|null, gift: contentObj|null }
// pair     = { towel: topicObj|null,   gift: topicObj|null }
export async function sendEmail(contents, pair, env) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS }
  });

  const now = new Date();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const subjectDate = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${weekdays[now.getDay()]}`;
  const date = now.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });

  await transporter.sendMail({
    from: `"테리크 콘텐츠 봇" <${env.EMAIL_USER}>`,
    to: env.EMAIL_TO,
    subject: `[테리크 숏폼] ${subjectDate} 원고 도착`,
    html: buildHtml(contents, pair, date)
  });

  console.log(`✅ 이메일 발송 완료 → ${env.EMAIL_TO}`);
}

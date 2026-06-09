import Holidays from 'date-holidays';

const hd = new Holidays('KR');

// 월요일이면 그대로 발송, 월요일이 공휴일이면 화요일에 발송
export function isSendDay(date = new Date()) {
  const day = date.getDay(); // 0=일, 1=월, 2=화

  if (day === 1) {
    return !hd.isHoliday(date);
  }

  if (day === 2) {
    const monday = new Date(date);
    monday.setDate(date.getDate() - 1);
    return !!hd.isHoliday(monday);
  }

  return false;
}

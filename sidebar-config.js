// 사이트 전체에 적용할 기본 문구. 브라우저의 편집 내용은 이 기본값보다 우선합니다.
export const sidebarFields = [
  { key: 'brand', label: '사이트 이름', value: '사이언', max: 20 },
  { key: 'tagline', label: '사이트 한 줄 소개', value: '생각과 발견 사이', max: 45 },
  { key: 'spaceLabel', label: '탐구 공간 제목', value: '나의 탐구 공간', max: 30 },
  { key: 'lesson', label: '실험실 메뉴 이름', value: '탐구 실험실', max: 24 },
  { key: 'notebook', label: '노트 메뉴 이름', value: '나의 탐구 노트', max: 24 },
  { key: 'guide', label: '안내 메뉴 이름', value: '수업 안내와 자료', max: 24 },
  { key: 'topicLabel', label: '주제 영역 제목', value: '지금 탐구하는 주제', max: 30 },
  { key: 'subject', label: '교과 이름', value: '전자기학', max: 30 },
  { key: 'chapter', label: '현재 단원', value: '01. 키르히호프의 법칙', max: 60 },
  { key: 'messageTitle', label: '안내 메시지 제목', value: '공식 너머의 발견', max: 40 },
  { key: 'message', label: '안내 메시지', value: '정답을 찾기 전에,\n나만의 질문을 만들어 보세요.', max: 180, multiline: true },
  { key: 'avatar', label: '프로필 이니셜', value: 'S', max: 2 },
  { key: 'profile', label: '프로필 이름', value: '오늘도, 탐구하는 나', max: 40 },
  { key: 'profileNote', label: '프로필 안내', value: '학생 탐구 공간 · 기기에 저장', max: 60 }
];
export function normalizeSidebar(values = {}) {
  return Object.fromEntries(sidebarFields.map(f => [f.key,
    typeof values?.[f.key] === 'string' && values[f.key].trim()
      ? values[f.key].trim().slice(0, f.max) : f.value]));
}

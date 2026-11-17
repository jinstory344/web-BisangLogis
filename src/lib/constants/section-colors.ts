/**
 * 메뉴별 색 (메모의 배차=파랑·업무=초록과 맞춤, 어두운 화면에서 눈이 편한 낮은 채도).
 * 배차 = 노랑(호박색), 차량 = 파랑, 거래처 = 초록. HOME·메뉴는 앱 대표색(빨강) 그대로.
 * Tailwind가 글자 그대로 찾아 만들 수 있게 클래스 이름을 문자열 통째로 둔다.
 */
export const SECTION_COLORS = {
  dispatch: {
    /** 아래 탭에서 고른 메뉴 아이콘·글씨 */
    tab: "data-[active=true]:text-[#d6a84a]",
    /** 페이지 제목 밑 짧은 색 줄 */
    titleBar: "bg-[#d6a84a]",
    /** 위에 고정되는 부분 맨 아래 얇은 선 */
    line: "border-b border-[#d6a84a]/70",
    /** 고른 칩 */
    chip: "bg-[#5e4a22] font-semibold text-[#f2dfaa]",
    /** ＋·★ 같은 포인트 */
    accent: "text-[#d6a84a]",
    star: "fill-[#d6a84a] text-[#d6a84a]",
    /** 고정 줄 바탕 — 메뉴 색 대신 살짝 어두운 회색(★만 메뉴 색) */
    pinnedRow: "bg-black/20",
  },
  vehicle: {
    tab: "data-[active=true]:text-[#6f93cf]",
    /** 페이지 제목 밑 짧은 색 줄 */
    titleBar: "bg-[#6f93cf]",
    /** 위에 고정되는 부분 맨 아래 얇은 선 */
    line: "border-b border-[#6f93cf]/70",
    chip: "bg-[#34507d] font-semibold text-[#d3e1f7]",
    accent: "text-[#6f93cf]",
    star: "fill-[#6f93cf] text-[#6f93cf]",
    pinnedRow: "bg-black/20",
  },
  client: {
    tab: "data-[active=true]:text-[#6aad83]",
    /** 페이지 제목 밑 짧은 색 줄 */
    titleBar: "bg-[#6aad83]",
    /** 위에 고정되는 부분 맨 아래 얇은 선 */
    line: "border-b border-[#6aad83]/70",
    chip: "bg-[#355a43] font-semibold text-[#d0eedb]",
    accent: "text-[#6aad83]",
    star: "fill-[#6aad83] text-[#6aad83]",
    pinnedRow: "bg-black/20",
  },
} as const

/** 아래 탭: 메뉴 주소 → 고른 탭 색 */
export const TAB_ACTIVE_COLOR: Record<string, string> = {
  "/dispatches": SECTION_COLORS.dispatch.tab,
  "/vehicles": SECTION_COLORS.vehicle.tab,
  "/clients": SECTION_COLORS.client.tab,
}

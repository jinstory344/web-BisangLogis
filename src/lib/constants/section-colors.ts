/**
 * 메뉴별 색 (메모의 배차=파랑·업무=초록과 맞춤, 어두운 화면에서 눈이 편한 낮은 채도).
 * 배차 = 노랑(호박색), 차량 = 파랑, 거래처 = 초록. HOME·메뉴는 앱 대표색(빨강) 그대로.
 * Tailwind가 글자 그대로 찾아 만들 수 있게 클래스 이름을 문자열 통째로 둔다.
 */
export const SECTION_COLORS = {
  dispatch: {
    /** 아래 탭에서 고른 메뉴 아이콘·글씨 */
    tab: "data-[active=true]:text-[#d6a84a]",
    /** 페이지 위쪽에 은은하게 퍼지는 빛 — 제목을 가운데로 둥글게, 여러 단계로 천천히 옅어져 경계선이 안 보이게 */
    headTint: "bg-[radial-gradient(ellipse_85%_60%_at_50%_42%,rgba(214,168,74,0.17)_0%,rgba(214,168,74,0.094)_35%,rgba(214,168,74,0.034)_65%,rgba(214,168,74,0)_100%)]",
    pageTint: "bg-[radial-gradient(ellipse_90%_4.5rem_at_50%_2.75rem,rgba(214,168,74,0.17)_0%,rgba(214,168,74,0.094)_35%,rgba(214,168,74,0.034)_65%,rgba(214,168,74,0)_100%)]",
    /** 고른 칩 */
    chip: "bg-[#5e4a22] font-semibold text-[#f2dfaa]",
    /** ＋·★ 같은 포인트 */
    accent: "text-[#d6a84a]",
    star: "fill-[#d6a84a] text-[#d6a84a]",
    /** 고정 줄 바탕 */
    pinnedRow: "bg-[#d6a84a]/[0.07]",
  },
  vehicle: {
    tab: "data-[active=true]:text-[#6f93cf]",
    headTint: "bg-[radial-gradient(ellipse_85%_60%_at_50%_42%,rgba(111,147,207,0.17)_0%,rgba(111,147,207,0.094)_35%,rgba(111,147,207,0.034)_65%,rgba(111,147,207,0)_100%)]",
    pageTint: "bg-[radial-gradient(ellipse_90%_4.5rem_at_50%_2.75rem,rgba(111,147,207,0.17)_0%,rgba(111,147,207,0.094)_35%,rgba(111,147,207,0.034)_65%,rgba(111,147,207,0)_100%)]",
    chip: "bg-[#34507d] font-semibold text-[#d3e1f7]",
    accent: "text-[#6f93cf]",
    star: "fill-[#6f93cf] text-[#6f93cf]",
    pinnedRow: "bg-[#5b7fb8]/[0.09]",
  },
  client: {
    tab: "data-[active=true]:text-[#6aad83]",
    headTint: "bg-[radial-gradient(ellipse_85%_60%_at_50%_42%,rgba(106,173,131,0.15)_0%,rgba(106,173,131,0.083)_35%,rgba(106,173,131,0.03)_65%,rgba(106,173,131,0)_100%)]",
    pageTint: "bg-[radial-gradient(ellipse_90%_4.5rem_at_50%_2.75rem,rgba(106,173,131,0.15)_0%,rgba(106,173,131,0.083)_35%,rgba(106,173,131,0.03)_65%,rgba(106,173,131,0)_100%)]",
    chip: "bg-[#355a43] font-semibold text-[#d0eedb]",
    accent: "text-[#6aad83]",
    star: "fill-[#6aad83] text-[#6aad83]",
    pinnedRow: "bg-[#5a9a72]/[0.09]",
  },
} as const

/** 아래 탭: 메뉴 주소 → 고른 탭 색 */
export const TAB_ACTIVE_COLOR: Record<string, string> = {
  "/dispatches": SECTION_COLORS.dispatch.tab,
  "/vehicles": SECTION_COLORS.vehicle.tab,
  "/clients": SECTION_COLORS.client.tab,
}

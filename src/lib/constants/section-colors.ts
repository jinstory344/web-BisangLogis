/**
 * 메뉴별 색 (메모의 배차=파랑·업무=초록과 맞춤, 어두운 화면에서 눈이 편한 낮은 채도).
 * 배차 = 노랑(호박색), 차량 = 파랑, 거래처 = 초록. HOME·메뉴는 앱 대표색(빨강) 그대로.
 * Tailwind가 글자 그대로 찾아 만들 수 있게 클래스 이름을 문자열 통째로 둔다.
 */
export const SECTION_COLORS = {
  dispatch: {
    /** 아래 탭에서 고른 메뉴 아이콘·글씨 */
    tab: "data-[active=true]:text-[#d6a84a]",
    /** 페이지 위쪽에 은은하게 깔리는 색 — 가장 짙은 곳이 제목 높이, 위·아래 모두 바탕색으로 서서히 이어져 경계선이 안 보이게 */
    headTint: "bg-[linear-gradient(to_bottom,var(--background),#3a3222_42%,var(--background))]",
    pageTint: "bg-[linear-gradient(to_bottom,transparent,#3a3222_2.75rem,transparent_6.5rem)]",
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
    headTint: "bg-[linear-gradient(to_bottom,var(--background),#252f40_42%,var(--background))]",
    pageTint: "bg-[linear-gradient(to_bottom,transparent,#252f40_2.75rem,transparent_6.5rem)]",
    chip: "bg-[#34507d] font-semibold text-[#d3e1f7]",
    accent: "text-[#6f93cf]",
    star: "fill-[#6f93cf] text-[#6f93cf]",
    pinnedRow: "bg-[#5b7fb8]/[0.09]",
  },
  client: {
    tab: "data-[active=true]:text-[#6aad83]",
    headTint: "bg-[linear-gradient(to_bottom,var(--background),#25352c_42%,var(--background))]",
    pageTint: "bg-[linear-gradient(to_bottom,transparent,#25352c_2.75rem,transparent_6.5rem)]",
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

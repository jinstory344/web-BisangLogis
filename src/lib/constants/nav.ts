import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Building2,
  Receipt,
  Route,
  Send,
  Settings,
  StickyNote,
  Trash2,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** 아직 화면이 없음 — 메뉴에 "준비 중"으로 보이고 누를 수 없다 */
  soon?: boolean
}

/**
 * 모바일 하단 탭: [오늘 날짜(비상)] [배차] [차량] [거래처] [메모] [☰ 메뉴] (가계부 앱 방식).
 * 등록은 하단 탭 대신 화면 오른쪽 아래 떠 있는 ＋ 버튼(FloatingActions)으로 한다.
 * (데스크톱 사이드바는 아래 sidebarNavGroups를 따로 쓴다.)
 */
export const primaryNavItems: NavItem[] = [
  { label: "HOME", href: "/", icon: Send },
  { label: "배차", href: "/dispatches", icon: Route },
  { label: "차량", href: "/vehicles", icon: Truck },
  { label: "거래처", href: "/clients", icon: Building2 },
  { label: "메모", href: "/memos", icon: StickyNote },
]

/** 모바일 하단 "메뉴"(☰)를 누르면 위로 펼쳐지는 목록. 휴지통·엑셀 가져오기·로그아웃은 설정 화면 안에 있다. */
export const secondaryNavItems: NavItem[] = [
  { label: "매출 목록", href: "/sales", icon: TrendingUp },
  { label: "지출 목록", href: "/expenses", icon: Wallet },
  { label: "통계", href: "/stats", icon: BarChart3 },
  { label: "계산서", href: "/tax-invoices", icon: Receipt, soon: true },
  { label: "휴지통", href: "/trash", icon: Trash2 },
  { label: "설정", href: "/settings", icon: Settings },
]

/** 빠른 등록 시트의 큰 버튼 */
export const quickCreateNavItems: NavItem[] = [
  { label: "매출 등록", href: "/new?type=sale", icon: TrendingUp },
  { label: "지출 등록", href: "/new?type=expense", icon: Wallet },
  { label: "배차 등록", href: "/new?type=dispatch", icon: Route },
]

/** 데스크톱 사이드바 전용 — 구분선으로 나뉘는 메뉴 그룹 */
export const sidebarNavGroups: NavItem[][] = [
  [
    { label: "HOME", href: "/", icon: Send },
    { label: "통계", href: "/stats", icon: BarChart3 },
  ],
  [
    { label: "매출", href: "/sales", icon: TrendingUp },
    { label: "지출", href: "/expenses", icon: Wallet },
  ],
  [
    { label: "배차", href: "/dispatches", icon: Route },
    { label: "거래처", href: "/clients", icon: Building2 },
    { label: "차량 정보", href: "/vehicles", icon: Truck },
    { label: "메모", href: "/memos", icon: StickyNote },
  ],
  [
    { label: "계산서", href: "/tax-invoices", icon: Receipt, soon: true },
    { label: "휴지통", href: "/trash", icon: Trash2 },
    { label: "설정", href: "/settings", icon: Settings },
  ],
]

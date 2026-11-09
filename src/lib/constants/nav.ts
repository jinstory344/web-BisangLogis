import type { LucideIcon } from "lucide-react"
import {
  Car,
  FileSpreadsheet,
  LayoutDashboard,
  Receipt,
  Settings,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

/**
 * 모바일 하단 탭에 노출되는 핵심 메뉴: [매출] [지출] [＋ 빠른 등록] [배차] [더보기].
 * 가운데 ＋ 버튼은 MobileTabBar가 MOBILE_TAB_SPLIT_INDEX 위치에 끼워 넣는다.
 * (데스크톱 사이드바는 아래 sidebarNavGroups를 따로 쓰므로 여기 변경의 영향을 받지 않는다.)
 */
export const primaryNavItems: NavItem[] = [
  { label: "매출", href: "/sales", icon: TrendingUp },
  { label: "지출", href: "/expenses", icon: Wallet },
  { label: "배차", href: "/dispatches", icon: Truck },
]

/** 하단 탭에서 ＋ 버튼이 들어갈 위치 (primaryNavItems의 앞 2개 뒤) */
export const MOBILE_TAB_SPLIT_INDEX = 2

/** 모바일 "더보기" 시트 메뉴 (대시보드는 하단 탭 대신 여기로) */
export const secondaryNavItems: NavItem[] = [
  { label: "대시보드", href: "/", icon: LayoutDashboard },
  { label: "거래처", href: "/clients", icon: Users },
  { label: "차량·기사", href: "/vehicles", icon: Car },
  { label: "계산서", href: "/tax-invoices", icon: Receipt },
  { label: "엑셀 가져오기", href: "/import", icon: FileSpreadsheet },
  { label: "휴지통", href: "/trash", icon: Trash2 },
  { label: "설정", href: "/settings", icon: Settings },
]

/** 모바일 빠른 등록 시트의 큰 버튼 */
export const quickCreateNavItems: NavItem[] = [
  { label: "매출 등록", href: "/sales/new", icon: TrendingUp },
  { label: "지출 등록", href: "/expenses/new", icon: Wallet },
  { label: "배차 등록", href: "/dispatches/new", icon: Truck },
]

/** 데스크톱 사이드바 전용 — 구분선으로 나뉘는 메뉴 그룹 */
export const sidebarNavGroups: NavItem[][] = [
  [{ label: "대시보드", href: "/", icon: LayoutDashboard }],
  [
    { label: "매출", href: "/sales", icon: TrendingUp },
    { label: "지출", href: "/expenses", icon: Wallet },
  ],
  [
    { label: "배차", href: "/dispatches", icon: Truck },
    { label: "거래처", href: "/clients", icon: Users },
    { label: "차량 정보", href: "/vehicles", icon: Car },
  ],
  [
    { label: "계산서", href: "/tax-invoices", icon: Receipt },
    { label: "엑셀 가져오기", href: "/import", icon: FileSpreadsheet },
    { label: "휴지통", href: "/trash", icon: Trash2 },
    { label: "설정", href: "/settings", icon: Settings },
  ],
]

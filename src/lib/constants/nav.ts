import type { LucideIcon } from "lucide-react"
import {
  Car,
  FileSpreadsheet,
  LayoutDashboard,
  Receipt,
  Settings,
  Trash2,
  Truck,
  Users,
  Wallet,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

/** 모바일 하단 탭에 노출되는 핵심 메뉴 */
export const primaryNavItems: NavItem[] = [
  { label: "대시보드", href: "/", icon: LayoutDashboard },
  { label: "배차", href: "/dispatches", icon: Truck },
  { label: "지출", href: "/expenses", icon: Wallet },
  { label: "계산서", href: "/tax-invoices", icon: Receipt },
]

/** 모바일 "더보기" 시트 및 데스크톱 사이드바 하단에 노출되는 메뉴 */
export const secondaryNavItems: NavItem[] = [
  { label: "거래처", href: "/clients", icon: Users },
  { label: "차량·기사", href: "/vehicles", icon: Car },
  { label: "엑셀 가져오기", href: "/import", icon: FileSpreadsheet },
  { label: "휴지통", href: "/trash", icon: Trash2 },
  { label: "설정", href: "/settings", icon: Settings },
]

export const allNavItems: NavItem[] = [...primaryNavItems, ...secondaryNavItems]

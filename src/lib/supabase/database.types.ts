/**
 * 비상로지스 데이터 모델 타입 (PRD 5장 기준 수기 작성).
 * 실제 Supabase 프로젝트 연결 후 `supabase gen types typescript`로 재생성해도
 * 이 파일과 필드명·타입이 일치해야 한다 (PRD 지시문 #3).
 *
 * 주의: Row 타입은 반드시 `type` 별칭(객체 리터럴)으로 선언한다.
 * `interface`로 선언하면 Record<string, unknown>에 구조적으로 대입되지 않아
 * SupabaseClient의 제네릭 추론(Schema, rpc Args 등)이 깨진다.
 */

export type PaymentMethod = "TAX_INVOICE" | "TRANSFER" | "CASH"
export type ExpensePaymentMethod = "CARD" | "TRANSFER" | "CASH"
export type PaymentStatus = "UNPAID" | "PAID"
export type TaxInvoiceMode = "MANUAL" | "POPBILL"
export type TaxInvoiceStatus =
  | "RECORDED"
  | "ISSUED"
  | "SENT"
  | "FAILED"
  | "CANCELLED"
export type PurchaseInvoiceSource = "POPBILL" | "MANUAL"
export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "RESTORE"

type BaseColumns = {
  id: string
  created_at: string
  updated_at: string | null
  deleted_at: string | null
}

export type ClientRow = BaseColumns & {
  name: string
  biz_no: string | null
  ceo_name: string | null
  address: string | null
  biz_type: string | null
  biz_item: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  memo: string | null
}

export type VehicleRow = BaseColumns & {
  plate_no: string
  driver_name: string
  driver_phone: string | null
  carrier_name: string | null
  vehicle_type: string | null
  memo: string | null
}

export type DispatchRow = BaseColumns & {
  dispatch_date: string
  client_id: string | null
  origin: string
  destination: string
  pallet_count: number | null
  vehicle_id: string | null
  plate_no_snapshot: string | null
  driver_name_snapshot: string | null
  driver_phone_snapshot: string | null
  carrier_name: string | null
  dispatcher_name: string | null
  total_amount: number
  supply_amount: number
  vat_amount: number
  is_vat_exempt: boolean
  fee_amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  paid_at: string | null
  memo: string | null
}

export type ExpenseRow = BaseColumns & {
  expense_date: string
  category_major: string
  category_minor: string
  amount: number
  payment_method: ExpensePaymentMethod | null
  vendor: string | null
  has_tax_invoice: boolean
  memo: string | null
}

export type TaxInvoiceRow = BaseColumns & {
  issue_date: string
  client_id: string | null
  mode: TaxInvoiceMode
  status: TaxInvoiceStatus
  supply_amount: number
  vat_amount: number
  total_amount: number
  item_name: string | null
  popbill_mgt_key: string | null
  popbill_nts_confirm_num: string | null
  popbill_error_message: string | null
  memo: string | null
}

export type TaxInvoiceDispatchRow = BaseColumns & {
  tax_invoice_id: string
  dispatch_id: string
}

export type PurchaseInvoiceRow = BaseColumns & {
  issue_date: string | null
  supplier_name: string | null
  supplier_biz_no: string | null
  supply_amount: number | null
  vat_amount: number | null
  total_amount: number | null
  nts_confirm_num: string | null
  source: PurchaseInvoiceSource | null
}

export type AuditLogRow = {
  id: string
  table_name: string
  record_id: string
  action: AuditAction
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  actor_id: string | null
  created_at: string
}

export type SettingsRow = BaseColumns & {
  my_biz_name: string | null
  my_biz_no: string | null
  my_ceo_name: string | null
  my_address: string | null
  my_biz_type: string | null
  my_biz_item: string | null
  popbill_enabled: boolean
  popbill_corp_num: string | null
  popbill_user_id: string | null
  popbill_is_test: boolean
}

type TableDef<Row> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      clients: TableDef<ClientRow>
      vehicles: TableDef<VehicleRow>
      dispatches: TableDef<DispatchRow>
      expenses: TableDef<ExpenseRow>
      tax_invoices: TableDef<TaxInvoiceRow>
      tax_invoice_dispatches: TableDef<TaxInvoiceDispatchRow>
      purchase_invoices: TableDef<PurchaseInvoiceRow>
      audit_logs: TableDef<AuditLogRow>
      settings: TableDef<SettingsRow>
    }
    Views: Record<string, never>
    Functions: {
      write_audit_log: {
        Args: {
          p_table_name: string
          p_record_id: string
          p_action: AuditAction
          p_before_data?: Record<string, unknown> | null
          p_after_data?: Record<string, unknown> | null
        }
        Returns: undefined
      }
      soft_delete: {
        Args: {
          p_table_name: string
          p_record_id: string
        }
        Returns: undefined
      }
      restore_deleted: {
        Args: {
          p_table_name: string
          p_record_id: string
        }
        Returns: undefined
      }
    }
  }
}

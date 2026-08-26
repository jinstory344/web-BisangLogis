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
export type DropoffType = "SAME_DAY" | "NEXT_DAY"
export type CargoBoxType =
  | "CARGO"
  | "BOX"
  | "WING"
  | "REFRIGERATED"
  | "OTHER"

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

/**
 * 배차 = 차량 섭외/중개(물류 운영 정보) 전용. 금액은 다루지 않는다.
 * 실제 수익은 별도 테이블인 sales가 담당한다 (배차 1건 = 매출 1건이 아님).
 */
export type DispatchRow = BaseColumns & {
  dispatch_date: string
  client_id: string | null
  contact_name: string | null
  origin: string
  destination: string
  dropoff_type: DropoffType
  pallet_count: number | null
  weight_ton: number | null
  cargo_box_type: CargoBoxType | null
  vehicle_id: string | null
  plate_no_snapshot: string | null
  driver_name_snapshot: string | null
  driver_phone_snapshot: string | null
  dispatcher_name: string | null
  /** 운임 — 배차 완료 후 기사/차량에게 지급할 금액. 부가세 분리 계산 대상이 아니다. */
  freight_amount: number | null
  /** 수수료 — 일부 거래처에 한해 발생. 단순 기록용이며 매출과 자동 연결되지 않는다. */
  fee_amount: number
  memo: string | null
}

/**
 * 매출 = 실제 수익(직접 운행 또는 일부 업체 수수료) 전용.
 * dispatches와 완전히 독립된 테이블이며 거래처/차량/기사 정보를 갖지 않는다.
 */
export type SaleRow = BaseColumns & {
  sale_date: string
  origin: string
  destination: string
  supply_amount: number
  vat_amount: number
  total_amount: number
  is_vat_exempt: boolean
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  paid_at: string | null
  source_major: string | null
  source_minor: string | null
  source_note: string | null
  /** 계산서정보 — 직접 운송 건에서 운임을 지급하고 계산서를 받을 상대 상호명(FK 아님). */
  billing_entity_name: string | null
  /** 오더자 전화번호 — source_minor(오더자)와 짝을 이루는 연락처. */
  order_contact_phone: string | null
  memo: string | null
}

export type ExpenseRow = BaseColumns & {
  expense_date: string
  category_major: string
  category_minor: string
  amount: number
  payment_method: ExpensePaymentMethod | null
  installment_months: number | null
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
      sales: TableDef<SaleRow>
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
      create_dispatch: {
        Args: {
          p_dispatch_date: string
          p_client_id: string | null
          p_origin: string
          p_destination: string
          p_dropoff_type: DropoffType
          p_pallet_count: number | null
          p_weight_ton: number | null
          p_vehicle_id: string | null
          p_plate_no_snapshot: string | null
          p_driver_name_snapshot: string | null
          p_driver_phone_snapshot: string | null
          p_contact_name: string | null
          p_memo?: string | null
          p_cargo_box_type?: CargoBoxType | null
          p_freight_amount?: number | null
          /** null을 넘겨도 RPC 내부에서 coalesce(...,0) 처리된다. */
          p_fee_amount?: number | null
        }
        Returns: string
      }
      update_dispatch: {
        Args: {
          p_id: string
          p_dispatch_date: string
          p_client_id: string | null
          p_origin: string
          p_destination: string
          p_dropoff_type: DropoffType
          p_pallet_count: number | null
          p_weight_ton: number | null
          p_vehicle_id: string | null
          p_plate_no_snapshot: string | null
          p_driver_name_snapshot: string | null
          p_driver_phone_snapshot: string | null
          p_contact_name: string | null
          p_memo?: string | null
          p_cargo_box_type?: CargoBoxType | null
          p_freight_amount?: number | null
          /** null을 넘겨도 RPC 내부에서 coalesce(...,0) 처리된다. */
          p_fee_amount?: number | null
        }
        Returns: undefined
      }
      /** vat_amount/total_amount는 RPC 내부에서 supply_amount로부터 계산한다 (4.3). */
      create_sale: {
        Args: {
          p_sale_date: string
          p_origin: string
          p_destination: string
          p_supply_amount: number
          p_is_vat_exempt: boolean
          p_payment_method: PaymentMethod
          p_source_major: string | null
          p_source_minor: string | null
          p_source_note: string | null
          p_memo?: string | null
          p_billing_entity_name?: string | null
          p_order_contact_phone?: string | null
        }
        Returns: string
      }
      update_sale: {
        Args: {
          p_id: string
          p_sale_date: string
          p_origin: string
          p_destination: string
          p_supply_amount: number
          p_is_vat_exempt: boolean
          p_payment_method: PaymentMethod
          p_source_major: string | null
          p_source_minor: string | null
          p_source_note: string | null
          p_memo?: string | null
          p_billing_entity_name?: string | null
          p_order_contact_phone?: string | null
        }
        Returns: undefined
      }
    }
  }
}

import type { CargoBoxType, DropoffType } from "@/lib/supabase/database.types"
import {
  findByPrefix,
  MAX_AMOUNT,
  parseAmountToken,
  parseDateLine,
  squash,
  type ClientOption,
  type ParseResult,
} from "@/lib/telegram/parse-sale"

/**
 * 텔레그램 배차 메시지. 줄 모양으로 알아보는 것(아무 줄에나):
 * 날짜 · 당착/익착(기본 당착) · 운임(33만) · 수수료(수2만) · 거래처+담당자(아토무역 이재근)
 * · 차량번호+차주(서울86바7754 김진승) · 차종+파레트(냉동3) · 무게(1.6, 1.6톤).
 * 나머지 줄은 위에서부터 상차지 → 하차지 (그 뒤 줄은 비고).
 */

export type VehicleOption = {
  id: string
  plate_no: string
  driver_name: string
  driver_phone: string | null
}

export type ParsedDispatch = {
  dispatch_date: string
  client_id: string
  client_name: string
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
  freight_amount: number | null
  fee_amount: number
  memo: string | null
}

const DROPOFF_WORDS: Record<string, DropoffType> = { 당착: "SAME_DAY", 익착: "NEXT_DAY" }

const CARGO_WORDS: Record<string, CargoBoxType> = {
  냉동: "REFRIGERATED",
  냉동탑: "REFRIGERATED",
  냉장: "WING",
  냉장윙: "WING",
  윙: "WING",
  탑: "BOX",
  카고: "CARGO",
}

/** "냉동3", "냉동탑 3", "윙" → 차종(+파레트 수) */
export function parseCargoLine(line: string): { type: CargoBoxType; pallets: number | null } | null {
  const m = line.replace(/\s/g, "").match(/^([가-힣]+?)(\d+)?(?:파레트|plt|p)?$/i)
  if (!m) return null
  const type = CARGO_WORDS[m[1]]
  if (!type) return null
  return { type, pallets: m[2] ? Number(m[2]) : null }
}

/** "1.6", "1.6톤", "5톤" → 무게(톤). 단위 없는 정수는 100 미만일 때만(금액과 헷갈리지 않게). */
export function parseWeightLine(line: string): number | null {
  const m = line.replace(/\s/g, "").match(/^(\d+(?:\.\d+)?)(톤|t)?$/i)
  if (!m) return null
  const value = Number(m[1])
  if (!m[2] && Number.isInteger(value) && value >= 100) return null
  return value > 0 && value < 100 ? value : null
}

/** "수2만", "수수료 2만" → 수수료 금액 */
function parseFeeLine(line: string): number | null {
  const m = line.replace(/\s/g, "").match(/^수(?:수료)?(.+)$/)
  return m ? parseAmountToken(m[1]) : null
}

const PLATE = /^((?:[가-힣]{2})?\d{2,3}[가-힣]\d{4})\s*(.*)$/
const PHONE = /(01\d[-\s]?\d{3,4}[-\s]?\d{4})/

export function parseDispatchLines(
  lines: string[],
  ctx: { today: string; clients: ClientOption[]; vehicles: VehicleOption[] }
): ParseResult<ParsedDispatch> {
  let date: string | null = null
  let dropoff: DropoffType | null = null
  let freight: number | null = null
  let fee: number | null = null
  let client: { id: string; name: string; contact: string | null } | null = null
  let vehicle: Pick<
    ParsedDispatch,
    "vehicle_id" | "plate_no_snapshot" | "driver_name_snapshot" | "driver_phone_snapshot"
  > | null = null
  let cargo: { type: CargoBoxType; pallets: number | null } | null = null
  let weight: number | null = null
  const places: string[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const parsedDate: string | null = date === null ? parseDateLine(line, ctx.today) : null
    if (parsedDate) {
      date = parsedDate
      continue
    }

    const dropoffWord = DROPOFF_WORDS[line.replace(/\s/g, "")]
    if (dropoffWord) {
      dropoff = dropoffWord
      continue
    }

    const feeValue = parseFeeLine(line)
    if (feeValue !== null) {
      fee = feeValue
      continue
    }

    if (weight === null) {
      const w = parseWeightLine(line)
      if (w !== null) {
        weight = w
        continue
      }
    }

    const amount = parseAmountToken(line.replace(/\s/g, ""))
    if (amount !== null) {
      if (freight !== null) return { ok: false, error: "운임이 두 줄에 있어요. 수수료면 앞에 '수'를 붙여 주세요. 예: 수2만" }
      freight = amount
      continue
    }

    if (cargo === null) {
      const c = parseCargoLine(line)
      if (c) {
        cargo = c
        continue
      }
    }

    const plate: RegExpMatchArray | null = vehicle === null ? line.match(PLATE) : null
    if (plate) {
      const plateNo: string = plate[1]
      const phone: string | null = plate[2].match(PHONE)?.[1] ?? null
      const name: string | null = plate[2].replace(PHONE, "").trim() || null
      const known: VehicleOption | undefined = ctx.vehicles.find((v) => squash(v.plate_no) === squash(plateNo))
      vehicle = {
        vehicle_id: known?.id ?? null,
        plate_no_snapshot: known?.plate_no ?? plateNo,
        driver_name_snapshot: name ?? known?.driver_name ?? null,
        driver_phone_snapshot: phone ?? known?.driver_phone ?? null,
      }
      continue
    }

    if (client === null) {
      const [head, ...contact] = line.split(/[\s,，]+/)
      const found = findByPrefix(ctx.clients, (c) => c.name, head)
      if (found === "ambiguous") {
        return { ok: false, error: `"${head}"(으)로 시작하는 거래처가 여러 곳이에요. 이름을 조금 더 써 주세요.` }
      }
      if (found) {
        client = { id: found.id, name: found.name, contact: contact.join(" ") || null }
        continue
      }
    }

    places.push(line)
  }

  if (!client) {
    return { ok: false, error: "거래처를 못 찾았어요. 앱에 등록된 거래처 이름으로 써 주세요. 예: 아토무역 이재근" }
  }
  if (places.length < 2) {
    return { ok: false, error: "상차지와 하차지를 한 줄씩 써 주세요. 예:\n부산2곳\n현대그린" }
  }
  for (const value of [freight, fee]) {
    if (value !== null && value > MAX_AMOUNT) return { ok: false, error: "금액이 너무 커요." }
  }

  return {
    ok: true,
    value: {
      dispatch_date: date ?? ctx.today,
      client_id: client.id,
      client_name: client.name,
      contact_name: client.contact,
      origin: places[0],
      destination: places[1],
      dropoff_type: dropoff ?? "SAME_DAY",
      pallet_count: cargo?.pallets ?? null,
      weight_ton: weight,
      cargo_box_type: cargo?.type ?? null,
      vehicle_id: vehicle?.vehicle_id ?? null,
      plate_no_snapshot: vehicle?.plate_no_snapshot ?? null,
      driver_name_snapshot: vehicle?.driver_name_snapshot ?? null,
      driver_phone_snapshot: vehicle?.driver_phone_snapshot ?? null,
      freight_amount: freight,
      fee_amount: fee ?? 0,
      memo: places.length > 2 ? places.slice(2).join(" / ") : null,
    },
  }
}

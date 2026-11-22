import type { CargoBoxType, DropoffType } from "@/lib/supabase/database.types"
import {
  findByPrefix,
  MAX_AMOUNT,
  parseAmountToken,
  parseDateLine,
  squash,
  parseLoadLine,
  parseWeightLine,
  type ClientOption,
  type ParseResult,
} from "@/lib/telegram/parse-sale"

// 물량·무게 읽기는 매출과 같이 쓴다(매출 파일에 있음). 예전처럼 여기서도 꺼내 쓸 수 있게.
export { parseLoadLine, parseWeightLine }

/**
 * 텔레그램 배차 메시지. 줄 모양으로 알아보는 것(아무 줄에나):
 * 날짜 · 당착/익착(기본 당착) · 운임(33만) · 수수료(수2만) · 거래처+담당자+연락처(아토무역 이재근 010-...)
 * · 차량번호+차주+연락처(서울86바7754 김진승 010-...) · 차종+파레트(냉동3) · 무게(1.6, 1.6톤).
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
  contact_phone: string | null
  origin: string
  destination: string
  dropoff_type: DropoffType
  pallet_count: number | null
  weight_ton: number | null
  cargo_box_type: CargoBoxType | null
  /** 물량(화물). 예: "냉동3p" */
  cargo_note: string | null
  vehicle_id: string | null
  plate_no_snapshot: string | null
  driver_name_snapshot: string | null
  driver_phone_snapshot: string | null
  freight_amount: number | null
  fee_amount: number
  memo: string | null
}

const DROPOFF_WORDS: Record<string, DropoffType> = { 당착: "SAME_DAY", 익착: "NEXT_DAY" }

/** 차 종류를 뜻하는 말 → 차종. ("냉동"·"냉장"만 쓰면 차종이 아니라 물량이다 — parseLoadLine) */
const CARGO_WORDS: Record<string, CargoBoxType> = {
  냉동탑: "REFRIGERATED",
  냉장윙: "WING",
  윙: "WING",
  탑: "BOX",
  카고: "CARGO",
}

/** "냉동탑 3", "윙", "카고" → 차종(+파레트 수) */
export function parseCargoLine(line: string): { type: CargoBoxType; pallets: number | null } | null {
  const m = line.replace(/\s/g, "").match(/^([가-힣]+?)(\d+)?(?:파레트|plt|p)?$/i)
  if (!m) return null
  const type = CARGO_WORDS[m[1]]
  if (!type) return null
  return { type, pallets: m[2] ? Number(m[2]) : null }
}

/** "수2만", "수수료 2만" → 수수료 금액 */
function parseFeeLine(line: string): number | null {
  const m = line.replace(/\s/g, "").match(/^수(?:수료)?(.+)$/)
  return m ? parseAmountToken(m[1]) : null
}

/** "서울86바7754"의 "86바7754"처럼 지역 이름을 뺀 번호 */
function plateCore(plate: string): string {
  return squash(plate).match(/\d{2,3}[가-힣]\d{4}$/)?.[0] ?? squash(plate)
}

/** 같은 번호의 차량. 지역 이름을 빼고 써도 찾는다(같은 번호가 여러 대면 정확히 같은 것만). */
export function findVehicle(vehicles: VehicleOption[], plateNo: string): VehicleOption | undefined {
  const exact = vehicles.find((v) => squash(v.plate_no) === squash(plateNo))
  if (exact) return exact
  const sameCore = vehicles.filter((v) => plateCore(v.plate_no) === plateCore(plateNo))
  return sameCore.length === 1 ? sameCore[0] : undefined
}

const PLATE_TOKEN = /^(?:[가-힣]{2})?\d{2,3}[가-힣]\d{4}$/
const PHONE = /(01\d[-\s]?\d{3,4}[-\s]?\d{4})/

/**
 * 거래처 줄의 단어들로 거래처를 고른다. 몇 단어를 거래처 이름으로 썼는지도 돌려준다(나머지는 담당자).
 * 묶음(이름 첫 단어가 같은 곳, 예: 조은푸드 육대장·조은푸드 이화수)은
 * "조은푸드 육대장" · "육대장" · "조은푸드"(그중 가장 최근에 배차한 곳) 모두 된다.
 */
export function pickClient(
  clients: ClientOption[],
  words: string[],
  recentClientIds: string[] = []
): { client: ClientOption; used: number } | "ambiguous" | null {
  const [head, next] = words
  if (!head) return null
  const found = findByPrefix(clients, (c) => c.name, head)
  if (found && found !== "ambiguous") return { client: found, used: 1 }

  if (found === "ambiguous") {
    const q = squash(head)
    const candidates = clients.filter((c) => squash(c.name).startsWith(q))
    // "조은푸드 육대장": 두 단어를 붙여서 다시 찾기
    if (next) {
      const two = findByPrefix(candidates, (c) => c.name, head + next)
      if (two && two !== "ambiguous") return { client: two, used: 2 }
    }
    // "조은푸드": 모두 첫 단어가 같은 묶음이면 가장 최근에 배차한 곳
    const firstWords = new Set(candidates.map((c) => squash(c.name.trim().split(/\s+/)[0])))
    if (firstWords.size === 1 && firstWords.has(q)) {
      const recent = recentClientIds.map((id) => candidates.find((c) => c.id === id)).find(Boolean)
      if (recent) return { client: recent, used: 1 }
    }
    return "ambiguous"
  }

  // "육대장": 여러 단어 이름의 뒷부분과 똑같으면
  const q = squash(head)
  const byTail = clients.filter((c) => {
    const parts = c.name.trim().split(/\s+/)
    return parts.length >= 2 && squash(parts.slice(1).join("")) === q
  })
  return byTail.length === 1 ? { client: byTail[0], used: 1 } : null
}

/**
 * 차량 줄: 차량번호·차주 이름·연락처가 어떤 순서로 있어도 된다
 * ("서울86바7754 김진승 010-…", "김진승 010-… 서울86바7754", "010-… 서울86바7754 김진승").
 * 차량번호(띄어쓰기로 나뉜 한 덩어리)가 없으면 null.
 */
export function parseVehicleLine(line: string): { plateNo: string; name: string | null; phone: string | null } | null {
  const phone: string | null = line.match(PHONE)?.[1] ?? null
  const tokens = line.replace(PHONE, " ").split(/[\s,，]+/).filter(Boolean)
  const index = tokens.findIndex((token) => PLATE_TOKEN.test(token))
  if (index < 0) return null
  const name = tokens.filter((_, i) => i !== index).join(" ").trim()
  return { plateNo: tokens[index], name: name || null, phone }
}

export function parseDispatchLines(
  lines: string[],
  ctx: { today: string; clients: ClientOption[]; vehicles: VehicleOption[]; recentClientIds?: string[] }
): ParseResult<ParsedDispatch> {
  let date: string | null = null
  let dropoff: DropoffType | null = null
  let freight: number | null = null
  let fee: number | null = null
  let client: { id: string; name: string; contact: string | null; phone: string | null } | null = null
  let vehicle: Pick<
    ParsedDispatch,
    "vehicle_id" | "plate_no_snapshot" | "driver_name_snapshot" | "driver_phone_snapshot"
  > | null = null
  let cargo: { type: CargoBoxType; pallets: number | null } | null = null
  let load: string | null = null
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

    if (load === null) {
      const l = parseLoadLine(line)
      if (l) {
        load = l.note
        if (l.weight !== null && weight === null) weight = l.weight
        continue
      }
    }

    if (cargo === null) {
      const c = parseCargoLine(line)
      if (c) {
        cargo = c
        continue
      }
    }

    const plate: ReturnType<typeof parseVehicleLine> = vehicle === null ? parseVehicleLine(line) : null
    if (plate) {
      const plateNo: string = plate.plateNo
      const name: string | null = plate.name
      const phone: string | null = plate.phone
      const known: VehicleOption | undefined = findVehicle(ctx.vehicles, plateNo)
      vehicle = {
        vehicle_id: known?.id ?? null,
        plate_no_snapshot: known?.plate_no ?? plateNo,
        driver_name_snapshot: name ?? known?.driver_name ?? null,
        driver_phone_snapshot: phone ?? known?.driver_phone ?? null,
      }
      continue
    }

    // 차량번호 없이 차주 이름만("김진승", "김진승 010-…"): 차량 정보에 등록된 차주면 그 차로
    if (vehicle === null) {
      const typedPhone: string | null = line.match(PHONE)?.[1] ?? null
      const nameOnly = line.replace(PHONE, " ").trim()
      if (/^[가-힣]{2,5}$/.test(nameOnly)) {
        const same = ctx.vehicles.filter((v) => squash(v.driver_name) === squash(nameOnly))
        if (same.length > 1) {
          return { ok: false, error: `"${nameOnly}" 차주 차량이 ${same.length}대예요. 차량번호도 같이 써 주세요. 예: 서울86바7754 ${nameOnly}` }
        }
        if (same.length === 1) {
          const known = same[0]
          vehicle = {
            vehicle_id: known.id,
            plate_no_snapshot: known.plate_no,
            driver_name_snapshot: known.driver_name,
            driver_phone_snapshot: typedPhone ?? known.driver_phone,
          }
          continue
        }
      }
    }

    places.push(line)
  }

  // 거래처 줄: 맨 뒤에서부터 거래처로 읽히는 첫 줄 (상차지에 "조은푸드"처럼 거래처 이름이 들어가도 끝 줄이 거래처)
  for (let i = places.length - 1; i >= 0; i--) {
    const phone: string | null = places[i].match(PHONE)?.[1] ?? null
    const words = places[i].replace(PHONE, " ").split(/[\s,，]+/).filter(Boolean)
    const found = pickClient(ctx.clients, words, ctx.recentClientIds)
    if (found === null) continue
    if (found === "ambiguous") {
      return { ok: false, error: `"${words[0]}"(으)로 시작하는 거래처가 여러 곳이에요. 이름을 조금 더 써 주세요.` }
    }
    const contact = words.slice(found.used)
    client = { id: found.client.id, name: found.client.name, contact: contact.join(" ") || null, phone }
    places.splice(i, 1)
    break
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
      contact_phone: client.phone,
      origin: places[0],
      destination: places[1],
      dropoff_type: dropoff ?? "SAME_DAY",
      pallet_count: cargo?.pallets ?? null,
      weight_ton: weight,
      cargo_box_type: cargo?.type ?? null,
      cargo_note: load,
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

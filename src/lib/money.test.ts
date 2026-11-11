import { describe, expect, it } from "vitest"

import {
  MAX_AMOUNT,
  amountSchema,
  applyAmountInputEdit,
  assertVatIntegrity,
  calcNetAmount,
  formatAmountInput,
  calcVatFromSupply,
  formatKRW,
  isVatExemptForPayment,
  normalizeAmountFragment,
  parseAmountInput,
  splitVat,
} from "./money"

describe("isVatExemptForPayment (매출 세액 규칙: 세금계산서만 세액 있음)", () => {
  it("세금계산서만 세액이 있고, 계좌이체·현금은 세액이 없다", () => {
    expect(isVatExemptForPayment("TAX_INVOICE")).toBe(false)
    expect(isVatExemptForPayment("TRANSFER")).toBe(true)
    expect(isVatExemptForPayment("CASH")).toBe(true)
  })

  it("알 수 없는 값·빈 값은 세액 없음으로 본다 (그런 값은 zod enum이 따로 거부)", () => {
    expect(isVatExemptForPayment("")).toBe(true)
    expect(isVatExemptForPayment("tax_invoice")).toBe(true)
    expect(isVatExemptForPayment("BOGUS")).toBe(true)
  })

  it("calcVatFromSupply와 이어 쓰면 PRD 4.3 금액 규칙(공급가액+세액=합계)이 지불방법별로 지켜진다", () => {
    const methods = ["TAX_INVOICE", "TRANSFER", "CASH"] as const
    const supplies = [0, 1, 4, 5, 6, 14, 15, 100_000, 550_000, 99_999_999_999]

    for (const method of methods) {
      for (const supply of supplies) {
        const { vatAmount, totalAmount } = calcVatFromSupply(
          supply,
          isVatExemptForPayment(method)
        )
        expect(supply + vatAmount).toBe(totalAmount)
        if (method === "TAX_INVOICE") {
          // 세액 = 공급가액의 10%, 원 단위 반올림(round-half-up)
          expect(vatAmount).toBe(Math.floor((supply + 5) / 10))
        } else {
          expect(vatAmount).toBe(0)
          expect(totalAmount).toBe(supply)
        }
      }
    }
  })
})

describe("splitVat", () => {
  it("반올림 기준값들에 대해 정확히 분리한다", () => {
    // 1000 / 1.1 = 909.0909... -> 909
    expect(splitVat(1000, false)).toEqual({ supplyAmount: 909, vatAmount: 91 })
    // 1100 / 1.1 = 1000 (나누어 떨어짐)
    expect(splitVat(1100, false)).toEqual({
      supplyAmount: 1000,
      vatAmount: 100,
    })
    // round-half-up 경계: total*10 % 11 === 5.5 이상이 되는 지점 확인
    // total=11 -> 110/11=10 나머지 0 -> supply=10, vat=1
    expect(splitVat(11, false)).toEqual({ supplyAmount: 10, vatAmount: 1 })
  })

  it("면세 건은 공급가액 = 합계금액, 부가세 = 0", () => {
    expect(splitVat(50000, true)).toEqual({
      supplyAmount: 50000,
      vatAmount: 0,
    })
  })

  it("0원도 정상 처리한다", () => {
    expect(splitVat(0, false)).toEqual({ supplyAmount: 0, vatAmount: 0 })
  })
})

describe("완료 기준: 공급가액 + 부가세 = 합계금액 100% 검증", () => {
  it("0부터 100,000까지 모든 합계금액에 대해 정합성이 성립한다", () => {
    for (let total = 0; total <= 100_000; total++) {
      const { supplyAmount, vatAmount } = splitVat(total, false)
      expect(supplyAmount + vatAmount).toBe(total)
      expect(() =>
        assertVatIntegrity({ totalAmount: total, supplyAmount, vatAmount })
      ).not.toThrow()
    }
  })

  it("무작위 표본 100건에 대해서도 성립한다 (최대 허용 금액 범위)", () => {
    for (let i = 0; i < 100; i++) {
      const total = Math.floor(Math.random() * MAX_AMOUNT)
      const { supplyAmount, vatAmount } = splitVat(total, false)
      expect(supplyAmount + vatAmount).toBe(total)
    }
  })
})

describe("assertVatIntegrity", () => {
  it("불일치 시 저장을 거부하기 위해 예외를 던진다", () => {
    expect(() =>
      assertVatIntegrity({
        totalAmount: 1000,
        supplyAmount: 900,
        vatAmount: 91,
      })
    ).toThrow()
  })
})

describe("calcNetAmount", () => {
  it("공급가액에서 수수료를 뺀다", () => {
    expect(calcNetAmount(909, 50)).toBe(859)
  })
})

describe("formatKRW", () => {
  it("3자리 콤마와 원 단위를 표기한다", () => {
    expect(formatKRW(1234000)).toBe("1,234,000원")
    expect(formatKRW(0)).toBe("0원")
  })
})

describe("amountSchema", () => {
  it("0 이상 정수, 최대값 이하만 허용한다", () => {
    expect(amountSchema.safeParse(0).success).toBe(true)
    expect(amountSchema.safeParse(MAX_AMOUNT).success).toBe(true)
    expect(amountSchema.safeParse(-1).success).toBe(false)
    expect(amountSchema.safeParse(MAX_AMOUNT + 1).success).toBe(false)
    expect(amountSchema.safeParse(1.5).success).toBe(false)
  })
})

describe("parseAmountInput (금액 입력칸)", () => {
  it("쉼표·원·공백은 무시한다", () => {
    expect(parseAmountInput("1,234,000")).toBe(1234000)
    expect(parseAmountInput("1,234원")).toBe(1234)
    expect(parseAmountInput(" 5 000 ")).toBe(5000)
  })

  it("숫자가 없으면 null(빈칸)이다", () => {
    expect(parseAmountInput("")).toBeNull()
    expect(parseAmountInput(".")).toBeNull()
    expect(parseAmountInput(".00")).toBeNull()
    expect(parseAmountInput(" 원 ")).toBeNull()
  })

  it("숫자·쉼표·점·공백·원 외 문자가 섞이면 거부한다", () => {
    expect(parseAmountInput("abc")).toBe("invalid")
    expect(parseAmountInput("12x")).toBe("invalid")
    expect(parseAmountInput(",")).toBe("invalid")
  })

  it("천 단위가 아닌 쉼표는 거부한다 ('1,5'를 15로 읽으면 금액이 둔갑한다)", () => {
    expect(parseAmountInput("1,5")).toBe("invalid")
    expect(parseAmountInput("1234,567")).toBe("invalid")
    expect(parseAmountInput(",500")).toBe("invalid")
    // 0으로 시작하는 첫 그룹은 소수 쉼표("0,5")로도 읽혀 모호하므로 거부한다
    expect(parseAmountInput("0,500")).toBe("invalid")
    expect(parseAmountInput("00,500")).toBe("invalid")
    expect(parseAmountInput("01,234")).toBe("invalid")
    expect(parseAmountInput("0,001")).toBe("invalid")
    expect(parseAmountInput("1,234,567")).toBe(1234567)
    expect(parseAmountInput("34,567")).toBe(34567)
  })

  it("전각 마침표(．)도 소수점으로 취급한다", () => {
    expect(parseAmountInput("1．5")).toBe("invalid")
    expect(parseAmountInput("550,000．00")).toBe(550000)
  })

  it("앞자리 0은 버린다", () => {
    expect(parseAmountInput("007")).toBe(7)
    expect(parseAmountInput("0")).toBe(0)
    expect(parseAmountInput("000")).toBe(0)
  })

  it("소수부가 비었거나 전부 0이면 정수부만 쓴다 (엑셀 .00 형식)", () => {
    expect(parseAmountInput("550,000.00")).toBe(550000)
    expect(parseAmountInput("550000.0")).toBe(550000)
    expect(parseAmountInput("550,000.")).toBe(550000)
    expect(parseAmountInput("1,234,567.000원")).toBe(1234567)
  })

  it("0이 아닌 소수부는 거부한다 (10배·100배로 둔갑 금지)", () => {
    expect(parseAmountInput("1.5")).toBe("invalid")
    expect(parseAmountInput("550,000.50")).toBe("invalid")
    expect(parseAmountInput("550,000.05")).toBe("invalid")
    expect(parseAmountInput("1,000.5원")).toBe("invalid")
    expect(parseAmountInput(".5")).toBe("invalid")
  })

  it("소수점이 두 개 이상이면 거부한다", () => {
    expect(parseAmountInput("1.000.000")).toBe("invalid")
    expect(parseAmountInput("550,000.00.")).toBe("invalid")
  })

  it("음수 표시(-, −, －, 회계식 괄호)는 거부한다 (부호가 조용히 사라지면 안 됨)", () => {
    expect(parseAmountInput("-30000")).toBe("invalid")
    expect(parseAmountInput("-30,000")).toBe("invalid")
    expect(parseAmountInput("30,000-")).toBe("invalid")
    expect(parseAmountInput("−30000")).toBe("invalid")
    expect(parseAmountInput("－30000")).toBe("invalid")
    expect(parseAmountInput("(30,000)")).toBe("invalid")
    expect(parseAmountInput("-0")).toBe("invalid")
  })

  it("상한(99,999,999,999)까지는 허용하고 초과는 overflow", () => {
    expect(parseAmountInput("99,999,999,999")).toBe(MAX_AMOUNT)
    expect(parseAmountInput("99,999,999,999.00")).toBe(MAX_AMOUNT)
    expect(parseAmountInput("100,000,000,000")).toBe("overflow")
    expect(parseAmountInput("123456789012345678901234")).toBe("overflow")
    // 앞자리 0 때문에 길어져도 값이 상한 이하면 허용
    expect(parseAmountInput("00099999999999")).toBe(MAX_AMOUNT)
  })
})

describe("formatAmountInput (금액 입력칸 표시)", () => {
  it("천 단위 쉼표를 넣는다", () => {
    expect(formatAmountInput(1234567)).toBe("1,234,567")
    expect(formatAmountInput(999)).toBe("999")
    expect(formatAmountInput(MAX_AMOUNT)).toBe("99,999,999,999")
  })

  it("null/undefined는 빈칸", () => {
    expect(formatAmountInput(null)).toBe("")
    expect(formatAmountInput(undefined)).toBe("")
  })

  it("0은 기본적으로 '0', 0 기본값 필드(emptyWhenZero)는 빈칸", () => {
    expect(formatAmountInput(0)).toBe("0")
    expect(formatAmountInput(0, { emptyWhenZero: true })).toBe("")
  })
})

describe("applyAmountInputEdit (금액 입력칸 편집 해석)", () => {
  it("0 기본값 모드: 빈칸은 null(→ 호출 쪽에서 0), '0' 입력은 빈칸 그대로(앞자리 0 방지)", () => {
    expect(
      applyAmountInputEdit({
        previousText: "5",
        nextText: "",
        caret: 0,
        inputType: "deleteContentBackward",
        emptyWhenZero: true,
      })
    ).toEqual({ status: "ok", value: null, caret: 0 })

    // 0이 빈칸으로 보이는 상태에서 "0"을 치면 값은 0, 표시는 여전히 빈칸
    expect(
      applyAmountInputEdit({
        previousText: "",
        nextText: "0",
        caret: 1,
        inputType: "insertText",
        emptyWhenZero: true,
      })
    ).toEqual({ status: "ok", value: 0, caret: 0 })

    // 이어서 "5"를 쳐도 "05"가 아니라 5
    expect(
      applyAmountInputEdit({
        previousText: "",
        nextText: "5",
        caret: 1,
        inputType: "insertText",
        emptyWhenZero: true,
      })
    ).toEqual({ status: "ok", value: 5, caret: 1 })
  })

  it("nullable 모드: 빈칸은 null, 0은 0으로 구분된다", () => {
    expect(
      applyAmountInputEdit({
        previousText: "90,000",
        nextText: "",
        caret: 0,
        inputType: "deleteContentBackward",
      })
    ).toEqual({ status: "ok", value: null, caret: 0 })

    expect(
      applyAmountInputEdit({
        previousText: "",
        nextText: "0",
        caret: 1,
        inputType: "insertText",
      })
    ).toEqual({ status: "ok", value: 0, caret: 1 })

    // "0" 다음에 "5" → 5 (앞자리 0 제거, 커서는 5 뒤)
    expect(
      applyAmountInputEdit({
        previousText: "0",
        nextText: "05",
        caret: 2,
        inputType: "insertText",
      })
    ).toEqual({ status: "ok", value: 5, caret: 1 })
  })

  it("끝에 숫자를 치면 쉼표가 다시 들어가고 커서는 맨 끝", () => {
    // "1,000" + "5" → "10,005"
    expect(
      applyAmountInputEdit({
        previousText: "1,000",
        nextText: "1,0005",
        caret: 6,
        inputType: "insertText",
      })
    ).toEqual({ status: "ok", value: 10005, caret: 6 })
  })

  it("가운데에 숫자를 넣어도 커서는 넣은 숫자 바로 뒤에 머문다", () => {
    // "1,0|00"에 5 → "1,05|00" → 10,500 → "10,5|00"
    expect(
      applyAmountInputEdit({
        previousText: "1,000",
        nextText: "1,0500",
        caret: 4,
        inputType: "insertText",
      })
    ).toEqual({ status: "ok", value: 10500, caret: 4 })
  })

  it("쉼표 뒤에서 Backspace를 누르면 쉼표 앞 숫자를 지운다", () => {
    // "12,|345"에서 Backspace → 브라우저는 "12345"(쉼표만 삭제), 커서 2
    expect(
      applyAmountInputEdit({
        previousText: "12,345",
        nextText: "12345",
        caret: 2,
        inputType: "deleteContentBackward",
      })
    ).toEqual({ status: "ok", value: 1345, caret: 1 })
  })

  it("쉼표 앞에서 Delete를 누르면 쉼표 뒤 숫자를 지운다", () => {
    // "12|,345"에서 Delete → 브라우저는 "12345", 커서 2
    expect(
      applyAmountInputEdit({
        previousText: "12,345",
        nextText: "12345",
        caret: 2,
        inputType: "deleteContentForward",
      })
    ).toEqual({ status: "ok", value: 1245, caret: 3 })
  })

  it("숫자가 아닌 글자를 한 글자 입력하면 무시한다 (값·화면 불변)", () => {
    for (const typed of ["a", ".", "．", "-", "−", "－", "(", ")", ",", " ", "원"]) {
      expect(
        applyAmountInputEdit({
          previousText: "1,000",
          nextText: `1,000${typed}`,
          caret: 6,
          inputType: "insertText",
        })
      ).toEqual({ status: "invalid" })
    }
  })

  it("붙여넣은 '1,234,000원'도 숫자만 남긴다", () => {
    expect(
      applyAmountInputEdit({
        previousText: "",
        nextText: "1,234,000원",
        caret: 10,
        inputType: "insertFromPaste",
      })
    ).toEqual({ status: "ok", value: 1234000, caret: 9 })
  })

  it("붙여넣은 '550,000.00'은 550,000이 되고 화면에 점이 남지 않는다 (100배 아님)", () => {
    expect(
      applyAmountInputEdit({
        previousText: "",
        nextText: "550,000.00",
        caret: 10,
        inputType: "insertFromPaste",
        emptyWhenZero: true,
      })
    ).toEqual({ status: "ok", value: 550000, caret: 7 })
  })

  it("0이 아닌 소수부·소수점 2개·천 단위 아닌 쉼표를 붙여넣으면 편집 전체를 거부한다", () => {
    for (const pasted of ["550,000.50", "1.5", ".5", "1.2.3", "1,5", "12x"]) {
      expect(
        applyAmountInputEdit({
          previousText: "1,000",
          nextText: `1,000${pasted}`,
          caret: 5 + pasted.length,
          inputType: "insertFromPaste",
        })
      ).toEqual({ status: "invalid" })
    }
  })

  it("기존 값이 있는 칸에 붙여넣은 조각은 조각만 정규화해 끼워 넣는다", () => {
    // "1,000" 끝에 "250.00"을 붙여넣기 → 1,000250
    expect(
      applyAmountInputEdit({
        previousText: "1,000",
        nextText: "1,000250.00",
        caret: 11,
        inputType: "insertFromPaste",
      })
    ).toEqual({ status: "ok", value: 1000250, caret: 9 })

    // 전체 선택 후 "1,500.00"으로 덮어쓰기 → 1,500
    expect(
      applyAmountInputEdit({
        previousText: "550,000",
        nextText: "1,500.00",
        caret: 8,
        inputType: "insertFromPaste",
      })
    ).toEqual({ status: "ok", value: 1500, caret: 5 })
  })

  it("전각 마침표가 든 붙여넣기도 같은 규칙이다", () => {
    expect(
      applyAmountInputEdit({
        previousText: "",
        nextText: "1．5",
        caret: 3,
        inputType: "insertFromPaste",
      })
    ).toEqual({ status: "invalid" })

    expect(
      applyAmountInputEdit({
        previousText: "",
        nextText: "550,000．00",
        caret: 10,
        inputType: "insertFromPaste",
      })
    ).toEqual({ status: "ok", value: 550000, caret: 7 })
  })

  it("QA 재현 A: 점 꼬리에서 점을 지우던 입력은 이제 도달할 수 없고, 점을 넣는 입력은 무시된다", () => {
    // 화면에 점이 없으므로 "550,000"에서 점 한 글자를 넣어도 값은 그대로다.
    expect(
      applyAmountInputEdit({
        previousText: "550,000",
        nextText: "550,000.",
        caret: 8,
        inputType: "insertText",
      })
    ).toEqual({ status: "invalid" })
  })

  it("QA 재현 B: 정수 중간에 점을 넣어도 거부되어 금액이 1/1000이 되지 않는다", () => {
    expect(
      applyAmountInputEdit({
        previousText: "550,000",
        nextText: "550.,000",
        caret: 4,
        inputType: "insertText",
      })
    ).toEqual({ status: "invalid" })
  })

  it("QA 재현 A: 선택한 '100' 위에 '100,000'을 붙여넣으면 100,000이 된다 (같은 첫 글자 때문에 거부되면 안 됨)", () => {
    expect(
      applyAmountInputEdit({
        previousText: "100",
        nextText: "100,000",
        caret: 7,
        inputType: "insertFromPaste",
        replacedRange: { start: 0, end: 3 },
      })
    ).toEqual({ status: "ok", value: 100000, caret: 7 })

    expect(
      applyAmountInputEdit({
        previousText: "1",
        nextText: "1,234",
        caret: 5,
        inputType: "insertFromPaste",
        replacedRange: { start: 0, end: 1 },
      })
    ).toEqual({ status: "ok", value: 1234, caret: 5 })
  })

  it("QA 재현 B: 선택 영역 위에 붙여넣어도 거부해야 할 조각은 거부한다", () => {
    // "4,541,178"에서 "1,"(4~6)을 선택하고 "1,5"를 붙여넣기 → 쉼표가 조용히 사라지면 안 된다
    expect(
      applyAmountInputEdit({
        previousText: "4,541,178",
        nextText: "4,541,5178",
        caret: 7,
        inputType: "insertFromPaste",
        replacedRange: { start: 4, end: 6 },
      })
    ).toEqual({ status: "invalid" })

    // 선택한 "1" 위에 "1234,567" → 천 단위가 아닌 쉼표
    expect(
      applyAmountInputEdit({
        previousText: "1",
        nextText: "1234,567",
        caret: 8,
        inputType: "insertFromPaste",
        replacedRange: { start: 0, end: 1 },
      })
    ).toEqual({ status: "invalid" })
  })

  it("QA 재현 C: 선택 영역 위에 쉼표 한 글자를 치거나 숫자 없는 조각을 붙여넣어도 선택한 숫자가 지워지지 않는다", () => {
    // "1,234,567"에서 ",234"(1~5)를 선택하고 "," 입력
    expect(
      applyAmountInputEdit({
        previousText: "1,234,567",
        nextText: "1,,567",
        caret: 2,
        inputType: "insertText",
        replacedRange: { start: 1, end: 5 },
      })
    ).toEqual({ status: "invalid" })

    // "234"(2~5)를 선택하고 공백/원/".00"만 붙여넣기
    for (const pasted of ["  ", "원원", ".0", " 원"]) {
      expect(
        applyAmountInputEdit({
          previousText: "1,234,567",
          nextText: `1,${pasted},567`,
          caret: 2 + pasted.length,
          inputType: "insertFromPaste",
          replacedRange: { start: 2, end: 5 },
        })
      ).toEqual({ status: "invalid" })
    }
  })

  it("QA 재현 D: 0으로 시작하는 쉼표 조각은 선택 영역 위에서도 거부한다", () => {
    expect(
      applyAmountInputEdit({
        previousText: "7",
        nextText: "0,500",
        caret: 5,
        inputType: "insertFromPaste",
        replacedRange: { start: 0, end: 1 },
      })
    ).toEqual({ status: "invalid" })
  })

  it("replacedRange가 편집 전후 문자열과 맞지 않으면 무시하고 앞뒤 비교로 해석한다", () => {
    // 엉뚱한 범위가 와도 값이 둔갑하지 않는다 (끝에 5를 친 일반 입력으로 해석)
    expect(
      applyAmountInputEdit({
        previousText: "1,000",
        nextText: "1,0005",
        caret: 6,
        inputType: "insertText",
        replacedRange: { start: 0, end: 1 },
      })
    ).toEqual({ status: "ok", value: 10005, caret: 6 })
  })

  it("'1' '.' '5'를 차례로 치면 점이 무시되어 15가 된다 (화면에 바로 15로 보임)", () => {
    expect(
      applyAmountInputEdit({
        previousText: "1",
        nextText: "1.",
        caret: 2,
        inputType: "insertText",
      })
    ).toEqual({ status: "invalid" })

    expect(
      applyAmountInputEdit({
        previousText: "1",
        nextText: "15",
        caret: 2,
        inputType: "insertText",
      })
    ).toEqual({ status: "ok", value: 15, caret: 2 })
  })

  it("음수 부호는 붙여넣기든 타이핑이든 거부한다", () => {
    expect(
      applyAmountInputEdit({
        previousText: "",
        nextText: "-30000",
        caret: 6,
        inputType: "insertFromPaste",
      })
    ).toEqual({ status: "invalid" })

    expect(
      applyAmountInputEdit({
        previousText: "30,000",
        nextText: "-30,000",
        caret: 1,
        inputType: "insertText",
      })
    ).toEqual({ status: "invalid" })
  })

  it("상한을 넘기는 입력은 overflow로 거부한다", () => {
    expect(
      applyAmountInputEdit({
        previousText: "99,999,999,999",
        nextText: "99,999,999,9990",
        caret: 15,
        inputType: "insertText",
      })
    ).toEqual({ status: "overflow" })

    // 중간 삽입도 거부 (QA 재현 케이스: 4번째 자리에 1)
    expect(
      applyAmountInputEdit({
        previousText: "99,999,999,999",
        nextText: "99,1999,999,999",
        caret: 4,
        inputType: "insertText",
      })
    ).toEqual({ status: "overflow" })

    expect(
      applyAmountInputEdit({
        previousText: "9,999,999,999",
        nextText: "9,999,999,9999",
        caret: 14,
        inputType: "insertText",
      })
    ).toEqual({
      status: "ok",
      value: MAX_AMOUNT,
      caret: 14,
    })
  })
})

/** 결정적 의사난수 (시드 고정 — 실패 시 같은 입력으로 재현된다). */
function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("applyAmountInputEdit 불변식 (무작위 편집 수천 번)", () => {
  const ALPHABET = [..."0123456789,.．-−－() 원x"]
  const stripLeadingZeros = (digits: string) => digits.replace(/^0+(?=\d)/, "")
  const digitsOf = (text: string) => text.replace(/\D/g, "")

  function randomPreviousValue(random: () => number): number {
    const length = Math.floor(random() * 12) // 0~11자리 (0자리 = 0원)
    if (length === 0) return 0
    let digits = String(1 + Math.floor(random() * 9))
    for (let i = 1; i < length; i++) digits += String(Math.floor(random() * 10))
    return Math.min(Number(digits), MAX_AMOUNT)
  }

  it("선택 영역 덮어쓰기(타이핑·붙여넣기)도 금액을 둔갑시키지 않는다", () => {
    const random = mulberry32(20261110)
    const FRAGMENTS = [
      "5", "0", "100", "100,000", "1,234", "550,000.00", "550,000.50", "1.5", "1,5",
      "0,500", "1234,567", "  ", "원원", ".0", ",", ".", "-30000", "(30,000)", "12x",
      "99,999,999,999", "1．5", "550,000．00", "７",
    ]

    for (let iteration = 0; iteration < 4000; iteration++) {
      const previousText = formatAmountInput(randomPreviousValue(random))
      const start = Math.floor(random() * (previousText.length + 1))
      const end = start + Math.floor(random() * (previousText.length - start + 1))
      const typed = random() < 0.5
      const inserted = typed
        ? ALPHABET[Math.floor(random() * ALPHABET.length)]
        : FRAGMENTS[Math.floor(random() * FRAGMENTS.length)]

      const nextText = previousText.slice(0, start) + inserted + previousText.slice(end)
      const caret = start + inserted.length
      const label = `${typed ? "입력" : "붙여넣기"} '${inserted}' over [${start},${end}) of '${previousText}'`

      const result = applyAmountInputEdit({
        previousText,
        nextText,
        caret,
        inputType: typed ? "insertText" : "insertFromPaste",
        replacedRange: { start, end },
      })

      // 기대값: 선택 구간을 걷어낸 앞·뒤 숫자 사이에 "정규화된 조각"을 끼운 숫자열
      let fragmentDigits: string | null
      if (inserted.length === 1) {
        fragmentDigits = /[0-9]/.test(inserted) ? inserted : null
      } else {
        const normalized = normalizeAmountFragment(inserted)
        fragmentDigits = normalized === "" ? null : normalized
      }

      if (fragmentDigits === null) {
        expect(result, label).toEqual({ status: "invalid" })
        continue
      }

      const expectedDigits =
        digitsOf(previousText.slice(0, start)) +
        fragmentDigits +
        digitsOf(previousText.slice(end))
      const stripped = stripLeadingZeros(expectedDigits)
      if (stripped.length > String(MAX_AMOUNT).length || Number(stripped) > MAX_AMOUNT) {
        expect(result, label).toEqual({ status: "overflow" })
        continue
      }

      expect(result.status, label).toBe("ok")
      if (result.status !== "ok") continue
      expect(result.value, label).toBe(Number(stripped))
      expect(digitsOf(formatAmountInput(result.value)), label).toBe(String(Number(stripped)))
    }
  })

  it("타이핑·삭제 어떤 편집도 금액을 10배·100배로 둔갑시키지 않는다", () => {
    const random = mulberry32(20261109)

    for (let iteration = 0; iteration < 4000; iteration++) {
      const previousText = formatAmountInput(randomPreviousValue(random))
      const previousDigits = digitsOf(previousText)
      const kind = Math.floor(random() * 3) // 0 입력, 1 Backspace, 2 Delete

      let nextText: string
      let caret: number
      let inputType: string
      let expectedDigits: string | null // null = 거부가 기대됨
      let label: string

      if (kind === 0) {
        const position = Math.floor(random() * (previousText.length + 1))
        const typed = ALPHABET[Math.floor(random() * ALPHABET.length)]
        nextText = previousText.slice(0, position) + typed + previousText.slice(position)
        caret = position + 1
        inputType = "insertText"
        label = `입력 '${typed}' @${position} in '${previousText}'`
        if (/[0-9]/.test(typed)) {
          const digitIndex = digitsOf(previousText.slice(0, position)).length
          expectedDigits =
            previousDigits.slice(0, digitIndex) + typed + previousDigits.slice(digitIndex)
        } else {
          expectedDigits = null
        }
      } else {
        if (previousText.length === 0) continue
        const backspace = kind === 1
        const position = backspace
          ? 1 + Math.floor(random() * previousText.length)
          : Math.floor(random() * previousText.length)
        const removedIndex = backspace ? position - 1 : position
        const removedChar = previousText[removedIndex]
        nextText = previousText.slice(0, removedIndex) + previousText.slice(removedIndex + 1)
        caret = removedIndex
        inputType = backspace ? "deleteContentBackward" : "deleteContentForward"
        label = `${backspace ? "Backspace" : "Delete"} @${removedIndex} in '${previousText}'`

        const digitsBefore = digitsOf(previousText.slice(0, removedIndex)).length
        let digitIndexToRemove: number
        if (removedChar === ",") {
          // 쉼표 위 삭제는 인접 숫자를 대신 지운다 (Backspace: 앞 숫자, Delete: 뒤 숫자).
          digitIndexToRemove = backspace ? digitsBefore - 1 : digitsBefore
        } else {
          digitIndexToRemove = digitsBefore
        }
        expectedDigits =
          previousDigits.slice(0, digitIndexToRemove) +
          previousDigits.slice(digitIndexToRemove + 1)
      }

      const result = applyAmountInputEdit({ previousText, nextText, caret, inputType })

      if (expectedDigits === null) {
        expect(result, label).toEqual({ status: "invalid" })
        continue
      }

      const stripped = expectedDigits === "" ? "" : stripLeadingZeros(expectedDigits)
      if (stripped.length > String(MAX_AMOUNT).length || Number(stripped) > MAX_AMOUNT) {
        expect(result, label).toEqual({ status: "overflow" })
        continue
      }

      expect(result.status, label).toBe("ok")
      if (result.status !== "ok") continue
      expect(result.value, label).toBe(stripped === "" ? null : Number(stripped))

      // 화면은 항상 숫자와 쉼표뿐이고, 커서는 표시 문자열 안에 있다.
      const display = formatAmountInput(result.value)
      expect(display, label).toMatch(/^[0-9,]*$/)
      expect(result.caret, label).toBeGreaterThanOrEqual(0)
      expect(result.caret, label).toBeLessThanOrEqual(display.length)
    }
  })
})

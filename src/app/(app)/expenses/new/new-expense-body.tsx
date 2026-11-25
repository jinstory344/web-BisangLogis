import { CopyNotice } from "@/components/form/copy-notice"
import { loadServiceItemNames, loadServiceItems } from "@/lib/car-ledger/service-items-db"
import { getTodayInSeoul } from "@/lib/date"
import { loadExpenseForForm } from "@/lib/expense-installment-db"
import { createClient } from "@/lib/supabase/server"
import {
  buildExpenseCopyDefaults,
  expenseFormDefaults,
  type ExpenseFormValues,
} from "@/lib/validations/expense"

import { createExpenseAction } from "../actions"
import { getExpenseCards } from "../cards"
import { getExpenseCategories } from "../categories"
import { ExpenseForm } from "../expense-form"

/**
 * 이전 건 복사(?copy=id): 삭제되지 않은 지출을 읽어 분류·금액·결제방법·할부·비고를 채우고
 * 날짜만 오늘로. 없는 id·삭제된 건·잘못된 형식이면 조용히 null(빈 폼).
 */
async function loadExpenseCopyDefaults(
  id: string
): Promise<ExpenseFormValues | null> {
  const supabase = await createClient()
  // 할부 회차를 복사하면 그 할부의 총액으로 (회차 금액을 다시 나누지 않게)
  const loaded = await loadExpenseForForm(supabase, id)
  if (!loaded) return null
  // 정비 항목 줄은 1회차(=수정 화면에 띄우는 줄)에 붙어 있다
  const items = await loadServiceItems(supabase, { expenseId: loaded.firstId })
  return buildExpenseCopyDefaults(loaded.row, getTodayInSeoul(), items)
}

/** 처음부터 채워 둘 분류 (차계부 ＋ → 차량 › 정비 등) */
export interface ExpensePrefill {
  major: string
  minor: string
}

/**
 * 지출 등록 본문(복사 안내 + 폼). 단독 페이지와 통합 등록 화면(/new)이 함께 쓴다.
 * copyId가 있으면 그 건을 복사해 채운다(없는 건·삭제된 건이면 빈 폼).
 */
export async function NewExpenseBody({
  copyId,
  prefill = null,
  returnTo = null,
}: {
  copyId: string | null
  prefill?: ExpensePrefill | null
  /** 저장 뒤 돌아갈 화면 (차계부에서 열었을 때) */
  returnTo?: string | null
}) {
  const [copiedValues, categories, cards, serviceItemNames] = await Promise.all([
    copyId ? loadExpenseCopyDefaults(copyId) : null,
    getExpenseCategories(),
    getExpenseCards(),
    createClient().then(loadServiceItemNames),
  ])
  const defaults =
    copiedValues ??
    (prefill
      ? { ...expenseFormDefaults, category_major: prefill.major, category_minor: prefill.minor }
      : expenseFormDefaults)

  return (
    <>
      {copiedValues ? <CopyNotice /> : null}
      <div className="mt-4 max-w-lg">
        {/* 같은 화면에서 다른 건을 복사하거나 빈 폼으로 돌아올 때 폼 상태를 새로 만든다. */}
        <ExpenseForm
          key={copiedValues ? copyId : `new-${prefill?.minor ?? ""}`}
          action={createExpenseAction.bind(null, returnTo)}
          defaultValues={defaults}
          submitLabel="등록"
          categories={categories.tree}
          categoriesEditable={categories.editable}
          cards={cards.names}
          cardsEditable={cards.editable}
          serviceItemNames={serviceItemNames}
        />
      </div>
    </>
  )
}

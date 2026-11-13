"use client"

import { ChevronRight, Pencil, X } from "lucide-react"
import { useState } from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  CUSTOM_MINOR,
  getMajors,
  getMinorsOf,
  normalizeCategoryName,
  type DeleteCategoryInput,
  type ExpenseCategoryTree,
} from "@/lib/constants/expense-categories"
import { cn } from "@/lib/utils"

import { CategoryAdder } from "./category-adder"

interface CategoryPickerSheetProps {
  tree: ExpenseCategoryTree
  /** 지금 고른 대분류·소분류 (소분류가 "기타"로 직접 입력한 값이면 customText) */
  major: string
  minor: string
  isCustom: boolean
  /** 분류를 추가·삭제할 수 있는지 (분류 테이블을 읽었을 때만) */
  editable: boolean
  /** 고르면 시트가 닫힌다. minor가 "기타"면 폼에서 직접 입력칸을 연다. */
  onPick: (major: string, minor: string) => void
  /** 성공하면 null, 실패하면 오류 문장 */
  onAddMajor: (name: string) => Promise<string | null>
  onAddMinor: (major: string, name: string) => Promise<string | null>
  /** 삭제 확인 창을 연다 (확인·삭제는 폼이 한다) */
  onRemove: (target: DeleteCategoryInput) => void
  invalid?: boolean
}

/**
 * 지출 "분류" 한 줄과, 누르면 아래에서 올라오는 분류 선택판 (사용자가 쓰는 가계부 앱 방식).
 * 위쪽 대분류 칩으로 고르고, 아래 3열 격자에서 소분류를 누르면 바로 정해진다.
 * 연필을 누르면 편집 모드: 칸마다 ✕(삭제, "기타" 제외)와 대분류·소분류 추가가 나온다.
 */
export function CategoryPickerSheet({
  tree,
  major,
  minor,
  isCustom,
  editable,
  onPick,
  onAddMajor,
  onAddMinor,
  onRemove,
  invalid = false,
}: CategoryPickerSheetProps) {
  const [open, setOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const majors = getMajors(tree)
  const [tab, setTab] = useState(major || majors[0] || "")
  const activeTab = majors.includes(tab) ? tab : majors[0] ?? ""
  const minors = getMinorsOf(tree, activeTab)

  const summary = major
    ? `${major} › ${isCustom ? minor || "직접 입력" : minor || "소분류 선택"}`
    : ""

  function openSheet() {
    setTab(major && majors.includes(major) ? major : majors[0] ?? "")
    setIsEditing(false)
    setOpen(true)
  }

  function pick(nextMinor: string) {
    onPick(activeTab, nextMinor)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={cn(
          "flex h-11 w-full items-center justify-between border-b text-left text-base",
          invalid ? "border-destructive" : "border-border",
          summary ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="truncate">{summary || "분류 선택"}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[80svh] gap-0 overflow-y-auto p-0"
        >
          <div className="flex items-center justify-between bg-muted px-4 py-2.5">
            <SheetTitle className="text-base font-medium">분류</SheetTitle>
            <SheetDescription className="sr-only">
              대분류를 고르고 소분류를 누르면 정해져요.
            </SheetDescription>
            <div className="flex items-center gap-1">
              {editable ? (
                <button
                  type="button"
                  aria-pressed={isEditing}
                  aria-label={isEditing ? "편집 끝내기" : "분류 편집"}
                  onClick={() => setIsEditing((value) => !value)}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full",
                    isEditing ? "text-red-400" : "text-muted-foreground"
                  )}
                >
                  <Pencil className="size-5" />
                </button>
              ) : null}
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setOpen(false)}
                className="flex size-10 items-center justify-center rounded-full text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* 대분류: 가로로 밀어 보는 칩 */}
          <div
            role="tablist"
            aria-label="대분류"
            className="no-scrollbar flex gap-2 overflow-x-auto border-b px-4 py-3"
          >
            {majors.map((name) => {
              const isActive = name === activeTab
              return (
                <span
                  key={name}
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full border text-sm font-medium",
                    isActive
                      ? "border-red-400 text-red-400"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setTab(name)}
                    className={cn("min-h-10 pl-4", isEditing ? "pr-1" : "pr-4")}
                  >
                    {name}
                  </button>
                  {isEditing ? (
                    <button
                      type="button"
                      aria-label={`${name} 삭제`}
                      onClick={() => onRemove({ major: name })}
                      className="mr-1 flex size-8 items-center justify-center rounded-full hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </span>
              )
            })}
          </div>

          {/* 소분류: 3열 격자 */}
          <div role="tabpanel" aria-label={`${activeTab} 소분류`} className="grid grid-cols-3">
            {minors.map((name) => {
              const isSelected =
                activeTab === major &&
                (name === CUSTOM_MINOR ? isCustom : !isCustom && name === minor)
              const isProtected = name === CUSTOM_MINOR
              return (
                <div
                  key={name}
                  className="relative border-r border-b [&:nth-child(3n)]:border-r-0"
                >
                  <button
                    type="button"
                    onClick={() => (isEditing ? undefined : pick(name))}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex h-14 w-full items-center justify-center px-2 text-center text-sm break-keep wrap-anywhere",
                      isSelected ? "font-semibold text-red-400" : "text-foreground",
                      isEditing && "cursor-default"
                    )}
                  >
                    {name === CUSTOM_MINOR ? "기타(직접 입력)" : name}
                  </button>
                  {isEditing && !isProtected ? (
                    <button
                      type="button"
                      aria-label={`${name} 삭제`}
                      onClick={() => onRemove({ major: activeTab, minor: name })}
                      className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>

          {isEditing ? (
            <div className="flex flex-col gap-3 p-4">
              {activeTab ? (
                <CategoryAdder
                  label={`${activeTab}에 소분류 추가`}
                  placeholder="새 소분류 이름"
                  onAdd={async (name) => {
                    const error = await onAddMinor(activeTab, name)
                    return error
                  }}
                />
              ) : null}
              <CategoryAdder
                label="대분류 추가"
                placeholder="새 대분류 이름"
                onAdd={async (name) => {
                  const error = await onAddMajor(name)
                  if (!error) setTab(normalizeCategoryName(name))
                  return error
                }}
              />
            </div>
          ) : (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              {editable
                ? "연필을 누르면 분류를 추가하거나 지울 수 있어요."
                : "소분류를 누르면 정해져요."}
            </p>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

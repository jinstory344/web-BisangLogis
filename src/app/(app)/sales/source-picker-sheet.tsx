"use client"

import { ChevronRight, Pencil, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  getMajors,
  getMinorsOf,
  normalizeCategoryName,
  type DeleteCategoryInput,
} from "@/lib/constants/expense-categories"
import { formatSaleSource, type SaleSourceTree } from "@/lib/constants/sale-sources"
import { SOURCE_MAJOR_CLIENT } from "@/lib/constants/source"
import { cn } from "@/lib/utils"

import { CategoryAdder } from "../expenses/category-adder"
import { CategoryRenamer } from "../expenses/category-renamer"

import {
  addSaleSourceAction,
  deleteSaleSourceAction,
  renameSaleSourceAction,
} from "./source-actions"

/** 이름을 바꾸는 중인 출처 (minor가 없으면 대분류) */
type RenameTarget = { major: string; minor?: string }

interface SourcePickerSheetProps {
  /** 서버에서 읽은 출처 목록 (추가·삭제하면 이 화면 안에서 새 목록으로 바뀐다) */
  initialTree: SaleSourceTree
  /** 출처를 직접 추가·삭제할 수 있는지 (출처 테이블을 읽었을 때만) */
  editable: boolean
  major: string
  sub: string
  /** 고르면 판이 닫힌다. 출처를 지우면 ("", "") */
  onPick: (major: string, sub: string) => void
}

/**
 * 매출 "출처" 한 줄과, 누르면 아래에서 올라오는 출처 선택판 (지출 분류와 같은 방식).
 * 위쪽 대분류 칩을 고르고, 하위분류(예: 카카오톡 › 스마일)가 있으면 아래 3열 칸에서 고른다.
 * 하위분류가 없는 대분류나 "거래처"는 칩을 누르면 바로 정해진다(거래처는 아래 거래처 줄에서 고른다).
 * 연필을 누르면 편집: 칸마다 ✕(삭제, "거래처" 제외)와 대분류·하위분류 추가가 나오고,
 * 하위분류 칸이나 고른 대분류 칩을 한 번 더 누르면 이름을 바꿀 수 있다("거래처" 제외).
 */
export function SourcePickerSheet({
  initialTree,
  editable,
  major,
  sub,
  onPick,
}: SourcePickerSheetProps) {
  const [tree, setTree] = useState(initialTree)
  const [open, setOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const majors = getMajors(tree)
  const [tab, setTab] = useState(major || majors[0] || "")
  const activeTab = majors.includes(tab) ? tab : (majors[0] ?? "")
  const subs = getMinorsOf(tree, activeTab)
  const [pendingDelete, setPendingDelete] = useState<DeleteCategoryInput | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [renaming, setRenaming] = useState<RenameTarget | null>(null)

  const summary = formatSaleSource(major, sub)

  function openSheet() {
    setTab(major && majors.includes(major) ? major : (majors[0] ?? ""))
    setIsEditing(false)
    setRenaming(null)
    setOpen(true)
  }

  function pick(nextMajor: string, nextSub: string) {
    onPick(nextMajor, nextSub)
    setOpen(false)
  }

  function onMajorChip(name: string) {
    if (isEditing) {
      // 편집 중에 이미 고른 대분류를 한 번 더 누르면 이름 바꾸기 ("거래처"는 못 바꾼다)
      if (name === activeTab && name !== SOURCE_MAJOR_CLIENT) setRenaming({ major: name })
      else {
        setTab(name)
        setRenaming(null)
      }
      return
    }
    setTab(name)
    // 하위분류가 없는 대분류(거래처 포함)는 누르면 바로 정한다
    if (name === SOURCE_MAJOR_CLIENT || getMinorsOf(tree, name).length === 0) {
      pick(name, "")
    }
  }

  async function addMajor(name: string): Promise<string | null> {
    const result = await addSaleSourceAction({ kind: "major", name })
    if (!result.ok) return result.error
    setTree(result.tree)
    setTab(normalizeCategoryName(name))
    return null
  }

  async function addSub(name: string): Promise<string | null> {
    const result = await addSaleSourceAction({ kind: "minor", major: activeTab, name })
    if (!result.ok) return result.error
    setTree(result.tree)
    return null
  }

  async function rename(target: RenameTarget, name: string): Promise<string | null> {
    const result = await renameSaleSourceAction({ ...target, name })
    if (!result.ok) return result.error
    setTree(result.tree)
    const newName = normalizeCategoryName(name)
    if (target.minor === undefined) setTab(newName)
    setRenaming(null)
    // 지금 고른 출처의 이름을 바꿨다면 폼 값도 새 이름으로 (판은 닫지 않는다)
    if (major === target.major) {
      if (target.minor === undefined) onPick(newName, sub)
      else if (sub === target.minor) onPick(major, newName)
    }
    toast.success("출처 이름을 바꿨습니다")
    return null
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete
    setIsDeleting(true)
    try {
      const result = await deleteSaleSourceAction(target)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setTree(result.tree)
      toast.success("출처를 삭제했습니다")
    } catch {
      toast.error("출처를 삭제하지 못했어요. 잠시 뒤 다시 시도하세요")
    } finally {
      setIsDeleting(false)
      setPendingDelete(null)
    }
  }

  const isClientTab = activeTab === SOURCE_MAJOR_CLIENT

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-haspopup="dialog"
        aria-label={`출처, 현재 ${summary || "없음"}`}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 border-b border-border text-left text-base",
          summary ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="truncate">{summary || "출처 선택"}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[80svh] gap-0 overflow-y-auto p-0 pb-4"
        >
          <div className="flex items-center justify-between bg-muted px-4 py-1.5">
            <SheetTitle className="text-base font-medium">출처</SheetTitle>
            <SheetDescription className="sr-only">
              대분류를 고르고, 하위분류가 있으면 하위분류를 누르면 정해져요.
            </SheetDescription>
            <div className="flex items-center gap-1">
              {editable ? (
                <button
                  type="button"
                  aria-pressed={isEditing}
                  aria-label={isEditing ? "편집 끝내기" : "출처 편집"}
                  onClick={() => {
                    setIsEditing((value) => !value)
                    setRenaming(null)
                  }}
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
                className="-mr-2 flex size-10 items-center justify-center rounded-full text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* 대분류: 가로로 밀어 보는 칩 */}
          <div
            role="tablist"
            aria-label="출처 대분류"
            className="no-scrollbar flex gap-2 overflow-x-auto border-b px-4 py-3"
          >
            {majors.map((name) => {
              const isActive = name === activeTab
              const isChosen = name === major
              return (
                <span
                  key={name}
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full border text-sm font-medium",
                    isActive || isChosen
                      ? "border-red-400 text-red-400"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onMajorChip(name)}
                    className={cn(
                      "min-h-10 pl-4",
                      isEditing && name !== SOURCE_MAJOR_CLIENT ? "pr-1" : "pr-4"
                    )}
                  >
                    {name}
                  </button>
                  {isEditing && name !== SOURCE_MAJOR_CLIENT ? (
                    <button
                      type="button"
                      aria-label={`${name} 삭제`}
                      onClick={() => setPendingDelete({ major: name })}
                      className="mr-1 flex size-8 items-center justify-center rounded-full hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </span>
              )
            })}
          </div>

          {/* 하위분류: 3열 칸. 맨 앞 칸은 "하위분류 없이 대분류만" */}
          {!isClientTab && (subs.length > 0 || isEditing) ? (
            <div
              role="tabpanel"
              aria-label={`${activeTab} 하위분류`}
              className="grid grid-cols-3"
            >
              <div className="border-r border-b [&:nth-child(3n)]:border-r-0">
                <button
                  type="button"
                  onClick={() => (isEditing ? undefined : pick(activeTab, ""))}
                  aria-pressed={activeTab === major && sub === ""}
                  className={cn(
                    "flex h-14 w-full items-center justify-center px-2 text-center text-sm break-keep",
                    activeTab === major && sub === ""
                      ? "font-semibold text-red-400"
                      : "text-muted-foreground",
                    isEditing && "cursor-default"
                  )}
                >
                  {activeTab}만
                </button>
              </div>
              {subs.map((name) => {
                const isSelected = activeTab === major && name === sub
                return (
                  <div
                    key={name}
                    className="relative border-r border-b [&:nth-child(3n)]:border-r-0"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        isEditing
                          ? setRenaming({ major: activeTab, minor: name })
                          : pick(activeTab, name)
                      }
                      aria-pressed={isSelected}
                      className={cn(
                        "flex h-14 w-full items-center justify-center px-2 text-center text-sm break-keep",
                        isSelected ? "font-semibold text-red-400" : "text-foreground",
                        isEditing &&
                          renaming?.major === activeTab &&
                          renaming.minor === name &&
                          "bg-muted"
                      )}
                    >
                      {name}
                    </button>
                    {isEditing ? (
                      <button
                        type="button"
                        aria-label={`${name} 삭제`}
                        onClick={() => setPendingDelete({ major: activeTab, minor: name })}
                        className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          {isEditing && renaming ? (
            <div className="p-4">
              <CategoryRenamer
                key={`${renaming.major}/${renaming.minor ?? ""}`}
                current={renaming.minor ?? renaming.major}
                label={`'${renaming.minor ?? renaming.major}' ${renaming.minor ? "하위분류" : "출처"} 이름 바꾸기`}
                note="이미 등록한 매출의 출처 이름도 함께 바뀌어요."
                onCancel={() => setRenaming(null)}
                onSave={(name) => rename(renaming, name)}
              />
            </div>
          ) : isEditing ? (
            <div className="flex flex-col gap-3 p-4">
              <p className="text-xs text-muted-foreground">
                이름을 누르면 바꿀 수 있어요. 대분류는 고른 칩을 한 번 더 누르세요.
              </p>
              {activeTab && !isClientTab ? (
                <CategoryAdder
                  label={`${activeTab}에 하위분류 추가`}
                  placeholder="예: 스마일"
                  onAdd={addSub}
                />
              ) : null}
              <CategoryAdder label="대분류 추가" placeholder="새 출처 이름" onAdd={addMajor} />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {editable
                  ? "연필을 누르면 출처를 추가하거나 지우고, 이름을 바꿀 수 있어요."
                  : "출처를 누르면 정해져요."}
              </p>
              {major ? (
                <button
                  type="button"
                  onClick={() => pick("", "")}
                  className="shrink-0 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  출처 지우기
                </button>
              ) : null}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && !isDeleting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.minor !== undefined
                ? `하위분류 '${pendingDelete.minor}'을(를) 삭제할까요?`
                : `출처 '${pendingDelete?.major ?? ""}'을(를) 삭제할까요?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.minor === undefined
                ? `아래 하위분류 ${getMinorsOf(tree, pendingDelete.major).length}개도 함께 목록에서 사라집니다. `
                : ""}
              이미 등록한 매출의 출처는 그대로 남아요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>아니요</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                // 삭제가 끝난 뒤에 창을 닫도록 기본 닫힘을 막는다.
                event.preventDefault()
                void confirmDelete()
              }}
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

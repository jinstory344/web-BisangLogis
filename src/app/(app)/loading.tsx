import { Skeleton } from "@/components/ui/skeleton"

/**
 * 화면을 옮길 때 서버가 데이터를 읽는 동안 바로 보여 주는 뼈대.
 * 이게 없으면 누른 뒤 새 화면이 다 만들어질 때까지 이전 화면이 멈춘 것처럼 보인다.
 */
export default function Loading() {
  return (
    <div className="p-4 md:p-6" aria-busy="true" aria-label="불러오는 중">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  )
}

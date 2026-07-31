"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
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
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { VehicleRow } from "@/lib/supabase/database.types"

import { deleteVehicleAction, getVehicleDispatchCount } from "./actions"

export function VehicleList({ vehicles }: { vehicles: VehicleRow[] }) {
  const [target, setTarget] = useState<{
    vehicle: VehicleRow
    dispatchCount: number
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleDeleteClick(vehicle: VehicleRow) {
    const count = await getVehicleDispatchCount(vehicle.id)
    setTarget({ vehicle, dispatchCount: count })
  }

  function handleConfirmDelete() {
    if (!target) return
    const { vehicle } = target
    startTransition(async () => {
      try {
        await deleteVehicleAction(vehicle.id)
        toast.success(`"${vehicle.plate_no}" 차량을 삭제했습니다`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "삭제 실패")
      } finally {
        setTarget(null)
      }
    })
  }

  if (vehicles.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        등록된 차량이 없습니다.
      </p>
    )
  }

  return (
    <>
      {/* 데스크톱 표 */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>차량번호</TableHead>
              <TableHead>기사명</TableHead>
              <TableHead>연락처</TableHead>
              <TableHead>운수사</TableHead>
              <TableHead>차종</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((vehicle) => (
              <TableRow key={vehicle.id}>
                <TableCell className="font-medium">
                  {vehicle.plate_no}
                </TableCell>
                <TableCell>{vehicle.driver_name}</TableCell>
                <TableCell>{vehicle.driver_phone ?? "-"}</TableCell>
                <TableCell>{vehicle.carrier_name ?? "-"}</TableCell>
                <TableCell>{vehicle.vehicle_type ?? "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/vehicles/${vehicle.id}/edit`}>수정</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(vehicle)}
                    >
                      삭제
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="flex flex-col gap-2 md:hidden">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{vehicle.plate_no}</p>
                <p className="text-sm text-muted-foreground">
                  {vehicle.driver_name} · {vehicle.driver_phone ?? "-"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/vehicles/${vehicle.id}/edit`}>수정</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteClick(vehicle)}
                >
                  삭제
                </Button>
              </div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {vehicle.carrier_name ?? "-"} · {vehicle.vehicle_type ?? "-"}
            </div>
          </div>
        ))}
      </div>

      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              &quot;{target?.vehicle.plate_no}&quot; 차량을 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target && target.dispatchCount > 0
                ? `이 차량과 연결된 배차 이력이 ${target.dispatchCount}건 있습니다. 삭제해도 이력은 유지되며, 휴지통에서 30일 내 복구할 수 있습니다.`
                : "휴지통으로 이동하며, 30일 내 복구할 수 있습니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isPending}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

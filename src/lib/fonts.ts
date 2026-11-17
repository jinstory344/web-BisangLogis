import { Chakra_Petch } from "next/font/google"

/** HOME 시계 글꼴 (디지털 느낌, 숫자·영문만 쓰므로 latin만). 앱에 내장되어 바로 그 모양으로 뜬다. */
export const clockFont = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
})

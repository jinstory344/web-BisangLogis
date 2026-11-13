import type { MetadataRoute } from "next"

/** 홈 화면에 추가했을 때의 이름·아이콘 (아이폰은 apple-icon.png를 쓴다) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "비상로지스",
    short_name: "비상",
    start_url: "/",
    display: "standalone",
    background_color: "#26272c",
    theme_color: "#26272c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}

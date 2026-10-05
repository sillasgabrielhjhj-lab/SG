import { ImageResponse } from "next/og";
import { MercattoMark } from "@/components/brand/icon-art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<MercattoMark size={180} padding={18} />, size);
}

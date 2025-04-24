import { exec } from "child_process"

export function clearScreen() {
  const os = process.platform

  if (os === "win32") {
    exec("cls")
  } else {
    exec("clear")
  }
}

export function truncate(str: string, { length }: { length: number }): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}
/**
 * 同一份邏輯文件的版本輔助。
 *
 * 文件以 `docGroup` 分組、`version` 遞增；舊資料沒有 docGroup 時每個檔案各自獨立，
 * 自然也就沒有前一版可比。
 */

interface VersionedDoc {
  id: string
  docGroup?: string | null
  version?: number
  fileName: string
  fileUrl: string | null
}

/**
 * 找出某份文件的前一個版本（version - 1）。
 *
 * 供預覽時做「本版改了哪裡」的比對；找不到就回傳 null，畫面上不會出現標註開關。
 */
export function findPrevVersion<T extends VersionedDoc>(docs: T[], doc: T | null): T | null {
  if (!doc?.docGroup || !doc.version || doc.version <= 1) return null
  return (
    docs.find((d) => d.docGroup === doc.docGroup && (d.version ?? 1) === doc.version! - 1) ?? null
  )
}

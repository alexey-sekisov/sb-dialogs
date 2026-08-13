export function filenameFromDisposition(disposition: string | null): string | undefined {
  if (!disposition) return undefined
  const utf8 = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ''))
    } catch {
      return utf8[1].trim().replace(/^"|"$/g, '')
    }
  }
  const regular = disposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i)
  return (regular?.[1] || regular?.[2])?.trim()
}

export function saveBlob(blob: Blob, filename = 'download'): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.hidden = true
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

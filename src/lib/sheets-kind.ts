// Quick filename hints used before the sorter has read the file.
export function looksLikeSolution(filename: string) {
  return /(?<![A-Za-z])(solutions?|answers?|model[\s_-]?answers?|worked)(?![A-Za-z])/i.test(filename)
}
export function looksLikeTemplate(filename: string) {
  return /(?<![A-Za-z])(template|submission|answer[\s_-]?sheet)(?![A-Za-z])/i.test(filename)
}

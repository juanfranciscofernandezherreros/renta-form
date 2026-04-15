/**
 * Translates a yes/no ('si'/'no') response value using the t() function.
 * Falls back to the raw value if it's neither.
 *
 * @param {string} value - The raw response value ('si', 'no', or other)
 * @param {Function} t - Translation function from useLanguage()
 * @returns {string}
 */
export function translateYN(value, t) {
  if (value === 'si') return t('yes')
  if (value === 'no') return t('no')
  return value
}

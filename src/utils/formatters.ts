export function formatNumber(value: number): string {
    return value.toFixed(2)
}

export function parseNumber(value: string): number {
    const parsed = parseFloat(value.replace(',', '.'))
    return isNaN(parsed) ? 0 : parsed
}

export function formatWithSpaces(value: string): string {
    if (!value || value === '') return ''

    // Split by decimal point
    const parts = value.split('.')
    const integerPart = parts[0]
    const decimalPart = parts[1]

    // Add spaces for thousands
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

    // Combine back
    return decimalPart !== undefined
        ? `${formattedInteger}.${decimalPart}`
        : formattedInteger
}

export function removeSpaces(value: string): string {
    return value.replace(/\s/g, '')
}

export function validateInput(value: string): string {
    // Replace comma with dot
    let cleaned = value.replace(',', '.')

    // Remove all non-numeric characters except decimal point
    cleaned = cleaned.replace(/[^\d.]/g, '')

    // Ensure only one decimal point
    const parts = cleaned.split('.')
    if (parts.length > 2) {
        cleaned = parts[0] + '.' + parts.slice(1).join('')
    }

    // Limit to 1 trillion
    const num = parseFloat(cleaned)
    if (num > 1000000000000) {
        return '1000000000000'
    }

    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) {
        cleaned = parts[0] + '.' + parts[1].substring(0, 2)
    }

    return cleaned
}

export function formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(date)
}
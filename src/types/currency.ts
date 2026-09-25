export type CurrencyCode = 'USD' | 'RUB' | 'VND' | 'THB' | 'KRW'

export interface Currency {
  code: CurrencyCode
  name: string
  flag: string
}

export interface CurrencyRates {
  USD: number
  RUB: number
  VND: number
  THB: number
  KRW: number
}

export interface CurrencyValues {
  USD: string
  RUB: string
  VND: string
  THB: string
  KRW: string
}

export interface ExchangeRateResponse {
  rates: {
    RUB: number
    VND: number
    THB: number
    KRW: number
  }
  base: string
  date: string
}

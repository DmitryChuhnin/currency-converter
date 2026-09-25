import axios from 'axios'
import type { CurrencyRates, ExchangeRateResponse } from '@/types/currency'

// Using exchangerate-api.com free tier
const API_BASE_URL = 'https://api.exchangerate-api.com/v4/latest'

export class CurrencyService {
  static async fetchRates(): Promise<CurrencyRates> {
    try {
      const response = await axios.get<ExchangeRateResponse>(`${API_BASE_URL}/USD`)
      
      return {
        USD: 1,
        RUB: response.data.rates.RUB,
        VND: response.data.rates.VND,
        THB: response.data.rates.THB,
        KRW: response.data.rates.KRW
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
      // Fallback rates if API fails
      return {
        USD: 0,
        RUB: 0,
        VND: 0,
        THB: 0,
        KRW: 0
      }
    }
  }
}

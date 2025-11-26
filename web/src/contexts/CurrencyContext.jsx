import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrencyConfig } from '../services/api';

const CurrencyContext = createContext();

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(() => {
    // Load from localStorage or default to TWD
    return localStorage.getItem('preferred_currency') || 'TWD';
  });
  const [supportedCurrencies, setSupportedCurrencies] = useState(['TWD', 'HKD']);
  const [symbols, setSymbols] = useState({ TWD: 'NT$', HKD: 'HK$' });
  const [exchangeRates, setExchangeRates] = useState({ TWD_to_HKD: 0.2, HKD_to_TWD: 5 });
  const [stripeMinimum, setStripeMinimum] = useState({ TWD: 2000, HKD: 400 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrencyConfig();
  }, []);

  const loadCurrencyConfig = async () => {
    try {
      const response = await getCurrencyConfig();
      setSupportedCurrencies(response.data.supportedCurrencies);
      setSymbols(response.data.symbols);
      setExchangeRates(response.data.exchangeRates);
      setStripeMinimum(response.data.stripeMinimum);
      
      // If user hasn't set preference, use server default
      const savedCurrency = localStorage.getItem('preferred_currency');
      if (!savedCurrency) {
        setCurrency(response.data.defaultCurrency);
      }
    } catch (error) {
      console.error('Failed to load currency config:', error);
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const switchCurrency = (newCurrency) => {
    if (supportedCurrencies.includes(newCurrency)) {
      setCurrency(newCurrency);
      localStorage.setItem('preferred_currency', newCurrency);
    }
  };

  const formatPrice = (twdPrice) => {
    if (!twdPrice) return `${symbols[currency]}0`;
    const price = parseFloat(twdPrice);
    const symbol = symbols[currency];
    
    if (currency === 'HKD') {
      const hkdPrice = price * exchangeRates.TWD_to_HKD;
      return `${symbol}${hkdPrice.toFixed(2)}`;
    }
    return `${symbol}${Math.round(price)}`;
  };

  return (
    <CurrencyContext.Provider value={{ 
      currency, 
      symbol: symbols[currency],
      symbols,
      supportedCurrencies,
      exchangeRates,
      stripeMinimum,
      formatPrice,
      switchCurrency,
      loading 
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
}

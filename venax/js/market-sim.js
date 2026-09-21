/* ============================================================
   Venax — Motor de simulação de mercado (100% fictício)
   Gera séries de preços por passeio aleatório para fins
   exclusivamente demonstrativos/educacionais. Não representa
   dados de mercado reais.
   ============================================================ */

const VenaxSim = (() => {

  const SYMBOLS = [
    { id: 'EURUSD', name: 'EUR/USD', group: 'forex', base: 1.0842, vol: 0.00042, decimals: 4, flag: '🇪🇺🇺🇸' },
    { id: 'GBPJPY', name: 'GBP/JPY', group: 'forex', base: 207.62, vol: 0.045, decimals: 3, flag: '🇬🇧🇯🇵' },
    { id: 'USDJPY', name: 'USD/JPY', group: 'forex', base: 149.83, vol: 0.03, decimals: 3, flag: '🇺🇸🇯🇵' },
    { id: 'GBPUSD', name: 'GBP/USD', group: 'forex', base: 1.2634, vol: 0.0005, decimals: 4, flag: '🇬🇧🇺🇸' },
    { id: 'BTCUSD', name: 'BTC/USD', group: 'cripto', base: 68420, vol: 34, decimals: 0, flag: '₿' },
    { id: 'ETHUSD', name: 'ETH/USD', group: 'cripto', base: 3512, vol: 4.2, decimals: 1, flag: 'Ξ' },
    { id: 'US100', name: 'US Tech 100', group: 'indices', base: 19842, vol: 6.5, decimals: 1, flag: '📈' },
    { id: 'XAUUSD', name: 'Ouro (XAU/USD)', group: 'commodities', base: 2381.4, vol: 1.1, decimals: 1, flag: '🥇' },
  ];

  function rand(min, max){ return Math.random() * (max - min) + min; }
  function gauss(){
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function nextPrice(price, vol, drift = 0){
    const change = gauss() * vol + drift;
    return Math.max(price + change, vol);
  }

  function genCandles(symbol, count, stepSeconds){
    const candles = [];
    let last = symbol.base;
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - count * stepSeconds;
    for (let i = 0; i < count; i++){
      const open = last;
      const ticks = 6;
      let path = [open];
      for (let t = 0; t < ticks; t++){
        last = nextPrice(last, symbol.vol);
        path.push(last);
      }
      const close = last;
      const high = Math.max(...path);
      const low = Math.min(...path);
      candles.push({
        time: startTime + i * stepSeconds,
        open, high, low, close,
      });
    }
    return candles;
  }

  function round(v, decimals){
    return Number(v.toFixed(decimals));
  }

  function formatPrice(v, decimals){
    return v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  return { SYMBOLS, rand, gauss, nextPrice, genCandles, round, formatPrice };
})();

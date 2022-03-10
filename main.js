
const fromInput = document.getElementById('from');

const toInput = document.getElementById('to');
const ammountInput = document.getElementById('amm');
const resP = document.getElementById('text');


const firstUrl = 'http://www.apilayer.net/api/live?access_key=bd9c9af7fa15f566c5e8648e2afa87d6';
const secondUrl = 'https://restcountries.com/v3.1/currency/';

const getExchangeRate = async (fromCurrency, toCurrency) => {
  try {
    let resp = await fetch(firstUrl);
    let data = await resp.json();
    let rater = function(response) {
      const rate = response.quotes;
      const baseCurrency = response.source;
      const usd = 1 / rate[`${baseCurrency}${fromCurrency}`];
      const exchangeRate = usd * rate[`${baseCurrency}${toCurrency}`];
      return exchangeRate;
    }
    return await rater(data);
    
  } catch (error) {
    throw new Error(`Unable to get currency ${fromCurrency} and ${toCurrency}`);
  }
};

const getCountries = async (currencyCode) => {
  try {
    let resp = await fetch(secondUrl+currencyCode);
    let data = await resp.json();
    return await data.map(d => d.name.official);
    
  } catch (error) {
    throw new Error(`Unable to get countries that use ${currencyCode}`);
  }
};

const convertCurrency = async (fromCurrency, toCurrency, amount) => {
  let exchangeRate = await getExchangeRate(fromCurrency, toCurrency);
  let countries = await getCountries(toCurrency);
  let convertedAmount = (amount * exchangeRate).toFixed(2);

  return `${amount} ${fromCurrency} is worth ${convertedAmount} ${toCurrency}.\n You can spend these in the following countries: ${countries}`;
};


fromInput.oninput= function(){
  convertCurrency(fromInput.value, toInput.value, ammountInput.value)
  .then((message) => {
    resP.innerHTML = message;
    console.log(message);
  }).catch((error) => {
    console.log(error.message);
  });
}
  
toInput.oninput= function(){
  convertCurrency(fromInput.value, toInput.value, ammountInput.value)
  .then((message) => {
    resP.innerHTML = message;
    console.log(message);
  }).catch((error) => {
    console.log(error.message);
  });
}
  
ammountInput.oninput= function(){
  convertCurrency(fromInput.value, toInput.value, ammountInput.value)
  .then((message) => {
    resP.innerHTML = message;
    console.log(message);
  }).catch((error) => {
    console.log(error.message);
  });
}
  

  
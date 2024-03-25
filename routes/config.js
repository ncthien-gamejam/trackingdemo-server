import express from 'express';
import fetch from 'node-fetch';
import md5 from 'md5';
import * as fs from 'fs';

const router = express.Router();

const currencyCodes = [
"AED","AOA","ARS","AUD","BDT",
"BHD","BRL","BYN","CAD","CHF",
"CLP","COP","CRC","CZK","DKK",
"DOP","DZD","EGP","ETB","EUR",
"GBP","GEL","GHS","GTQ","HKD",
"HUF","IDR","ILS","INR","JOD",
"JPY","KES","KHR","KRW","KWD",
"KZT","LBP","LKR","MAD","MGA",
"MMK","MUR","MXN","MYR","MZN",
"NGN","NIO","NOK","NPR","NZD",
"OMR","PAB","PEN","PHP","PKR",
"PLN","PYG","RON","RUB","SAR",
"SEK","SGD","SLL","THB","TND",
"TRY","TWD","TZS","UAH","UGX",
"USD","UYU","UZS","VEF","VND",
"XAF","XOF","ZAR","ZMW"];

const cryptoCurrencyCodes = [
"BTC","ETH","USDT","BNB","SOL",
"XRP","USDC","DOGE","ADA","AVAX",
"TON","SHIB","DOT","LINK","TRX",
"MATIC","BCH","ICP","NEAR","UNI",
"LTC","APT","LEO","DAI","STX",
"FIL","ETC","ATOM","ARB","IMX",
"RON"
];

const configVersion = 1;

const baseCurrency = 'USD';

const openExchangeRatesAPIEndpoint = 'https://openexchangerates.org/api/latest.json';
const openExchangeRatesAPIKey = '881b31aa4c8747d8a6fa2efb5a5c956b';

const coinAPIBaseEndpoint = 'https://rest.coinapi.io/v1/exchangerate/';
const coinAPIKey = '6C4A71C7-12D1-4D65-9493-EE06505079E4';

const exchangeRatePeriod = 3 * 60 * 60; //3 hours
const cryptoExchangeRatePeriod = 6 * 60 * 60; //6 hours

const skanSchema = JSON.parse(fs.readFileSync('./config/skan_v4_test.json'));
const sdkConfig = JSON.parse(fs.readFileSync('./config/test.json'));

router.get('/', async function(req, res, next) {
  try {
	let lastExchangeRateTimestamp = 0;
	let lastCryptoExchangeRateTimestamp = 0;
	
    let lastSchemaHash = '';
	let lastSdkConfigHash = '';
	
	let lastCurrency = 'USD';
	
	let platform = '';
    
    let query = req.query;
    
	if (query)
	{
		console.log('QUERY = ' + JSON.stringify(query));
		
		if ('platform' in query)
		{
			platform = query['platform'].toLowerCase();
		}
		
		if ('currency' in query)
		{
			lastCurrency = query['currency'];
		}

		if ('exchange_rate_timestamp' in query)
		{
			lastExchangeRateTimestamp = query['exchange_rate_timestamp'];
		}
		
		if ('crypto_exchange_rate_timestamp' in query)
		{
			lastCryptoExchangeRateTimestamp = query['crypto_exchange_rate_timestamp'];
		}

		if ('schema_hash' in query)
		{
			lastSchemaHash = query['schema_hash'].toLowerCase();
		}

		if ('sdk_config_hash' in query)
		{
			lastSdkConfigHash = query['sdk_config_hash'].toLowerCase();
		}
	}
	
	if (baseCurrency !== lastCurrency)
	{
		lastExchangeRateTimestamp = 0;
		lastCryptoExchangeRateTimestamp = 0;
	
		lastSchemaHash = '';
		lastSdkConfigHash = '';
	}

    //console.log('Last Exchange Rate Timestamp = ' + lastExchangeRateTimestamp.toString());
	//console.log('Last Crypto Exchange Rate Timestamp = ' + lastCryptoExchangeRateTimestamp.toString());
    //console.log('Last Schema Hash = ' + lastSchemaHash);
	//console.log('Last Config Hash = ' + lastConfigHash);
	
	//console.log('SDK CONFIG = ' + JSON.stringify(sdkConfig));
    
    let currentTime = Math.floor(Date.now()/1000);

    
    let ret = {}
    
    ret['version'] = configVersion;
	
	ret['currency'] = baseCurrency;
	
	if (platform === 'ios')
    {
		let offsetTime = currentTime - lastExchangeRateTimestamp;
		if (offsetTime >= exchangeRatePeriod)
		{      
			const response = await fetch(openExchangeRatesAPIEndpoint + '?' + new URLSearchParams({
				app_id: openExchangeRatesAPIKey,
				base: baseCurrency,
				symbols: currencyCodes.join(','),
				prettyprint: false,
				show_alternative: false
			}));

			let openExchangeData = await response.json();

			//console.log(JSON.stringify(openExchangeData));
			 
			ret['exchange_rate_timestamp'] = openExchangeData['timestamp'];
			ret['exchange_rates'] = openExchangeData['rates'];
		}

		offsetTime = currentTime - lastCryptoExchangeRateTimestamp;
		if (offsetTime >= cryptoExchangeRatePeriod)
		{
			const response = await fetch(coinAPIBaseEndpoint + baseCurrency + '?' + new URLSearchParams({
				apikey: coinAPIKey,
				filter_asset_id: cryptoCurrencyCodes.join(','),
				invert: true
			}));
			
			let cryptoExchangeData = {};
			let cryptoExchangeTimestamp = 0;

			let coinAPIData = await response.json();
			let coinAPIRates = coinAPIData['rates'];

			for (const coinAPIRate of coinAPIRates)
			{ 
				cryptoExchangeData[coinAPIRate['asset_id_quote']] = coinAPIRate['rate'];
				
				let currentTimestamp =  Date.parse(coinAPIRate['time']) / 1000;
				if (currentTimestamp > cryptoExchangeTimestamp) cryptoExchangeTimestamp = currentTimestamp;
			}	
			
			ret['crypto_exchange_rate_timestamp'] = cryptoExchangeTimestamp;
			ret['crypto_exchange_rates'] = cryptoExchangeData;
		}
		
		let schemaHash = md5(JSON.stringify(skanSchema)).toLowerCase();

		if (schemaHash !== lastSchemaHash)
		{
			ret['schema'] = skanSchema;
			ret['schema_hash'] = schemaHash;
		}
	}
	
	let sdkConfigHash = md5(JSON.stringify(sdkConfig)).toLowerCase();
	
	if (sdkConfigHash !== lastSdkConfigHash)
	{
		ret['sdk_config'] = sdkConfig;
		ret['sdk_config_hash'] = sdkConfigHash;
	}
    
    res.json(ret);
  } catch (err) {
    console.error(`Error while getting config `, err.message);
    next(err);
  }
});

export { router }
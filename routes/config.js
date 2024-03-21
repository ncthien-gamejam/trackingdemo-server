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

const configVersion = 1;

const openExchangeRatesAPIEndpoint = 'https://openexchangerates.org/api/latest.json';
const openExchangeRatesAPIKey = '881b31aa4c8747d8a6fa2efb5a5c956b';

const exchangeRatePeriod = 3 * 60 * 60; //3 hours

const skanSchema = JSON.parse(fs.readFileSync('./config/skan_v4_test.json'));
const sdkConfig = JSON.parse(fs.readFileSync('./config/test.json'));

router.get('/', async function(req, res, next) {
  try {
	let lastExchangeRateTimestamp = 0;
    let lastSchemaHash = '';
	let lastSdkConfigHash = '';
	
	let platform = '';
    
    let query = req.query;
    
	if (query)
	{
		console.log('QUERY = ' + JSON.stringify(query));
		
		if ('platform' in query)
		{
			platform = query['platform'].toLowerCase();
		}

		if ('exchange_rate_timestamp' in query)
		{
			lastExchangeRateTimestamp = query['exchange_rate_timestamp'];
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

    //console.log('Last Exchange Rate Timestamp = ' + lastExchangeRateTimestamp.toString());
    //console.log('Last Schema Hash = ' + lastSchemaHash);
	//console.log('Last Config Hash = ' + lastConfigHash);
	
	//console.log('SDK CONFIG = ' + JSON.stringify(sdkConfig));
    
    let currentTime = Math.floor(Date.now()/1000);

    let offsetTime = currentTime - lastExchangeRateTimestamp;
    
    let ret = {}
    
    ret['version'] = configVersion;
	
	if (platform === 'ios')
    {
		if (offsetTime >= exchangeRatePeriod)
		{      
		  const response = await fetch(openExchangeRatesAPIEndpoint + '?' + new URLSearchParams({
			app_id: openExchangeRatesAPIKey,
			base: 'USD',
			symbols: currencyCodes.join(','),
			prettyprint: false,
			show_alternative: false
		  }));
		  
		  let openExchangeData = await response.json();
		  
		  //console.log(JSON.stringify(openExchangeData));
			 
		  ret['exchange_rate_timestamp'] = openExchangeData['timestamp'];
		  ret['exchange_rates'] = openExchangeData['rates'];
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
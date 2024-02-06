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

const sdkConfig = JSON.parse(fs.readFileSync('./config/test.json'));

router.get('/', async function(req, res, next) {
  try {
	let lastExchangeRateTimestamp = 0;
    let lastSchemaHash = '';
	let lastSdkConfigHash = '';
    
    let query = req.query;
    
	if (query)
	{
		console.log('QUERY = ' + JSON.stringify(query));

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
    
    let fineMappings = [];
    for (let i = 0; i < 64; i++)
    {
      let minRevenue = i == 0 ? -1 : i * 0.1;
      let maxRevenue = i == 63 ? -1 : (i + 1) * 0.1;
      
      fineMappings.push({
        fine_cv: i,
        value_mappings: [{
          mapping_type: 'revenue',
          min_revenue: (minRevenue >= 0 ? minRevenue : undefined),
          max_revenue: (maxRevenue >= 0 ? maxRevenue : undefined)
        }]
      });
    }
    
    let coarseMappings1 = [
    {
      coarse_cv: 'low',
      value_mappings: [{
        mapping_type: 'fine_cv',
        min_fine_cv: 0,
        max_fine_cv: 9,
      }]
    },
    {
      coarse_cv: 'medium',
      value_mappings: [{
        mapping_type: 'fine_cv',
        min_fine_cv: 10,
        max_fine_cv: 49,
      }]
    },
    {
      coarse_cv: 'high',
      value_mappings: [{
        mapping_type: 'fine_cv',
        min_fine_cv: 50,
        max_fine_cv: 63,
      }]
    }];
    
    let coarseMappings2 = [
    {
      coarse_cv: 'low',
      value_mappings: [{
        mapping_type: 'fine_cv',
        min_fine_cv: 0,
        max_fine_cv: 19,
      }]
    },
    {
      coarse_cv: 'medium',
      value_mappings: [{
        mapping_type: 'fine_cv',
        min_fine_cv: 20,
        max_fine_cv: 49,
      }]
    },
    {
      coarse_cv: 'high',
      value_mappings: [{
        mapping_type: 'fine_cv',
        min_fine_cv: 50,
        max_fine_cv: 63,
      }]
    }];
    
    let coarseMappings3 = [
    {
      coarse_cv: 'low',
      value_mappings: [{
        mapping_type: 'fine_cv',
        min_fine_cv: 0,
        max_fine_cv: 49,
      }]
    },
    {
      coarse_cv: 'medium',
      value_mappings: [{
        mapping_type: 'fine_cv',
        min_fine_cv: 50,
        max_fine_cv: 59,
      }]
    },
    {
      coarse_cv: 'high',
      value_mappings: [{
        mapping_type: 'fine_cv',
        min_fine_cv: 60
      }]
    }];
    
    let lockConditions1 = [
    {
      lock_condition_type: 'coarse_cv',
      coarse_cvs: ['high']
    },
    {
      lock_condition_type: 'time',
      post_install_time: 86400
    }];
    
    let lockConditions2 = [
    {
      lock_condition_type: 'coarse_cv',
      coarse_cvs: ['high']
    }];
    
    let lockConditions3 = [
    {
      lock_condition_type: 'coarse_cv',
      coarse_cvs: ['high']
    }];
    
    let window1 = {
      fine_cv_mappings: fineMappings,
      coarse_cv_mappings: coarseMappings1,
      lock_conditions: lockConditions1
    };
    
    let window2 = {
      coarse_cv_mappings: coarseMappings2,
      lock_conditions: lockConditions2
    };
    
    let window3 = {
      coarse_cv_mappings: coarseMappings3,
      lock_conditions: lockConditions3
    };
    
    let schema = {
      window_one: window1,
      window_two: window2,
      window_three: window3
    };
    
    let schemaHash = md5(JSON.stringify(schema)).toLowerCase();

    if (schemaHash !== lastSchemaHash)
    {
		ret['schema'] = schema;
		ret['schema_hash'] = schemaHash;
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
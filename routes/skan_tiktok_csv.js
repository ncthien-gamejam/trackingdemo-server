import express from 'express';
import fetch from 'node-fetch';
import * as fs from 'fs';

const MAX_REVENUE = 10000.0;

const router = express.Router();

const skanSchema = JSON.parse(fs.readFileSync('./config/skan_v4_test.json'));

const eventMapping = JSON.parse(fs.readFileSync('./config/event_mapping_tiktok.json'));
function getEventMapping(eventName)
{
	if (!eventName) return null;
	
	let ret = eventMapping[eventName];
	if (!ret) return null;
	
	return ret;
}

function createItem(value, valueMapping)
{
	let mappingType = valueMapping['mapping_type'];
	if (!mappingType) return null;
	
	let eventName = null;
	
	let revenueMin = null;
	let revenueMax = null;

	if (mappingType === 'revenue')
	{
		let revenueType = valueMapping['revenue_type'];
		if (!revenueType || (revenueType & 15) === 15) //All
		{
			eventName = getEventMapping('__revenue__');
		}
		else if ((revenueType & 1) === 1) //IAP
		{
			eventName = getEventMapping('__revenue_iap__');
		}
		else if ((revenueType & 2) === 2) //Ad
		{
			eventName = getEventMapping('__revenue_ad__');
		}
		else if ((revenueType & 4) === 4) //Event
		{
			eventName = getEventMapping('__revenue_event__');
		}
		else if ((revenueType & 8) === 8) //Crypto
		{
			eventName = getEventMapping('__revenue_crypto__');
		}
		
		if (!eventName) return null;
		
		revenueMin = valueMapping['min_revenue'];
		if (revenueMin === undefined) revenueMin = null;
		
		revenueMax = valueMapping['max_revenue'];
		if (revenueMax === undefined) revenueMax = null;
	}
	else if (mappingType === 'event')
	{
		eventName = getEventMapping(valueMapping['event_name']);
		if (!eventName) return null;

		revenueMin = valueMapping['min_revenue'];
		if (revenueMin === undefined) revenueMin = null;
		
		revenueMax = valueMapping['max_revenue'];
		if (revenueMax === undefined) revenueMax = null;
	}
	else if (mappingType === 'session')
	{
		eventName = getEventMapping('__session__');
		if (!eventName) return null;
	}
	else
	{
		return null;
	}
	
	let ret = {};
	ret['value'] = value;
	ret['eventName'] = eventName;
	ret['revenueMin'] = revenueMin ? Math.max(revenueMin, 0.0) : 0.0;
	ret['revenueMax'] = revenueMax ? revenueMax : MAX_REVENUE;
		
	return ret;
}

router.get('/', async function(req, res, next) {
  try {
  
	let items = [];

	let windowOne = skanSchema['window_one'];
	if (windowOne)
	{
		let mappings = windowOne['fine_cv_mappings'];
		if (mappings)
		{
			let num = mappings.length;
			for (let i = 0; i < num; ++i)
			{
				let mapping = mappings[i];
				
				let value = mapping['fine_cv'];
				if (value === undefined || value === null) continue;
				
				if (value === 0) continue;
				
				let valueMappings = mapping['value_mappings'];
				if (!valueMappings) return null;
				
				let numValueMappings = valueMappings.length;
				for (let j = 0; j < numValueMappings; ++j)
				{
					let item = createItem(value, valueMappings[j]);
					if (item)
					{
						items.push(item);
						break;
					}
				}
			}
		}
	}

	let csvData = ['Conversion Value(1-63)', 'Event Name', 'Revenue Minimum(USD)', 'Revenue Maximum(USD)'].join(",") + "\r\n";
	
	items.forEach((item) => {
		csvData += [item.value, item.eventName, item.revenueMin, item.revenueMax].join(",") + "\r\n"
	})

	res.set({
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="data.csv"`,
    }).send(csvData);
  } catch (err) {
    console.error(`Error while processing trigger request `, err.message);
    next(err);
  }
});

export { router }
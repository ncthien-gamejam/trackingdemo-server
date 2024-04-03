import express from 'express';
import fetch from 'node-fetch';
import * as fs from 'fs';

const MAX_REVENUE = 10000.0;

const AD_REVENUE_SOURCES = [];

const router = express.Router();

const skanSchema = JSON.parse(fs.readFileSync('./config/skan_v4_test.json'));

const eventMapping = JSON.parse(fs.readFileSync('./config/adjust_token_mapping.json'));
function getEventToken(eventName)
{
	if (!eventName) return null;
	
	let ret = eventMapping[eventName];
	if (!ret) return null;
	
	return ret;
}

function getFinalFieldName(fieldName, eventId)
{
	if (eventId >= 2) return fieldName + eventId.toString();
	else return fieldName;
}

function updateItem(item, eventId, valueMapping)
{
	let mappingType = valueMapping['mapping_type'];
	if (!mappingType) return null;
	
	let eventName = null;

	if (mappingType === 'revenue')
	{
		let revenueMin = valueMapping['min_revenue'];
		let revenueMax = valueMapping['max_revenue'];
		
		let revenueType = valueMapping['revenue_type'];
		
		if (!revenueType || (revenueType & 15) === 15) //All
		{
			if (revenueMin)
			{
				item['totalRevenueMin'] = revenueMin;
			}
			
			if (revenueMax)
			{
				item['totalRevenueMax'] = revenueMax;
			}
		}
		else if ((revenueType & 1) === 1) //IAP
		{
			if (revenueMin)
			{
				item['iapRevenueMin'] = revenueMin;
			}
			
			if (revenueMax)
			{
				item['iapRevenueMax'] = revenueMax;
			}
		}
		else if ((revenueType & 2) === 2) //Ad
		{
			if (revenueMin)
			{
				item['adRevenueMin'] = revenueMin;
			}
			
			if (revenueMax)
			{
				item['adRevenueMax'] = revenueMax;
			}
		}
	}
	else if (mappingType === 'event')
	{
		let token = getEventToken(valueMapping['event_name']);
		if (!token) return;
		
		item[getFinalFieldName('eventToken', eventId)] = token;

		let revenueMin = valueMapping['min_revenue'];
		if (revenueMin)
		{
			item[getFinalFieldName('eventRevenueMin', eventId)] = revenueMin;
		}
		
		let revenueMax = valueMapping['max_revenue'];
		if (revenueMax)
		{
			item[getFinalFieldName('eventRevenueMax', eventId)] = revenueMax;
		}
		
		let countMin = valueMapping['min_event_count'];
		if (countMin)
		{
			item[getFinalFieldName('eventCountMin', eventId)] = countMin;
		}
		
		let countMax = valueMapping['max_event_count'];
		if (countMax)
		{
			item[getFinalFieldName('eventCountMax', eventId)] = countMax;
		}
	}
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
				
				let item = {'cv': value};
				
				let numAdRevenueSources = AD_REVENUE_SOURCES.length;
				
				if (numAdRevenueSources == 1)
				{
					item['adRevenueSources'] = AD_REVENUE_SOURCES[0];
				}
				else if (numAdRevenueSources > 1)
				{
					item['adRevenueSources'] = '\"' + AD_REVENUE_SOURCES.join(', ') + '\"';
				}
				
				let numValueMappings = Math.min(valueMappings.length, 4);
				for (let j = 0; j < numValueMappings; ++j)
				{
					updateItem(item, j + 1, valueMappings[j]);
				}
				
				items.push(item);
			}
		}
	}

	let csvData = [
		'CV',
		'total_revenue_min','total_revenue_max',
		'iap_revenue_min','iap_revenue_max',
		'ad_revenue_min','ad_revenue_max','adrevenue_sources',
		'hours_since_install_min','hours_since_install_max',
		'event_token','event_count_min','event_count_max','event_revenue_min','event_revenue_max',
		'event2_token','event2_count_min','event2_count_max','event2_revenue_min','event2_revenue_max',
		'event3_token','event3_count_min','event3_count_max','event3_revenue_min','event3_revenue_max',
		'event4_token','event4_count_min','event4_count_max','event4_revenue_min','event4_revenue_max'].join(",") + "\r\n";
	
	items.forEach((item) => {
		csvData += [
			item.cv,
			item.totalRevenueMin, item.totalRevenueMax,
			item.iapRevenueMin, item.iapRevenueMax,
			item.adRevenueMin, item.adRevenueMax, item.adRevenueSources,
			item.hoursSinceInstallMin, item.hoursSinceInstallMax,
			item.eventToken, item.eventCountMin, item.eventCountMax, item.eventRevenueMin, item.eventRevenueMax,
			item.eventToken2, item.eventCountMin2, item.eventCountMax2, item.eventRevenueMin2, item.eventRevenueMax2,
			item.eventToken3, item.eventCountMin3, item.eventCountMax3, item.eventRevenueMin3, item.eventRevenueMax3,
			item.eventToken4, item.eventCountMin4, item.eventCountMax4, item.eventRevenueMin4, item.eventRevenueMax4
		].join(",") + "\r\n"
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
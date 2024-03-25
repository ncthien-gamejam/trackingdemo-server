import express from 'express';
import fetch from 'node-fetch';
import * as fs from 'fs';

const router = express.Router();

const skanSchema = JSON.parse(fs.readFileSync('./config/skan_v4_test.json'));

const eventMapping = JSON.parse(fs.readFileSync('./config/event_mapping.json'));
function getEventMapping(eventName)
{
	if (!eventName) return null;
	
	let ret = eventMapping[eventName];
	if (!ret) return null;
	
	return ret;
}

const baseCurrency = 'USD';

function createEventData(baseObject)
{
	let mappingType = baseObject['mapping_type'];
	if (!mappingType) return null;
	
	let eventName = null;
	
	let revenueMin = null;
	let revenueMax = null;
	
	let countMin = null;
	let countMax = null;
	
	if (mappingType === 'revenue')
	{
		let revenueType = baseObject['revenue_type'];
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
		
		revenueMin = baseObject['min_revenue'];
		if (revenueMin === undefined) revenueMin = null;
		
		revenueMax = baseObject['max_revenue'];
		if (revenueMax === undefined) revenueMax = null;
	
	}
	else if (mappingType === 'event')
	{
		eventName = getEventMapping(baseObject['event_name']);
		if (!eventName) return null;

		revenueMin = baseObject['min_revenue'];
		if (revenueMin === undefined) revenueMin = null;
		
		revenueMax = baseObject['max_revenue'];
		if (revenueMax === undefined) revenueMax = null;
		
		countMin = baseObject['min_event_count'];
		if (countMin === undefined) countMin = null;
		
		countMax = baseObject['max_event_count'];
		if (countMax === undefined) countMax = null;
	}
	else if (mappingType === 'session')
	{
		eventName = getEventMapping('__session__');
		if (!eventName) return null;

		countMin = baseObject['min_session_count'];
		if (countMin === undefined) countMin = null;
		
		countMax = baseObject['max_session_count'];
		if (countMax === undefined) countMax = null;
	}
	else if (mappingType === 'session')
	{
		//TODO
	}
	else
	{
		return null;
	}
	
	let ret = {};
	
	ret['event_name'] = eventName;
	
	if (revenueMin !== null || revenueMax !== null)
	{
		ret['revenue_min'] = revenueMin !== null ? revenueMin : 0;
		if (revenueMax !== null) ret['revenue_max'] = revenueMax;
	}
	
	if (countMin !== null || countMax !== null)
	{
		ret['count_min'] = countMin !== null ? countMin : 0;
		if (countMax !== null) ret['count_max'] = countMax;
	}
	
	return ret;
}
	
function createFineMappingData(baseObject)	
{
	let ret = {};
	
	let value = baseObject['fine_cv'];
	if (!value) return null;

	let mappings = baseObject['value_mappings'];
	if (!mappings) return null;

	let eventsData = [];
	
	let numMappings = mappings.length;
	for (let i = 0; i < numMappings; ++i)
	{
		let eventData = createEventData(mappings[i]);
		if (eventData)
		{
			eventsData.push(eventData);
		}
	}
	
	if (eventsData.length === 0) return null;
	
	ret['conversion_value'] = value;
	ret['events']= eventsData;
	
	return ret;
}

function createFineMappingsData(baseObject)
{
	let ret = [];
	
	let num = baseObject.length;
	for (let i = 0; i < num; ++i)
	{
		let data = createFineMappingData(baseObject[i]);
		if (data) ret.push(data);
	}
	
	if (ret.length === 0) return null;
	return ret;
}

function createCoarseMappingData(baseObject)
{
	let ret = {};
	
	let value = baseObject['coarse_cv'];
	if (!value) return null;
	
	let mappings = baseObject['value_mappings'];
	if (!mappings) return null;
	
	let eventsData = [];
	
	let numMappings = mappings.length;
	for (let i = 0; i < numMappings; ++i)
	{
		let eventData = createEventData(mappings[i]);
		if (eventData)
		{
			eventsData.push(eventData);
		}
	}
	
	if (eventsData.length === 0) return null;
	
	ret['coarse_conversion_value'] = value;
	ret['events']= eventsData;
	
	return ret;
}

function createCoarseMappingsData(baseObject)
{
	let ret = [];
	
	let num = baseObject.length;
	for (let i = 0; i < num; ++i)
	{
		let data = createCoarseMappingData(baseObject[i]);
		if (data) ret.push(data);
	}
	
	if (ret.length === 0) return null;
	return ret;
}

function createSettingsData(baseObject)
{
	let ret = {};
	//TODO
	
	return ret;
}

function createWindowData(baseObject, id, hasFine, hasCoarse)
{
	let ret = {}
	
	let data = {};
	if (hasFine)
	{
		let mappings = baseObject['fine_cv_mappings'];
		
		if (mappings)
		{
			let fineData = createFineMappingsData(mappings);
			data['fine'] = fineData || {};
		}
	}	
	
	if (hasCoarse)
	{
		let mappings = baseObject['coarse_cv_mappings'];
		
		if (mappings)
		{
			let coarseData = createCoarseMappingsData(mappings);
			data['coarse'] = coarseData || {};
		}
	}

	let settingsData = createSettingsData(baseObject);
	data['settings'] = settingsData;
		
	ret['data'] = data;
	ret['conversion_window'] = id;
	
	return ret;
}

router.get('/', async function(req, res, next) {
  try {
	let ret = [];
	
	let windowOne = skanSchema['window_one'];
	if (windowOne)
	{
		ret.push(createWindowData(windowOne, 1, true, true));
	}
	
	let windowTwo = skanSchema['window_two'];
	if (windowTwo)
	{
		ret.push(createWindowData(windowTwo, 2, false, true));
	}
		
	let windowThree = skanSchema['window_three'];
	if ('window_three')
	{
		ret.push(createWindowData(windowThree, 3, false, true));
	}
	
    res.json(ret);
  } catch (err) {
    console.error(`Error while processing trigger request `, err.message);
    next(err);
  }
});

export { router }
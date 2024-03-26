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

const appStoreId = 6451180535;
const updatedTime = 1711437911;

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
	else
	{
		return null;
	}
	
	let ret = {};
	
	ret['event_name'] = eventName;

	if (revenueMin !== null || revenueMax !== null)
	{
		if (revenueMin !== null) ret['revenue_min'] = Math.max(revenueMin, 0.0);
		if (revenueMax !== null) ret['revenue_max'] = revenueMax;
	}
	
	if (countMin !== null || countMax !== null)
	{
		if (countMin !== null) ret['count_min'] = Math.max(countMin, 1);
		if (countMax !== null) ret['count_max'] = countMax;
	}
	
	return ret;
}
	
function createFineMappingData(baseObject)	
{
	let ret = {};
	
	let value = baseObject['fine_cv'];
	if (value === undefined || value === null) return null;
	
	let mappings = baseObject['value_mappings'];
	if (!mappings) return null;

	let eventsData = [];
	
	let numMappings = mappings.length;
	for (let i = 0; i < numMappings; ++i)
	{
		let eventData = createEventData(mappings[i], null);
		if (eventData)
		{
			if (eventData instanceof Array)
			{
				eventsData.push.apply(eventsData, eventData);
			}
			else
			{
				eventsData.push(eventData);
			}
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

function getTimeLockFromCondition(lockCondition, minLockHours, maxLockHours)
{
	if (lockCondition['lock_condition_type'] !== 'time') return null;
	
	let seconds = lockCondition['post_install_time'];
	
	let hours = Math.floor(seconds / 3600); //convert to hours
	
	if (hours >= maxLockHours) return null;
	
	if (hours < minLockHours) hours = minLockHours;
	
	return hours;
}

function getTimeLockFromConditions(lockConditions, minLockHours, maxLockHours)
{
	let ret = null;
	
	let num = lockConditions.length;
	for (let i = 0; i < num; ++i)
	{
		let timeLock = getTimeLockFromCondition(lockConditions[i], minLockHours, maxLockHours);
		if (timeLock)
		{
			if (!ret) ret = timeLock;
			else ret = Math.min(timeLock, ret);
		}
	}
	
	return ret;
}

function createWindowData(baseObject)
{
	let mappings = baseObject['fine_cv_mappings'];
	if (!mappings) return null;
	
	let fineData = createFineMappingsData(mappings);
	if (!fineData) return null;
	
	return fineData;
}

router.get('/', async function(req, res, next) {
  try {
	let ret = {};
	
	ret['app_store_id'] = appStoreId;
	ret['updated_at'] = updatedTime;
	ret['reporting_currency'] = baseCurrency;

	let windowOne = skanSchema['window_one'];
	if (windowOne)
	{
		let lockConditions = windowOne['lock_conditions'];
			
		if (lockConditions)
		{
			let timeLock = getTimeLockFromConditions(lockConditions, 1, 24);
			if (timeLock)
			{
				ret['cut_off_period'] = timeLock;
			}
		}		
		
		let data = createWindowData(windowOne);
		if (data)
		{
			ret['conversion_values'] = data;
		}
	}

    res.json(ret);
  } catch (err) {
    console.error(`Error while processing trigger request `, err.message);
    next(err);
  }
});

export { router }
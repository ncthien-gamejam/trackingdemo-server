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

const EPS = 1e-7;

var groupBy = function(xs, key) {
  return xs.reduce(function(rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

function swapElements(arr, id0, id1)
{
    const tmp = arr[id0];
    arr[id0] = arr[id1];
    arr[id1] = tmp;
}

function compareEventRect(rectA, rectB)
{
	//Check min revenue
	if (rectA[0] < rectB[0] - EPS) return -1;
	if (rectA[0] > rectB[0] + EPS) return 1;
	
	//Check min count
	if (rectA[2] < rectB[2]) return -1;
	if (rectA[2] > rectB[2]) return 1;
	
	return 0;
}

function containsRevenueRange(rectA, rectB)
{
	if (rectA[0] > rectB[0] + EPS) return false;
	
	if (rectA[1] > -EPS) //not infinity
	{
		if (rectB[1] < -EPS) return false; //infinity
		if (rectA[1] < rectB[1] - EPS) return false;
	}
	
	return true;
}

function containsCountRange(rectA, rectB)
{
	if (rectA[2] > rectB[2]) return false;
	
	if (rectA[3] >= 0) //not infinity
	{
		if (rectB[3] < 0) return false;  //infinity
		if (rectA[3] < rectB[3]) return false;
	}
	
	return true;
}

function containsRect(rectA, rectB)
{
	if (rectA[0] > rectB[0] + EPS) return false;
	
	if (rectA[1] > -EPS) //not infinity
	{
		if (rectB[1] < -EPS) return false;  //infinity
		if (rectA[1] < rectB[1] - EPS) return false;
	}
	
	if (rectA[2] > rectB[2]) return false;
	
	if (rectA[3] >= 0) //not infinity
	{
		if (rectB[3] < 0) return false;  //infinity
		if (rectA[3] < rectB[3]) return false;
	}
	
	return true;
}

function disjointRect(rectA, rectB)
{
	if (rectB[1] > -EPS) //not infinity
	{
		if (rectA[0] > rectB[1] + EPS) return true;
	}
	
	if (rectA[1] > -EPS) //not infinity
	{
		if (rectB[0] > rectA[1] + EPS) return true;
	}
	
	if (rectB[3] >= 0) //not infinity
	{
		if (rectA[2] > rectB[3] + 1) return true;
	}
	
	if (rectA[3] >= 0) //not infinity
	{
		if (rectB[2] > rectA[3] + 1) return true;
	}
	
	return false;
}

function adjustTopEventRect(rects, pos)
{
	let move = false;
	
	let num = rects.length;
	while (pos + 1 < num && compareEventRect(rects[pos], rects[pos + 1]) > 0)
	{
		swapElements(rects, pos, pos + 1);
		pos++;
		
		move = true;
	}
	
	return move;
}

//TODO: Test different cases
function groupEventsData(eventName, eventsData)
{
	let rects = [];
	
	let numEvents = eventsData.length;
	for (let i = 0; i < numEvents; ++i)
	{
		let eventData = eventsData[i];
		
		let revenueMin = eventData['revenue_min'] || 0.0;
		let revenueMax = eventData['revenue_max'] || -1.0;
		
		let countMin = eventData['count_min'] || 1;
		let countMax = eventData['count_max'] || -1;

		rects.push([revenueMin, revenueMax, countMin, countMax]);
	}
	
	//Sort rects based on min revenue and min count
	for (let i = 0; i < numEvents; ++i)
	{
		for (let j = i + 1; j < numEvents; ++j)
		{
			if (compareEventRect(rects[i], rects[j]) > 0)
			{
				swapElements(rects, i, j);
			}
		}
	}
	
	let ret = [];
	
	for (let i = 0; i < numEvents; ++i)
	{
		let curRect = rects[i];
		
		let valid = true;
		
		for (let j = i + 1; j < numEvents; ++j)
		{
			let targetRect = rects[j];
			
			if (containsRect(curRect, targetRect))
			{
				rects.splice(j, 1);
				
				j--;
				numEvents--;
				
				continue;
			}
	
			if (containsRect(targetRect, curRect)) //Remove rect that is fully inside other rect
			{
				valid = false;
				break;
			}
	
			if (disjointRect(targetRect, curRect))
			{
				continue;
			}
			
			if (containsRevenueRange(targetRect, curRect))
			{
				//Increase current rect's size
				if (curRect[3] >= 0) //not infinity
				{
					if (targetRect[3] < 0) //infinity
					{
						curRect[3] = -1;
					}
					else
					{
						curRect[3] = Math.max(curRect[3], targetRect[3]);
					}
				}
				
				if (curRect[1] < -EPS) //infinity
				{
					//Remove target rect
					rects.splice(j, 1);
				
					j--;
					numEvents--;
				}
				else
				{
					targetRect[0] = Math.max(targetRect[0], curRect[1]);
					if (targetRect[1] > -EPS && targetRect[0] > targetRect[1] - EPS)
					{
						//Remove target rect
						rects.splice(j, 1);
					
						j--;
						numEvents--;
					}
					else
					{
						rects[j] = targetRect;
						if (adjustTopEventRect(rects, j))
						{
							j--;
						}
					}
				}
			}
			else if (containsCountRange(targetRect, curRect))
			{
				//Increase current rect's size
				if (curRect[1] > -EPS) //not infinity
				{
					if (targetRect[1] < -EPS) //infinity
					{
						curRect[1] = -1.0;
					}
					else
					{
						curRect[1] = Math.max(curRect[1], targetRect[1]);
					}
				}
				
				
				if (curRect[3] < 0) //infinity
				{
					//Remove target rect
					rects.splice(j, 1);
				
					j--;
					numEvents--;
				}
				else
				{
					targetRect[2] = Math.max(targetRect[2], curRect[3] + 1);
					if (targetRect[3] >= 0 && targetRect[2] > targetRect[3])
					{
						//Remove target rect
						rects.splice(j, 1);
					
						j--;
						numEvents--;
					}
					else
					{
						rects[j] = targetRect;
						if (adjustTopEventRect(rects, j))
						{
							j--;
						}
					}
				}
			}
		}
		
		if (valid)
		{
			let eventData = {'event_name': eventName};
			
			if (curRect[0] > EPS)
			{
				eventData['revenue_min'] = curRect[0];
			}
			
			if (curRect[1] > -EPS)
			{
				eventData['revenue_max'] = curRect[1];
			}
			
			if (curRect[2] > 1)
			{
				eventData['count_min'] = curRect[2];
			}
			
			if (curRect[3] >= 0)
			{
				eventData['count_max'] = curRect[3];
			}
			
			ret.push(eventData);
		}
	}
	
	if (ret.length === 0) return null;
	
	return ret;
}

function createEventsDataFromFineMappings(fineMappings, minFineCv, maxFineCv)
{
	let mappings = [];
	
	let numMappings = fineMappings.length;
	for (let i = 0; i < numMappings; ++i)
	{
		let value = fineMappings[i]['conversion_value'];
		if (value < minFineCv || value > maxFineCv) continue;
		
		mappings.push.apply(mappings, fineMappings[i]['events']);
	}
	
	if (mappings.length === 0) return null;
	
	let mappingGroups = groupBy(mappings, 'event_name');

	let ret = [];
	
	for (let eventName in mappingGroups)
	{
		let eventsData = groupEventsData(eventName, mappingGroups[eventName]);
		if (eventsData && eventsData.length > 0)
		{
			ret.push.apply(ret, eventsData);
		}
	}
	
	if (ret.length === 0) return null;
	
	return ret;
}

function createEventData(baseObject, fineMappings)
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
	else if (mappingType === 'fine_cv')
	{
		if (!fineMappings) return null;
		
		let minFineCv = baseObject['min_fine_cv'];
		if (minFineCv === undefined) minFineCv = 0;
		
		if (minFineCv < 0) return null;
		else if (minFineCv > 63) return null;
		
		let maxFineCv = baseObject['max_fine_cv'];
		if (maxFineCv === undefined) maxFineCv = 63;

		if (maxFineCv < 0) return null;
		else if (maxFineCv > 63) return null;
		
		if (maxFineCv < minFineCv) return null;
		
		return createEventsDataFromFineMappings(fineMappings, minFineCv, maxFineCv);
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

function createCoarseMappingData(baseObject, fineMappings)
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
		let eventData = createEventData(mappings[i], fineMappings);
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
	
	ret['coarse_conversion_value'] = value;
	ret['events']= eventsData;
	
	return ret;
}

function createCoarseMappingsData(baseObject, fineMappings)
{
	let ret = [];
	
	let num = baseObject.length;
	for (let i = 0; i < num; ++i)
	{
		let data = createCoarseMappingData(baseObject[i], fineMappings);
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
	
	return hours - minLockHours + 1;
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

function createSettingsData(baseObject, minLockHours, maxLockHours)
{
	let ret = {};
	ret['app_store_id'] = appStoreId;
	ret['updated_at'] = updatedTime;
	ret['reporting_currency'] = baseCurrency;
	
	let lockConditions = baseObject['lock_conditions'];
		
	if (lockConditions)
	{
		let lockWindowObject = null;
		
		let timeLock = getTimeLockFromConditions(lockConditions, minLockHours, maxLockHours);
		if (timeLock)
		{
			if (lockWindowObject === null) lockWindowObject = {};
			lockWindowObject['time_in_hours'] = timeLock;
		}
		
		if (lockWindowObject)
		{
			ret['lock_window'] = lockWindowObject;
		}
	}
	
	return ret;
}

function createWindowData(baseObject, id, hasFine, hasCoarse, fineMappings, minLockHours, maxLockHours)
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
						
			if (fineMappings == null && fineData)
			{
				fineMappings = fineData;
			}
		}
	}	
	
	if (hasCoarse)
	{
		let mappings = baseObject['coarse_cv_mappings'];
		
		if (mappings)
		{
			let coarseData = createCoarseMappingsData(mappings, fineMappings);
			data['coarse'] = coarseData || {};
		}
	}

	let settingsData = createSettingsData(baseObject, minLockHours, maxLockHours);
	data['settings'] = settingsData;
		
	ret['data'] = data;
	ret['conversion_window'] = id;
	
	return ret;
}

router.get('/', async function(req, res, next) {
  try {
	let ret = [];
	
	let fineMappings = null;
	
	let windowOne = skanSchema['window_one'];
	if (windowOne)
	{
		//console.log("WINDOW ONE");
		
		let data = createWindowData(windowOne, 1, true, true, null, 1, 48);
		
		fineMappings = data['data']['fine'];
		if (fineMappings === undefined) fineMappings = null;
		
		ret.push(data);
	}
	
	let windowTwo = skanSchema['window_two'];
	if (windowTwo)
	{
		//console.log("WINDOW TWO");
		
		let data = createWindowData(windowTwo, 2, false, true, fineMappings, 49, 168);
		ret.push(data);
	}
		
	let windowThree = skanSchema['window_three'];
	if ('window_three')
	{
		//console.log("WINDOW THREE");
		
		let data = createWindowData(windowThree, 3, false, true, fineMappings, 169, 840);
		ret.push(data);
	}
	
    res.json(ret);
  } catch (err) {
    console.error(`Error while processing trigger request `, err.message);
    next(err);
  }
});

export { router }
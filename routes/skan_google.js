import express from 'express';
import fetch from 'node-fetch';
import * as fs from 'fs';

import { parseTemplate } from 'url-template';

const router = express.Router();

const GOOGLE_TOKEN_URL = 'https://www.googleapis.com/oauth2/v4/token';

const clientId = '420137273716-pbc6p4542ipbd4hi72sj6tokk74asgcf.apps.googleusercontent.com';
const clientSecret = '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';
const refreshToken = '1//04378p8o-bALsCgYIARAAGAQSNwF-L9IrVVgsp7qyUzpmFHEkh7Y1lORHie1wKBM8qsRzewwJ-Y4IZpJ_7ChhPs7lz5l4DEP7f6U';

const SKADNETWORK_CONVERSION_VALUE_SCHEMA_GET = parseTemplate('https://analyticsadmin.googleapis.com/v1alpha/properties/{property_id}/dataStreams/{dataStream}/sKAdNetworkConversionValueSchema');

const propertyId = '415249261';
const dataStream = '7779582138';

const applyConversionValues = true;

const postbackWindowTwoEnabled = true;
const postbackWindowThreeEnabled = true;

const skanSchema = JSON.parse(fs.readFileSync('./config/skan_v4_test.json'));

const eventMapping = JSON.parse(fs.readFileSync('./config/event_mapping_google.json'));
function getEventMapping(eventName)
{
	if (!eventName) return null;
	
	let ret = eventMapping[eventName];
	if (!ret) return null;
	
	return ret;
}

const baseCurrency = 'USD';

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
		
		let revenueMin = eventData['minEventValue'] || 0.0;
		let revenueMax = eventData['maxEventValue'] || -1.0;
		
		let countMin = eventData['minEventCount'] || 1;
		let countMax = eventData['maxEventCount'] || -1;

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
			let eventData = {'eventName': eventName};
			
			if (curRect[0] > EPS)
			{
				eventData['minEventValue'] = curRect[0];
			}
			
			if (curRect[1] > -EPS)
			{
				eventData['maxEventValue'] = curRect[1];
			}
			
			if (curRect[2] > 1)
			{
				eventData['minEventCount'] = curRect[2];
			}
			
			if (curRect[3] >= 0)
			{
				eventData['maxEventCount'] = curRect[3];
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
		let value = fineMappings[i]['fineValue'];
		if (value < minFineCv || value > maxFineCv) continue;
		
		mappings.push.apply(mappings, fineMappings[i]['eventMappings']);
	}
	
	if (mappings.length === 0) return null;
	
	let mappingGroups = groupBy(mappings, 'eventName');
	
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
	
	let ret = {};
	
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
		let minFineCv = baseObject['min_fine_cv'];
		if (minFineCv === undefined) minFineCv = 0;
		
		if (minFineCv < 0) return null;
		else if (minFineCv > 63) return null;
		
		let maxFineCv = baseObject['max_fine_cv'];
		if (maxFineCv === undefined) maxFineCv = 63;

		if (maxFineCv < 0) return null;
		else if (maxFineCv > 63) return null;
		
		if (maxFineCv < minFineCv) return null;
		
		if (!fineMappings)
		{
			ret['minFineCv'] = minFineCv;
			ret['maxFineCv'] = maxFineCv;
		}
		else
		{
			return createEventsDataFromFineMappings(fineMappings, minFineCv, maxFineCv);
		}
	}
	else
	{
		return null;
	}
	
	ret['eventName'] = eventName;

	if (revenueMin !== null || revenueMax !== null)
	{
		if (revenueMin !== null) ret['minEventValue'] = Math.max(revenueMin, 0.0);
		if (revenueMax !== null) ret['maxEventValue'] = revenueMax;
	}
	
	if (countMin !== null || countMax !== null)
	{
		if (countMin !== null) ret['minEventCount'] = Math.max(countMin, 1).toString();
		if (countMax !== null) ret['maxEventCount'] = countMax.toString();
	}
	
	return ret;
}

function createFineConversionValue(baseObject)
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
		eventsData.push(eventData);
	}
	
	if (eventsData.length === 0) return null;
	
	ret['fineValue'] = value;
	ret['eventMappings'] = eventsData;
		
	return ret;
}

function mapCoarseValue(value)
{
	if (value === 'low') return 'COARSE_VALUE_LOW';
	else if (value === 'medium') return 'COARSE_VALUE_MEDIUM';
	else if (value === 'high') return 'COARSE_VALUE_HIGH';
}

function createCoarseConversionValue(baseObject, fineMappings)
{
	let ret = {};
	
	let value = baseObject['coarse_cv'];
	if (value === undefined || value === null) return null;
	
	value = mapCoarseValue(value);
	if (value === undefined || value === null) return null;
	
	let mappings = baseObject['value_mappings'];
	if (!mappings) return null;
	
	let eventsData = [];
	
	let numMappings = mappings.length;
	for (let i = 0; i < numMappings; ++i)
	{
		let eventData = createEventData(mappings[i], fineMappings);
		
		if (eventData instanceof Array)
		{
			eventsData.push.apply(eventsData, eventData);
		}
		else
		{
			eventsData.push(eventData);
		}
	}
	
	if (eventsData.length === 0) return null;
	
	ret['coarseValue'] = value;
	ret['eventMappings'] = eventsData;
		
	return ret;
}

function isValidCoarseEventMapping(fineValue, fineEventMapping, coarseEventMapping)
{
	let minFineCv = coarseEventMapping['minFineCv'];
	let maxFineCv = coarseEventMapping['maxFineCv'];

	if (minFineCv || maxFineCv)
	{
		minFineCv = minFineCv || 0;
		maxFineCv = maxFineCv || 63;
		
		return fineValue >= minFineCv && fineValue <= maxFineCv;
	}
	
	if (fineEventMapping['eventName'] !== coarseEventMapping['eventName']) return false;
	
	let revenueMin = coarseEventMapping['minEventValue'] || 0.0;
	let revenueMax = coarseEventMapping['maxEventValue'] || -1.0;
	
	let countMin = coarseEventMapping['minEventCount'] || 1;
	let countMax = coarseEventMapping['maxEventCount'] || -1
	
	let coarseRect = [revenueMin, revenueMax, countMin, countMax];
	
	revenueMin = fineEventMapping['minEventValue'] || 0.0;
	revenueMax = fineEventMapping['maxEventValue'] || -1.0;
	
	countMin = fineEventMapping['minEventCount'] || 1;
	countMax = fineEventMapping['maxEventCount'] || -1;
	
	let fineRect = [revenueMin, revenueMax, countMin, countMax];
	
	return containsRect(coarseRect, fineRect);
}

function isValidCoarseEventMappings(fineValue, fineEventMapping, coarseEventMappings)
{
	let numEventMappings = coarseEventMappings.length;
	for (let i = 0; i < numEventMappings; ++i)
	{
		if (isValidCoarseEventMapping(fineValue, fineEventMapping, coarseEventMappings[i])) return true;
	}
	
	return false;
}

function inferCoarseValue(fineValue, eventMappings, coarseConversionValues)
{
	if (!coarseConversionValues) return null;
	
	let numEventMappings = eventMappings.length;
	
	let numCoarseConversionValues = coarseConversionValues.length;
	for (let i = 0; i < numCoarseConversionValues; ++i)
	{
		let coarseEventMappings = coarseConversionValues[i]['eventMappings'];
		
		let valid = false;
		for (let j = 0; j < numEventMappings; ++j)
		{
			if (isValidCoarseEventMappings(fineValue, eventMappings[j], coarseEventMappings))
			{
				valid = true;
				break;
			}
		}
		
		if (valid) return coarseConversionValues[i]['coarseValue'];
	}
	
	return null;
}

function checkLockFromCondition(lockCondition, fineValue, coarseValue)
{
	let conditionType = lockCondition['lock_condition_type'];
	if (conditionType === 'fine_cv')
	{
		let fineCvs = lockCondition['fine_cvs'];
	 	if (fineValue && fineCvs)
		{
			let numValues = fineCvs.length;
			for (let i = 0; i < numValues; ++i)
			{
				if (fineCvs[i] === fineValue) return true;
			}
		}
	}
	else if (conditionType === 'coarse_cv')
	{
		let coarseCvs = lockCondition['coarse_cvs'];
	 	if (coarseValue && coarseCvs)
		{
			let numValues = coarseCvs.length;
			for (let i = 0; i < numValues; ++i)
			{
				if (mapCoarseValue(coarseCvs[i]) === coarseValue) return true;
			}
		}
	}
	
	return false;
}

function checkLockFromConditions(lockConditions, fineValue, coarseValue)
{
	if (!lockConditions) return false;
	
	let num = lockConditions.length;
	for (let i = 0; i < num; ++i)
	{
		if (checkLockFromCondition(lockConditions[i], fineValue, coarseValue))
		{
			return true;
		}
	}
	
	return false;
}

function createWindowData(baseObject, hasFine, baseFineMappings, enabled)
{
	let ret = {};
	
	let conversionValues = [];
	
	let lockConditions = baseObject['lock_conditions'];
	
	if (hasFine)
	{
		let coarseMappings = baseObject['coarse_cv_mappings'];
		let coarseConversionValues = [];
	
		if (coarseMappings)
		{
			let num = coarseMappings.length;
			for (let i = 0; i < num; ++i)
			{
				let conversionValue = createCoarseConversionValue(coarseMappings[i], null);
				if (conversionValue)
				{
					coarseConversionValues.push(conversionValue);
				}
			}
		}

		let fineMappings = baseObject['fine_cv_mappings'];
		
		let lastCoarseValue = 'COARSE_VALUE_LOW';
		
		if (fineMappings)
		{
			let num = fineMappings.length;
			for (let i = 0; i < num; ++i)
			{
				let conversionValue = createFineConversionValue(fineMappings[i]);
				if (conversionValue)
				{
					let fineValue = conversionValue['fineValue'];
					let eventMappings = conversionValue['eventMappings'];
					
					let coarseValue = inferCoarseValue(fineValue, eventMappings, coarseConversionValues);
					
					if (!coarseValue) coarseValue = lastCoarseValue;
					else lastCoarseValue = coarseValue;
					
					conversionValue['coarseValue'] = coarseValue;
					
					conversionValue['lockEnabled'] = checkLockFromConditions(lockConditions, fineValue, coarseValue);
					
					conversionValues.push(conversionValue);
				}
			}
		}
	}
	else
	{
		let coarseMappings = baseObject['coarse_cv_mappings'];
		let coarseConversionValues = [];
	
		if (coarseMappings)
		{
			let num = coarseMappings.length;
			for (let i = 0; i < num; ++i)
			{
				let conversionValue = createCoarseConversionValue(coarseMappings[i], baseFineMappings || []);
				if (conversionValue)
				{
					let coarseValue = conversionValue['coarseValue'];
					conversionValue['lockEnabled'] = checkLockFromConditions(lockConditions, null, coarseValue);
					
					conversionValues.push(conversionValue);
				}
			}
		}
	}
	
	ret['conversionValues'] = conversionValues;
	ret['postbackWindowSettingsEnabled'] = enabled;
	
	return ret;
}

function generateData(skanSchema)
{
	let ret = {};
	
	ret['name'] = 'properties/' + propertyId + '/dataStreams/' + dataStream + '/sKAdNetworkConversionValueSchema';
	
	let fineMappings = null;
	
	let windowOne = skanSchema['window_one'];
	if (windowOne)
	{
		let data = createWindowData(windowOne, true, null, true);
		
		fineMappings = data['conversionValues'];
		if (fineMappings === undefined) fineMappings = null;
		
		ret['postbackWindowOne'] = data;
	}
	
	let windowTwo = skanSchema['window_two'];
	if (windowTwo)
	{
		let data = createWindowData(windowTwo, false, fineMappings, postbackWindowTwoEnabled);
		ret['postbackWindowTwo'] = data;
	}
		
	let windowThree = skanSchema['window_three'];
	if (windowThree)
	{
		let data = createWindowData(windowThree, false, fineMappings, postbackWindowThreeEnabled);
		ret['postbackWindowThree'] = data;
	}
	
	ret['applyConversionValues'] = applyConversionValues;
		
	return ret;
}

async function setupSkan(accessToken)
{
	const authorization = 'Bearer ' + accessToken;
	
	const url = SKADNETWORK_CONVERSION_VALUE_SCHEMA_GET.expand({
		property_id: propertyId,
		dataStream: dataStream
	});
	
	const response = await fetch(url,
	{
		method: 'GET',
		headers: {
		  'Authorization': authorization
		}
	});  
	
	const responseJSON = await response.json();
	console.log(JSON.stringify(responseJSON));
}

router.get('/', async function(req, res, next) {
  try {
	  
	const postParams = new URLSearchParams();
	postParams.append('client_id', clientId);
	postParams.append('client_secret', clientSecret);
	postParams.append('grant_type', 'refresh_token');
	postParams.append('refresh_token', refreshToken);
	  
	const response = await fetch(GOOGLE_TOKEN_URL,
	{
		method: 'POST',
		body: postParams,
		headers: {'Content-Type': 'application/x-www-form-urlencoded'}
	});  
	
	const responseJSON = await response.json();
	
	let accessToken = responseJSON['access_token'];
	if (!accessToken)
	{
		throw new Error('Can\'t get Google access token');
	}
	
	//await setupSkan(accessToken);
	
	let data = generateData(skanSchema);
	console.log(JSON.stringify(data));
		  
	res.sendStatus(200);
  } catch (err) {
    console.error(`Error while processing trigger request `, err.message);
    next(err);
  }
});

export { router }
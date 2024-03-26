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
	
	await setupSkan(accessToken);
		  
	res.sendStatus(200);
  } catch (err) {
    console.error(`Error while processing trigger request `, err.message);
    next(err);
  }
});

export { router }
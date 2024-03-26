import express from 'express';
import fetch from 'node-fetch';
import * as fs from 'fs';

const router = express.Router();

const GOOGLE_TOKEN_URL = 'https://www.googleapis.com/oauth2/v4/token';

const clientId = '420137273716-pbc6p4542ipbd4hi72sj6tokk74asgcf.apps.googleusercontent.com';
const clientSecret = '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';
const refreshToken = '1//044D-XBUuseHNCgYIARAAGAQSNwF-L9Ir0EFEmL7z2XAGwrwMJpkwlgJh8aBor5Ad7naVUoaaBOIA9qRQIExJilIltm9roNzCJFs';

const developerToken = 'A-8CfsVKc6zkNJhLLcFPsA';

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
	
	const response = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers',
	{
		method: 'GET',
		headers: {
		  'Authorization': authorization,
		  'developer-token': developerToken
		}
	});  
	
	const responseJSON = await response.json();
	console.log(responseJSON);
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
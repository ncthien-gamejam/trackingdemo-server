import express from 'express';
const router = express.Router();

import cbor from 'cbor';

import BN from 'bn.js';

function processEventReport(body)
{
  let destination = body['attribution_destination'];
  if (destination)
  {
     console.log("DESTINATION = " + destination);
  }
  
  let sourceType = body['source_type'];
  if (sourceType)
  {
     console.log("SOURCE TYPE = " + sourceType);
  }
  
  let sourceEventId = body['source_event_id'];
  if (sourceEventId)
  {
     console.log("SOURCE EVENT ID = " + sourceEventId);
  }
  
  let triggerData = body['trigger_data'];
  if (triggerData)
  {
     console.log("TRIGGER DATA = " + triggerData);
  }
}

function processClearTextAggregatePayload(payload)
{
  console.log("CLEAR TEXT PAYLOAD = " + payload);
  
  let base64decodedPayload = Buffer.from(payload, 'base64');
  const dataItems = cbor.decodeAllSync(base64decodedPayload);
  
  console.log("DATA ITEMS = " + JSON.stringify(dataItems));

  let finalPayloads = dataItems[0]['data'];
  for (let i = 0; i < finalPayloads.length; ++i)
  {
    let finalPayload = finalPayloads[i];
    
    let bucketBuffer = finalPayload['bucket'];
    let valueBuffer = finalPayload['value'];
    
    let bucketBigint = new BN(bucketBuffer);
    let valueBigint = new BN(valueBuffer);

    console.log("BUCKET = " + '0x' + bucketBigint.toString(16));
    console.log("VALUE = " + valueBigint.toString());
  }
}

function processEncryptedAggregatePayload(payload, key)
{
  console.log("ENCRYPTED PAYLOAD = " + payload);
  console.log("ENCRYPTED PAYLOAD KEY  = " + key);
  //TODO: Request aggregation service
}

function processAggregateReport(body)
{
  let sharedInfo = body['shared_info'];
  if (sharedInfo)
  {
    sharedInfo = sharedInfo.replace(/\\/g,"");
    let sharedInfoObject = JSON.parse(sharedInfo);
    
    console.log("SHARED INFO = " + JSON.stringify(sharedInfoObject));
  }
  
  let payloads = body['aggregation_service_payloads'];
  if (payloads)
  {
    for (let i = 0; i < payloads.length; ++i)
    {
      let payload = payloads[i];
      
      let payloadEncryptedText = payload['payload'];
      let payloadKey = payload['key_id'];
      
      if (payloadEncryptedText && payloadKey)
      {
        try {
          processEncryptedAggregatePayload(payload, key);
        } catch (err) {
          console.error(`Error while processing encrypted payload `, err.message);
        }
      }
      
      let payloadClearText = payload['debug_cleartext_payload'];
      if (payloadClearText && payloadClearText.length > 0)
      {
        try {
          processClearTextAggregatePayload(payloadClearText);
        } catch (err) {
          console.error(`Error while processing clear text payload `, err.message);
        }
      }
    }
  }
}

router.post('/report-event-attribution', async function(req, res, next) {
  try {
    let body = req.body;
    
    console.log("EVENT REPORT = " + JSON.stringify(body));
    
    processEventReport(body);
    
    res.sendStatus(202);
  } catch (err) {
    console.error(`Error while processing event report `, err.message);
    next(err);
  }
});

router.post('/report-aggregate-attribution', async function(req, res, next) {
  try {
    let body = req.body;
    
    console.log("AGGREGATE REPORT = " + JSON.stringify(body));
    
    processAggregateReport(body);
    
    res.sendStatus(202);
  } catch (err) {
    console.error(`Error while processing aggregate report `, err.message);
    next(err);
  }
});

router.post('/debug/verbose', async function(req, res, next) {
  try {
    let body = req.body;
    
    console.log("DEBUG VERBOSE = " + JSON.stringify(body));
      
    res.sendStatus(200);
  } catch (err) {
    console.error(`Error while processing debug verbose `, err.message);
    next(err);
  }
});

router.post('/debug/report-event-attribution', async function(req, res, next) {
  try {
    let body = req.body;
    
    console.log("DEBUG EVENT REPORT = " + JSON.stringify(body));
    
     processEventReport(body);
      
    res.sendStatus(202);
  } catch (err) {
    console.error(`Error while processing debug event report `, err.message);
    next(err);
  }
});

router.post('/debug/report-aggregate-attribution', async function(req, res, next) {
  try {
    let body = req.body;
    
    console.log("DEBUG AGGREGATE REPORT = " + JSON.stringify(body));
    
    processAggregateReport(body);
      
    res.sendStatus(202);
  } catch (err) {
    console.error(`Error while processing debug aggregate report `, err.message);
    next(err);
  }
});

export { router }
import express from 'express';
const router = express.Router();

router.post('/report-event-attribution', async function(req, res, next) {
  try {
    let body = req.body;
    
    console.log("EVENT REPORT = " + JSON.stringify(body));
    
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
    
    let payloads = body['aggregation_service_payloads'];
    
    if (payloads)
    {
      for (let i = 0; i < payloads.length; ++i)
      {
        let payload = payloads[i];
        let payloadClearText = payload['debug_cleartext_payload'];
        
        console.log("PAYLOAD = " + payloadClearText);
      }
    }
    
    res.sendStatus(200);
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
      
    res.sendStatus(200);
  } catch (err) {
    console.error(`Error while processing debug event report `, err.message);
    next(err);
  }
});

router.post('/debug/report-aggregate-attribution', async function(req, res, next) {
  try {
    let body = req.body;
    
    console.log("DEBUG AGGREGATE REPORT = " + JSON.stringify(body));
      
    res.sendStatus(200);
  } catch (err) {
    console.error(`Error while processing debug aggregate report `, err.message);
    next(err);
  }
});

export { router }
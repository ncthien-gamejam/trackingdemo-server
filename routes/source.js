import express from 'express';
const router = express.Router();

import crypto from 'crypto';
import biguintFormat from 'biguint-format'

function getUniqueId()
{
  if (typeof getUniqueId.counter == 'undefined' )
  {
      getUniqueId.counter = 0;
  }

  let ret = ++getUniqueId.counter;
  return ret;
}

router.post('/', async function(req, res, next) {
  try {
    let adId = req.query['ad_id'];
    
    console.log('HEADERS = ' + JSON.stringify(req.headers));
    console.log('QUERY = ' + JSON.stringify(req.query));
    
    const sourceType = req.get('Attribution-Reporting-Source-Info');
    
    let filterData = 
    {
      "conversion_subdomain": ["electronics.megastore"],
      "product": ["1234", "234"],
      "ctid": ["id"]
    };
    
    let aggregationKeys = 
    {
      "campaignCounts": "0x159",
      "geoValue": "0x5"
    };
    
    let sourceEventId = biguintFormat(crypto.randomBytes(8), 'dec'); 
    
    let priority = (sourceType === 'navigation' /*click*/ ? 10 : 1);
    
    let expiry = 3 * 24 * 60 * 60; //3 days
    
    let eventReportWindow = 2 * 24 * 60 * 60; //2 days
    let aggregatableReportWindow = 2 * 24 * 60 * 60; //2 days
    
    let destination = 'android-app://com.example.measurement.sampleapp'; //package name
    //let webDestination = 'https://example.store'; //eTLD+1
    let webDestination = null;
    
    let redirects = [];
    
    let debugReporting = true;
    let debugKey = biguintFormat(crypto.randomBytes(8), 'dec'); 
       
    let headers = 
    {
      source_event_id: sourceEventId,
      destination: destination ? destination : undefined,
      web_destination: webDestination ? webDestination : undefined,
      expiry: expiry.toString(),
      event_report_window: eventReportWindow.toString(),
      aggregatable_report_window: aggregatableReportWindow.toString(),
      priority: priority.toString(),
      filter_data: filterData ? filterData: undefined,
      aggregation_keys: aggregationKeys ? aggregationKeys: undefined
    }
    
    if (debugReporting)
    {
      headers['debug_reporting'] = debugReporting;
      headers['debug_key'] = debugKey;
    }
    
    res.set('Attribution-Reporting-Register-Source', JSON.stringify(headers));
    
    if (redirects)
    {
      res.set('Attribution-Reporting-Redirect', redirects);
    }
    
    res.sendStatus(200);
  } catch (err) {
    console.error(`Error while processing source request `, err.message);
    next(err);
  }
});

export { router }
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
    let convId = req.query['conv_id'];
    
    console.log('HEADERS = ' + JSON.stringify(req.headers));
    console.log('QUERY = ' + JSON.stringify(req.query));
    
    let deduplicationKey = getUniqueId();
    
    let triggerDataClick = getUniqueId();
    let triggerDataView = getUniqueId();
    
    let eventTriggersData = 
    [
      {
        //click
        "trigger_data": triggerDataClick.toString(),
        "priority": "10",
        "deduplication_key": deduplicationKey.toString(),
        "filters":
        {
          "product": ["1234"],
          "source_type": ["navigation"]
        },
        "not_filters":
        {
          "product": ["100"]
        }
      },
      {
        //view
        "trigger_data": triggerDataView.toString(),
        "priority": "1",
        "deduplication_key": deduplicationKey.toString(),
        "filters":
        {
          "product": ["1234"],
          "source_type": ["event"]
        },
        "not_filters":
        {
          "product": ["100"]
        }
      }
    ];
    
    let aggregatableTriggersData = 
    [
      {
        "key_piece": "0x400",
        "source_keys": ["campaignCounts"],
        "filters": 
        {
          "product": ["1234"],
          "ctid": ["id"]
        },
        "not_filters":
        {
          "product": ["100"]
        }
      },
      {
        "key_piece": "0xA80",
        "source_keys": ["geoValue", "nonMatch"]
      }
    ]
    
    let aggregatableValues = {
      "campaignCounts": 32768,
      "geoValue": 1664
    }
    
    let aggregatableDeduplicationKeyClick = getUniqueId();
    let aggregatableDeduplicationKeyView = getUniqueId();
        
    let aggregatableDeduplicationKeys = 
    [
      {
        //click
        "deduplication_key": aggregatableDeduplicationKeyClick.toString(),
        "filters":
        {
          "product": ["1234"],
          "source_type": ["navigation"]
        },
        "not_filters":
        {
          "product": ["100"]
        }
      },
      {
        //view
        "deduplication_key": aggregatableDeduplicationKeyView.toString(),
        "filters":
        {
          "product": ["1234"],
          "source_type": ["event"]
        },
        "not_filters":
        {
          "product": ["100"]
        }
      }
    ];
    
    let redirects = [];
    
    let debugReporting = true;
    let debugKey = biguintFormat(crypto.randomBytes(8), 'dec'); 
        
    let headers = 
    {
      event_trigger_data: eventTriggersData,
      aggregatable_trigger_data: aggregatableTriggersData,
      aggregatable_values: aggregatableValues,
      aggregatable_deduplication_keys: aggregatableDeduplicationKeys
    }
    
    if (debugReporting)
    {
      headers['debug_reporting'] = debugReporting;
      headers['debug_key'] = debugKey;
    }
    
    let response = JSON.stringify(headers);
    console.log('RESPONSE = ' + response);
    
    res.set('Attribution-Reporting-Register-Trigger', response);
    
    if (redirects)
    {
      res.set('Attribution-Reporting-Redirect', redirects);
    }
    
    res.sendStatus(200);
  } catch (err) {
    console.error(`Error while processing trigger request `, err.message);
    next(err);
  }
});

export { router }
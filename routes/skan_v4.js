import express from 'express';
const router = express.Router();

router.get('/', async function(req, res, next) {
  try {
	let ret = {}
    ret['test'] = 123;
	  
    res.json(ret);
  } catch (err) {
    console.error(`Error while processing trigger request `, err.message);
    next(err);
  }
});

export { router }
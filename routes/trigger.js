import express from 'express';
const router = express.Router();

router.post('/', async function(req, res, next) {
  try {
    res.sendStatus(200);
  } catch (err) {
    console.error(`Error while processing trigger request `, err.message);
    next(err);
  }
});

export { router }
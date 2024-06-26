import express from 'express';
const app = express();

import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3001

import { router as configRouter } from './routes/config.js';

import { router as skanV3Router } from './routes/skan_v3.js';
import { router as skanV4Router } from './routes/skan_v4.js';

import { router as skanGoogleRouter } from './routes/skan_google.js';

import { router as skanTiktokCsvRouter } from './routes/skan_tiktok_csv.js';
import { router as skanAdjustCsvRouter } from './routes/skan_adjust_csv.js';

import { router as sourceRouter } from './routes/source.js';
import { router as triggerRouter } from './routes/trigger.js';
import { router as reportRouter } from './routes/report.js';

app.enable('trust proxy');

app.use(express.static(__dirname + '/public'));

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.get('/', function (req, res) {
   res.send('Hello World');
})

app.put('/events', function (req, res) {
  res.json({ message: "ok" });
})

app.use(express.static(path.join(__dirname, 'public')));

app.use("/config", configRouter);

app.use("/skan_v3", skanV3Router);
app.use("/skan_v4", skanV4Router);

app.use("/skan_google", skanGoogleRouter);

app.use("/skan_tiktok_csv", skanTiktokCsvRouter);
app.use("/skan_adjust_csv", skanAdjustCsvRouter);

app.use("/source", sourceRouter);
app.use("/trigger", triggerRouter);

app.use("/.well-known/attribution-reporting", reportRouter);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(err.message, err.stack);
  res.status(statusCode).json({ message: err.message });
  return;
});
    
const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

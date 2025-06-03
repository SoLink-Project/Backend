import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import express from 'express';
const app = express()

import pkg from 'body-parser';
const { json } = pkg;
import { createInterface } from 'readline';
import cors from 'cors';
import { writeFile } from 'fs';
import { join } from 'path';
const port = 3000;
import { parse } from 'json2csv';
import { log, error } from './loggingSystem.js';

import pool from './database.js';
import { getError, redirectLink, counterNumber, getLINK } from "./linkShorting.js";
import { weeklyTask, monthlyTask, yearlyTask, dailyTask } from './schedule.js';

const corsOptions = {
  origin: [process.env.DOMAIN]
};

app.use(cors(corsOptions));
app.use(json());

app.get('/', (req, res) => {
  const message = 'It works!\n';
  const version = 'NodeJS ' + process.versions.node + '\n';
  const response = [message, version].join('\n');
  res.send(response);
});

app.post('/api/genlink', getError)
app.post('/api/:link', redirectLink)
app.get('/api/counter', counterNumber)
app.post('/data', getLINK);

(async () => {
  try {
    const client = await pool.connect();
    console.log(`[` + new Date().toLocaleString() + `] MYSQL succesful connect the server!`);
    promptUser()
    client.release();
  } catch (err) {
    console.error(`[` + new Date().toLocaleString() + `] Error the database connection: `, err);
  }
})();

const generateReport = () => {
  const sql = 'SELECT * FROM links';

  pool.query(sql, (err, results) => {
    if (err) {
      console.error(`[` + new Date().toLocaleString() + `] Error running the query:`, err.stack);
      return;
    }

    const fields = Object.keys(results.rows[0]);
    const csv = parse(results.rows, { fields });

    const dateForm = new Date();

    const filePath = join(__dirname, 'reports/' + dateForm.getFullYear() + dateForm.getMonth() + dateForm.getDay() + dateForm.getMinutes() + dateForm.getSeconds() + '_riportGet.csv');
    writeFile(filePath, csv, (err) => {
      if (err) {
        console.error(`[` + new Date().toLocaleString() + `] Error writing to CSV file:`, err);
        return;
      }
      console.log(`[` + new Date().toLocaleString() + `] Report has been saved to ${filePath}`);
    });
  });
};

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const promptUser = () => {
  rl.question(``, async (command) => {
    switch (command.trim()) {
      case 'exit':
        rl.close();
        process.exit(0);
      case 'getreport':
        try {
          await generateReport();
        } catch (err) {
          console.error(`[` + new Date().toLocaleString() + `] Failed to generate report:`, err);
        }
        break;
      default:
        console.log(`[` + new Date().toLocaleString() + `] Unknown command.`);
    }
    promptUser();
  });
};

app.listen(port, () => {
  log(`[` + new Date().toLocaleString() + `] Solink website server start!`)
  dailyTask.start();
  weeklyTask.start();
  monthlyTask.start();
  yearlyTask.start();
})

export default { generateReport }
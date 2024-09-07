const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require('pg');

console.log("PGDATABASE:", process.env.PGDATABASE);
console.log("PGUSER:", process.env.PGUSER);
console.log("PGPASSWORD:", process.env.PGPASSWORD);
console.log("PGHOST:", process.env.PGHOST);
console.log("PGPORT:", process.env.PGPORT);

console.log("REDIS_HOST:", process.env.REDIS_HOST);
console.log("REDIS_PORT:", process.env.REDIS_PORT);


console.log("keys.pgDatabase:", keys.pgDatabase);
console.log("keys.pgUser:", keys.pgUser);
console.log("keys.pgPassword:", keys.pgPassword);
console.log("keys.pgHost:", keys.pgHost);
console.log("keys.pgPort:", keys.pgPort);

console.log("keys.redisHost:", keys.redisHost);
console.log("keys.redisPort:", keys.redisPort);

const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
  ssl: {
    rejectUnauthorized: false,  // In production, you might want to manage certificates properly
  }
});
pgClient.on('connect', () => console.log('Successfully connected to PostgreSQL database'));
pgClient.on('error', (err) => console.error('Lost PG connection', err));


// pgClient
//   .query('CREATE TABLE IF NOT EXISTS values (number INT)')
//   .then(() => console.log('Table created or already exists'))
//   .catch(err => console.error('Error executing query', err));

const connectWithRetry = async () => {
  try {
    await pgClient.connect();
    console.log('Successfully connected to PostgreSQL database');
    await pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)');
    console.log('Table created or already exists');
  } catch (err) {
    console.error('Error connecting to the database, retrying in 10 seconds...', err);
    setTimeout(connectWithRetry, 10);
  }
};

connectWithRetry();

// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
  socket: {
    tls: false, // ==> also tried 'true', but same issue
    rejectUnauthorized: false,
    requestCert: false,
  }
});
const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * from values');

  console.log('reterieved value from db ', values.rows);
  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing yet!');
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  res.send({ working: true });
});

app.listen(5000, err => {
  console.log('Listening');
});

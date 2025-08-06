// db.js
const { Pool } = require("pg");
const types = require("pg-types");

// Decode BYTEA (OID 17) into Buffer
types.setTypeParser(17, (val) => Buffer.from(val, "hex"));

const pool = new Pool({
  user: "neondb_owner",
  host: "ep-empty-wave-a1d8z970-pooler.ap-southeast-1.aws.neon.tech",
  database: "neondb",
  password: "npg_rg1kyFJ2EiUf",
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

console.log("✔ DB Pool loaded with BYTEA support");

module.exports = pool;

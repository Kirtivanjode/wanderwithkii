// db.js
const { Pool } = require("pg");
const types = require("pg-types");

// Decode BYTEA (OID 17) into Buffer
types.setTypeParser(17, (val) => Buffer.from(val, "hex"));

const pool = new Pool({
  user: "neondb_owner",
  host: "ep-delicate-poetry-a9p7isx7-pooler.gwc.azure.neon.tech",
  database: "neondb",
  password: "npg_QC3xw5zDKSan",
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

console.log("✔ DB Pool loaded with BYTEA support");

module.exports = pool;

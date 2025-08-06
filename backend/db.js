const { Pool } = require("pg");
const types = require("pg-types");

// Decode BYTEA (OID 17) into Buffer
types.setTypeParser(17, (val) => Buffer.from(val, "hex"));

const pool = new Pool({
  user: "neondb_owner",
  host: "ep-cool-mode-a1esi39y-pooler.ap-southeast-1.aws.neon.tech",
  database: "neondb",
  password: "npg_ZPaClH7FLOq4",
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

console.log("✔ DB Pool loaded with BYTEA support");

// ✅ Test the connection
pool
  .query("SELECT NOW()")
  .then((res) =>
    console.log("✔ Connected to DB. Server time:", res.rows[0].now)
  )
  .catch((err) => console.error("❌ Connection failed:", err));

module.exports = pool;

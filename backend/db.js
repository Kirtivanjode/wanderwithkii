const { Pool } = require("pg");

const pool = new Pool({
  user: "ki",
  host: "dpg-d2ta8pvfte5s73a1l4cg-a.oregon-postgres.render.com",
  database: "wanderwithki",
  password: "mFz8W9To8E0UF32D44lJ3w3q36HueatO",
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool
  .connect()
  .then(() => console.log("Connected to PostgreSQL successfully."))
  .catch((err) => console.error("Database connection failed:", err));

module.exports = pool;

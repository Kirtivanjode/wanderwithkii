const { Pool } = require("pg");

const pool = new Pool({
  user: "ki",
  host: "dpg-d2i2b8p5pdvs73eq3g00-a.oregon-postgres.render.com",
  database: "kirti_5hp8",
  password: "9yW1OsqTBTYtlxCqtxrnshr5OawCP7RW",
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

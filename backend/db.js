// db.js
const { Pool } = require("pg");

const pool = new Pool({
  user: "ki",
  host: "dpg-d3hkdbffte5s73d12j3g-a.oregon-postgres.render.com",
  database: "wanderwithki_pffe",
  password: "Kg5zWtzM7Z6OobIQqHerFne2ugbQXCww",
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool
  .connect()
  .then(() => console.log("✅ PostgreSQL connected successfully!"))
  .catch((err) => console.error("❌ PostgreSQL connection error:", err));

module.exports = pool;

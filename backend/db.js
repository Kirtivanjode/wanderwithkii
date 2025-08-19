// db.js
const sql = require("mssql");

const dbConfig = {
  user: "sa",
  password: "admin@123",
  server: "localhost",
  database: "Travelbolg",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log("Connected to SQL Server");
    return pool;
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
  });

module.exports = { sql, poolPromise };

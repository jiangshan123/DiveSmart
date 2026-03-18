const express = require("express");
const app = express();
const port = 5000;
const supabase = require("./db");

app.get("/", (req, res) => {
  res.json({ message: "SmartDive backend running" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
// Test Supabase connection
(async () => {
  try {
    const { data, error } = await supabase.rpc("exec_sql", {
      sql: "SELECT NOW()",
    });
    if (error) {
      console.error("DB connection error:", error);
    } else {
      console.log("DB connected successfully at:", new Date().toISOString());
    }
  } catch (err) {
    console.error("DB connection error:", err.message);
  }
})();

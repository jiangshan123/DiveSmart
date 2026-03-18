const supabase = require("./db.js");

async function createTable() {
  try {
    // Drop existing table
    const { error: dropError } = await supabase.rpc("exec_sql", {
      sql: "DROP TABLE IF EXISTS dive_spots CASCADE;",
    });
    if (dropError) console.log("Drop table error:", dropError);

    // Create new table
    const { error: createError } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE dive_spots (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            region VARCHAR(50),
            latitude DECIMAL(9, 6) NOT NULL,
            longitude DECIMAL(9, 6) NOT NULL,
            facing_direction INTEGER,
            depth_max_meters DECIMAL(4, 1),
            difficulty_level VARCHAR(20),
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
    });
    if (createError) console.log("Create table error:", createError);
    else console.log("Table created successfully!");
  } catch (err) {
    console.log("Error:", err.message);
  }
}

createTable();

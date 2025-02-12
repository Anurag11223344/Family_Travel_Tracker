import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world1",
  password: "Use Your Own Postgres Password",
  port: 5444,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [
  { id: 1, name: "Anurag", color: "teal" },
  { id: 2, name: "Anmol", color: "powderblue" },
];

async function checkVisisted() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1; ",
    [currentUserId]
  );
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  return users.find((user) => user.id == currentUserId);
}

app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  const currentUser = await getCurrentUser();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color,
    error: null, // Ensures `error` is always defined
  });
  
});
app.post("/add", async (req, res) => {
  const input = req.body["country"];
  
  try {
    // Fetch the country code from the countries table
    const countryResult = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    if (countryResult.rows.length === 0) {
      return res.render("index.ejs", {
        error: "Country not found",
        countries: await checkVisisted(),
        total: (await checkVisisted()).length,
        users: users,
        color: (await getCurrentUser()).color,
      });
    }

    let countryCode = countryResult.rows[0].country_code;

    if (countryCode === "IO") {
      console.log("Detected IO, replacing with IN");
      countryCode = "IN";
    }

    // Check if the country is already in visited_countries
    const visitedResult = await db.query(
      "SELECT * FROM visited_countries WHERE country_code = $1 AND user_id = $2;",
      [countryCode, currentUserId]
    );

    if (visitedResult.rows.length > 0) {
      return res.render("index.ejs", {
        error: "Country already added",
        countries: await checkVisisted(),
        total: (await checkVisisted()).length,
        users: users,
        color: (await getCurrentUser()).color,
      });
    }

    // Insert the country into visited_countries if not already visited
    await db.query(
      "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2);",
      [countryCode, currentUserId]
    );

    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.render("index.ejs", {
      error: "An error occurred",
      countries: await checkVisisted(),
      total: (await checkVisisted()).length,
      users: users,
      color: (await getCurrentUser()).color,
    });
  }
});


app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  const result = await db.query(
    "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
    [name, color]
  );

  const id = result.rows[0].id;
  currentUserId = id;

  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

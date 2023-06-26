const express = require("express");
const app = express();
app.use(express.json());
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const dbpath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({ filename: dbpath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("server running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB error:${e.message}`);
  }
};

initializeDbAndServer();

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const query = `select * from user WHERE username='${username}';`;
  const result = await db.get(query);
  console.log(result);
  if (result === undefined) {
    if (password.length >= 6) {
      const query2 = `INSERT INTO user(username,password,name,gender)
            Values('${username}','${hashedPassword}','${name}','${gender}');`;
      await db.run(query2);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const query = `select * from user WHERE username='${username}';`;
  const result = await db.get(query);
  if (result === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, result.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "CCBP");
      response.send({ jwtToken });
      console.log({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken = null;
  const authHeader = request.headers["authorization"];
  //console.log(authHeader);
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    //console.log(jwtToken);
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "CCBP", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  //console.log(username);
  const query = `select * from user Where username='${username}';`;
  const result = await db.get(query);
  const query2 = `select * from follower where follower_user_id=${result.user_id};`;
  const result2 = await db.all(query2);
  const query3 = `select * from tweet  where tweet_id=${result2[0].following_user_id} AND ${result2[1].following_user_id};`;
  const result3 = await db.all(query3);
  response.send(result3);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  //console.log(username);
  const query = `select * from user Where username='${username}';`;
  const result = await db.get(query);
  const query2 = `select * from follower where follower_user_id=${result.user_id};`;
  const result2 = await db.all(query2);
  const query3 = `select name from user  where user_id=${result2[0].following_user_id} AND  ${result2[1].following_user_id};`;
  const result3 = await db.all(query3);
  response.send(result3);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  //console.log(username);
  const query = `select * from user Where username='${username}';`;
  const result = await db.get(query);
  const query2 = `select * from follower where follower_user_id=${result.user_id};`;
  const result2 = await db.all(query2);
  const query3 = `select name from user  where user_id=${result2[0].following_user_id} AND  ${result2[1].following_user_id};`;
  const result3 = await db.all(query3);
  response.send(result3);
});

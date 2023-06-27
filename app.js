const express = require("express");
const app = express();
app.use(express.json());
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const date = require("date-fns/addDays");
const format = require("date-fns/format");

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
  const query2 = `select user.username,tweet.tweet,tweet.date_time AS datetime  from follower 
  INNER JOIN tweet ON follower.following_user_id=tweet.user_id 
  inner join user on tweet.user_id=user.user_id where follower.follower_user_id=${result.user_id} order by datetime desc limit 4;`;
  const result2 = await db.all(query2);
  console.log(result2);
  response.send(result2);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  //console.log(username);
  const query = `select * from user Where username='${username}';`;
  const result = await db.get(query);
  const query2 = `select distinct user.username  from follower 
  INNER JOIN user ON follower.following_user_id=user.user_id where follower.follower_user_id=${result.user_id};`;
  const result2 = await db.all(query2);
  console.log(result2);
  response.send(result2);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  //console.log(username);
  const query = `select * from user Where username='${username}';`;
  const result = await db.get(query);
  const query2 = `select distinct user.username  from follower
  INNER  join user on follower.follower_user_id=user.user_id where follower.following_user_id=${result.user_id};`;
  const result2 = await db.all(query2);
  console.log(result2);
  response.send(result2);
});

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const query = `select * from user WHERE username='${username}';`;
  const result = await db.get(query);
  //const query1 = `select tweet from tweet WHERE user_id='${result.user_id}';`;
  const query1 = `select tweet,count(like_id) AS likes,count(reply) AS replies, date_time AS dateTime from tweet INNER join reply ON tweet.user_id=reply.user_id
  INNER join like ON reply.user_id=like.user_id where tweet.user_id='${result.user_id}';`;
  const result1 = await db.all(query1);
  response.send(result1);
});

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const today = date(new Date(), 0);
  //console.log(today);
  const { username } = request;
  const query = `select * from user WHERE username='${username}';`;
  const result = await db.get(query);
  const { tweet, user_id = result.user_id, date_time = today } = request.body;
  const query1 = `INSERT INTO tweet(tweet,user_id,date_time)
  Values('${tweet}',${user_id},'${date_time}');`;
  const result1 = await db.run(query1);
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const query = `select * from user WHERE username='${username}';`;
    const result = await db.get(query);
    const { tweetId } = request.params;
    const query1 = `select tweet_id from tweet Where user_id=${result.user_id};`;
    const result1 = await db.all(query1);
    console.log(result1);
    const arr = [];
    for (eachItem of result1) {
      arr.push(eachItem.tweet_id);
    }
    console.log(arr);
    console.log(tweetId);
    if (arr.includes(parseInt(tweetId))) {
      const query2 = `Delete from tweet  Where tweet_id=${tweetId} AND user_id=${result.user_id};`;
      const result2 = await db.all(query2);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);


// Run this script to launch the server.
// The server should run on localhost port 8000.
// This is where you should start writing server-side code for this application.

// For authetiation: 

const session = require('express-session');
const MongoStore = require('connect-mongo'); // for adding session Ids to our database to store user information and etc.
const bcrypt = require('bcrypt');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const app = express();
const port = 8000;

// Models: 
const QuestionModel = require('./models/questions');
const AnswerModel = require('./models/answers');
const TagModel = require('./models/tags');
const UserModel = require('./models/users');
const CommentModel = require('./models/comments');

app.use(cors({ credentials: true, origin: 'http://localhost:3000'}));
app.use(express.json())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: false })); //?
app.use(cookieParser());

app.use(
    session({
      secret: "supersecret difficult to guess string",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: true
      }
    })
);

// Connect to database:
let mongoDB = 'mongodb://127.0.0.1:27017/fake_so';
mongoose.connect(mongoDB, {useNewUrlParser: true, useUnifiedTopology: true});
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

const saltRounds = 10;

const isAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        next();
    }
    else {
        res.status(403).json({ error: 'Access Forbidden' });
    }
};

app.get('/admin/dashboard', isAdmin, (req, res) => {
    // add stuff
});

app.delete('/admin/users/:userId', isAdmin, async (req, res) => {
    const userId = req.params.userId;
    try {
        await UserModel.findByIdAndDelete(userId);
        res.json({ success: true, message: 'User deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.get('/questions', async (req, res) => {
    try {
        const questions = await QuestionModel.find().populate('answers').populate('tags');
        res.json(questions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/specificQuestion', async (req, res) => {
    try {
        const question = await QuestionModel.findById(req.body.qid).populate('answers').populate('tags').populate('comments');
        res.json(question);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.get('/tags', async (req, res) => {
    try {
        const tags = await TagModel.find()
        res.json(tags);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/answers/:questionId', async (req, res) => {
    try {
        const questionId = req.params.questionId
        const question = await QuestionModel.findById(questionId).populate('answers');
        res.json(question.answers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/questions', async (req, res) => {
    try {
        const tagIds = await Promise.all(req.body.new_tags.map(async (tagName) => {
            let tag = await TagModel.findOne({ name: tagName });
            if (!tag) {
                tag = new TagModel({ name: tagName });
                await tag.save();
            }
            return tag._id;
        }));
        const newQuestion = new QuestionModel({title: req.body.new_title, text: req.body.new_text, tags: tagIds, summary: req.body.new_summary, asked_by: req.session.user.username, userID: req.session.user.id});
        const savedQuestion = await newQuestion.save();
        res.json(savedQuestion);
    } catch(error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/answers', async (req, res) => {
    try {
        const newAnswer = new AnswerModel({text: req.body.answer_text, ans_by: req.session.user.username, answer_id: req.session.user.id});
        const savedAnswer = await newAnswer.save();
        const updatedQuestion = await QuestionModel.findByIdAndUpdate(
            req.body.question_id,
            { $push: { answers: savedAnswer._id } },
            { new: true }
        );

        res.json({ answer: savedAnswer, updatedQuestion });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/questionComment', async (req, res) => {
    try {
        const newComment = new CommentModel({ text: req.body.comment_text, comment_by: req.session.user.username, commenter_id: req.session.user.id });
        const savedComment = await newComment.save();
        const updatedQuestion = await QuestionModel.findByIdAndUpdate(
            req.body.question_id,
            { $push: { comments: savedComment._id } },
            { new: true }
        );
        res.json({ comment: savedComment, updatedQuestion});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// FOR REGISTERING NEW USER:
app.post('/register', async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(saltRounds); // random value generated just for that user
        const uid = req.body.username;
        const pwHash = await bcrypt.hash(req.body.password, salt); //digest we are storing     
        const newUser = new UserModel({username: uid, email: req.body.email, passwordHash: pwHash}); // storing hashed password
        const savedUser = await newUser.save();
        res.json(savedUser);
    }catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/users', async (req, res) => {
    try {
        const users = await UserModel.find()
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/login', async (req, res) => {
    res.send(`<html><body>
      <h1>Login</h1>
        <form action="/login" method="POST">
          <input type="text" name="name" placeholder="Your name"><br>
          <input type="password" name="pw" placeholder="Enter a password"><br>
          <button>Login</button>
        </form>
      </body></html>`);
});

app.post('/login', async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    const user = (await UserModel.find({email: email}).exec())[0];
    if (user) {
        const verdict = await bcrypt.compare(password, user.passwordHash);
        if (verdict) {
            req.session.user = {
                email: email,
                id: user._id,
                username: user.username,
                role: user.role,
                reputation: user.reputation,
                createdAt: user.createdAt
            };
            res.json({ success: true, message: 'login successful', role: user.role }); // removed session: req.session
        }
        else {
            return res.status(401).json({ success: false, errorMessage: "Wrong email address or password"});
        }
    }
    else {
        return res.status(401).json({ sucess: false, errorMessage: "Wrong email address or password"});
    }
});

app.post('/admin-override', isAdmin, (req, res) => {
    try{
        req.session.user = {
            email: req.userData.email,
            id: req.userData._id,
            username: req.userData.username,
            role: req.userData.role,
            reputation: req.userData.reputation,
            createdAt: req.userData.createdAt
        };
        res.json({ success: true, message: 'Admin override successful' });
    } catch (error) {
        console.error(error);
    }
});

app.get('/session-user', (req, res) => {
    if (req.session && req.session.user) {
        const userInfo = {
            role: req.session.user.role,
            memberSince: req.session.user.createdAt,
            reputation: req.session.user.reputation
        };
        res.json(userInfo);
    }
    else {
        res.status(401).json({ error: 'User not logged in' });
    }
});
  
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            res.status(500).json({ success: false, errorMessage: 'Logout failed' });
        }
        else {
            res.clearCookie('connect.sid', { path: '/'});
            res.sendStatus(200);
        }
    });
});

app.get('/search', async (req, res) => {
    try {
        const searchQuery = req.query.q;
        const tagRegex = /\[([^\]]+)\]/g; // Regex to match tags in square brackets
        const tagMatches = searchQuery.match(tagRegex);
        const tags = tagMatches ? tagMatches.map(match => match.slice(1, -1)) : [];

        const nonTagWords = searchQuery.replace(tagRegex, '').trim().toLowerCase().split(/\s+/);

        const queryConditions = {
            $or: [
                { title: { $regex: new RegExp(nonTagWords.join('|'), 'i') } },
                { text: { $regex: new RegExp(nonTagWords.join('|'), 'i') } },
                { tags: { $in: tags.map(tag => new RegExp(tag, 'i')) } },
            ],
        };

        const questions = await QuestionModel.find(queryConditions).populate('answers').populate('tags');
        res.json(questions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.post('/updateViews', async (req, res) => {
    try {
        const { question } = req.body;
        const question1 = await QuestionModel.findByIdAndUpdate(question._id, { $inc: { views: 1 } }, { new: true });    
        res.json(question1);
    } catch (error) {
        console.error('Error updating views:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  app.post('/incrementVotes', async (req, res) => {
    try {
        const { question } = req.body;
        const question1 = await QuestionModel.findByIdAndUpdate(question._id, { $inc: { votes: 1 } }, { new: true });
        res.json(question1.votes);
    } catch (error) {
        console.error('Error updating views:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/decrementVotes', async (req, res) => {
    try {
        const { question } = req.body;
        const question1 = await QuestionModel.findByIdAndUpdate(question._id, { $inc: { votes: -1 } }, { new: true });
        res.json(question1.votes);
        
    } catch (error) {
        console.error('Error updating views:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/incrementAnswerVotes', async (req, res) => {
    try {
        const { answerId} = req.body;
        const answer1 = await AnswerModel.findByIdAndUpdate(answerId, { $inc: { votes: 1 } }, { new: true });
        res.json(answer1.votes);
    } catch (error) {
        console.error('Error updating views:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/decrementAnswerVotes', async (req, res) => {
    try {
        const { answerId } = req.body;
        const answer1 = await AnswerModel.findByIdAndUpdate(answerId, { $inc: { votes: -1 } }, { new: true });
        res.json(answer1.votes);
        
    } catch (error) {
        console.error('Error updating views:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/editReputation', async (req, res) => {
    try {
        let user;
        if (req.body.edit === 'increase') {
            user = await UserModel.findByIdAndUpdate(req.body.userID, { $inc: { reputation: 5 } }, { new: true });
        }
        else if (req.body.edit === 'decrease') {
            user = await UserModel.findByIdAndUpdate(req.body.userID, { $inc: { reputation: -10 } }, { new: true });
        }
        if (user) {
            res.json({ success: true, reputation: user.reputation });
            console.log(user.reputation);
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch(error) {
        console.error('Error editing reputation:', error);
        res.status(500).json({ success: false });
    }
  });

app.listen(port, ()=> {
    console.log(`Server running on port ${port}`);
});


```javascript
// frontend/JwtAuthForm.jsx
import { useState } from "react";
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
});

export default function JwtAuthForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");

  const register = async () => {
    try {
      const res = await api.post("/register", formData);

      // Save JWT token in localStorage
      localStorage.setItem("token", res.data.token);

      setUser(res.data.user);
      setMessage("Registered successfully");
    } catch (err) {
      setMessage(err.response?.data?.message || "Register failed");
    }
  };

  const login = async () => {
    try {
      const res = await api.post("/login", formData);

      // Store token after login
      localStorage.setItem("token", res.data.token);

      setUser(res.data.user);
      setMessage("Logged in successfully");
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed");
    }
  };

  const checkMe = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await api.get("/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUser(res.data);
      setMessage("User is authenticated");
    } catch (err) {
      setUser(null);
      setMessage("Not authenticated");
    }
  };

  const logout = () => {
    // JWT logout usually means removing the token
    localStorage.removeItem("token");

    setUser(null);
    setMessage("Logged out");
  };

  return (
    <div>
      <h2>JWT Auth</h2>

      <input
        placeholder="Email"
        value={formData.email}
        onChange={(e) =>
          setFormData({ ...formData, email: e.target.value })
        }
      />

      <input
        placeholder="Password"
        type="password"
        value={formData.password}
        onChange={(e) =>
          setFormData({ ...formData, password: e.target.value })
        }
      />

      <button onClick={register}>Register</button>
      <button onClick={login}>Login</button>
      <button onClick={checkMe}>Check Me</button>
      <button onClick={logout}>Logout</button>

      <p>{message}</p>

      {user && <p>Logged in as: {user.email}</p>}
    </div>
  );
}
```

```javascript
// backend/jwt-auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

const users = [];

const JWT_SECRET = "my-jwt-secret";

// Register route
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  const existingUser = users.find((user) => user.email === email);

  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    id: Date.now(),
    email,
    password: hashedPassword,
  };

  users.push(newUser);

  // Create JWT token
  const token = jwt.sign(
    { userId: newUser.id }, // payload stored inside token
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
    },
  });
});

// Login route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((user) => user.email === email);

  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  // Create JWT after successful login
  const token = jwt.sign(
    { userId: user.id },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
    },
  });
});

// Middleware to protect private routes
function protectRoute(req, res, next) {
  const authHeader = req.headers.authorization;

  // Expected format: Authorization: Bearer token_here
  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Save decoded user id on request object
    req.userId = decoded.userId;

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Current user route
app.get("/api/me", protectRoute, (req, res) => {
  const user = users.find((user) => user.id === req.userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({
    id: user.id,
    email: user.email,
  });
});

// JWT logout is usually handled on frontend
app.post("/api/logout", (req, res) => {
  // Server does not destroy anything unless using token blacklist
  res.json({ message: "Logout by deleting token on frontend" });
});

app.listen(8080, () => {
  console.log("JWT auth server running on port 8080");
});
```

```javascript
// backend/session-auth.js
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import cors from "cors";

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true, // allows browser to send cookies
  })
);

// In-memory fake database
const users = [];

// Session middleware
app.use(
  session({
    secret: "my-session-secret", // used to sign the session ID cookie
    resave: false, // do not save unchanged sessions
    saveUninitialized: false, // do not create session until something is stored
    cookie: {
      httpOnly: true, // frontend JS cannot access cookie
      secure: false, // true only in HTTPS production
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  })
);

// Register route
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  const existingUser = users.find((user) => user.email === email);

  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    id: Date.now(),
    email,
    password: hashedPassword,
  };

  users.push(newUser);

  // Store user id in the session
  req.session.userId = newUser.id;

  res.json({ id: newUser.id, email: newUser.email });
});

// Login route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((user) => user.email === email);

  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  // Save user id inside server-side session
  req.session.userId = user.id;

  res.json({ id: user.id, email: user.email });
});

// Check current logged-in user
app.get("/api/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const user = users.find((user) => user.id === req.session.userId);

  res.json({ id: user.id, email: user.email });
});

// Logout route
app.post("/api/logout", (req, res) => {
  // Destroy session on server
  req.session.destroy(() => {
    res.clearCookie("connect.sid"); // remove session cookie
    res.json({ message: "Logged out" });
  });
});

app.listen(8080, () => {
  console.log("Session auth server running on port 8080");
});
```

```javascript
// frontend/SessionAuthForm.jsx
import { useState } from "react";
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
  withCredentials: true, // important: send cookies with requests
});

export default function SessionAuthForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");

  const register = async () => {
    try {
      const res = await api.post("/register", formData);
      setUser(res.data);
      setMessage("Registered successfully");
    } catch (err) {
      setMessage(err.response?.data?.message || "Register failed");
    }
  };

  const login = async () => {
    try {
      const res = await api.post("/login", formData);
      setUser(res.data);
      setMessage("Logged in successfully");
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed");
    }
  };

  const checkMe = async () => {
    try {
      const res = await api.get("/me");
      setUser(res.data);
      setMessage("User is authenticated");
    } catch (err) {
      setUser(null);
      setMessage("Not authenticated");
    }
  };

  const logout = async () => {
    await api.post("/logout");
    setUser(null);
    setMessage("Logged out");
  };

  return (
    <div>
      <h2>Session Auth</h2>

      <input
        placeholder="Email"
        value={formData.email}
        onChange={(e) =>
          setFormData({ ...formData, email: e.target.value })
        }
      />

      <input
        placeholder="Password"
        type="password"
        value={formData.password}
        onChange={(e) =>
          setFormData({ ...formData, password: e.target.value })
        }
      />

      <button onClick={register}>Register</button>
      <button onClick={login}>Login</button>
      <button onClick={checkMe}>Check Me</button>
      <button onClick={logout}>Logout</button>

      <p>{message}</p>

      {user && <p>Logged in as: {user.email}</p>}
    </div>
  );
}
```

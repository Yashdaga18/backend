const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs/promises'); // Use fs.promises for async file operations

const saltRounds = 10; // Rename salt to saltRounds for clarity
const secret = 'your-secret-key'; // Replace with your secret key, consider using environment variables
const PORT = process.env.PORT || 4000; // Use environment variable for port

const app = express();

app.use(cors({ credentials: true, origin: 'http://13.49.60.104:3000' }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect('mongodb+srv://yashdaga7019:KhHVuE9vk9xy5Zwu@cluster0.qk5xwfv.mongodb.net/testron', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const userDoc = await User.create({
      username,
      password: hashedPassword,
    });
    res.json(userDoc);
  } catch (e) {
    console.error(e);
    res.status(400).json(e);
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.findOne({ username });
    if (!userDoc) {
      return res.status(400).json('User not found');
    }

    const passOk = await bcrypt.compare(password, userDoc.password);
    if (!passOk) {
      return res.status(400).json('Wrong credentials');
    }

    // Generate and send a JWT token upon successful login
    const token = jwt.sign({ username, id: userDoc._id }, secret);
    res.cookie('token', token).json({
      id: userDoc._id,
      username,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json('Internal server error');
  }
});

app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json('Unauthorized');
  }

  jwt.verify(token, secret, (err, info) => {
    if (err) {
      return res.status(401).json('Unauthorized');
    }
    res.json(info);
  });
});

// Handle logout by clearing the token cookie
app.post('/logout', (req, res) => {
  res.clearCookie('token').json('Logged out');
});

app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split('.');
  const ext = parts[parts.length - 1];
  const newPath = path + '.' + ext;

  try {
    await fs.rename(path, newPath);

    const { token } = req.cookies;
    jwt.verify(token, secret, async (err, info) => {
      if (err) {
        return res.status(401).json('Unauthorized');
      }
      const { title, summary, content } = req.body;
      const postDoc = await Post.create({
        title,
        summary,
        content,
        cover: newPath,
        author: info.id,
      });
      res.json(postDoc);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json('Internal server error');
  }
});

app.put('/post/:id', uploadMiddleware.single('file'), async (req, res) => {
  const { id } = req.params;
  let newPath = null;

  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path + '.' + ext;
    await fs.rename(path, newPath);
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, async (err, info) => {
    if (err) {
      return res.status(401).json('Unauthorized');
    }

    try {
      const { title, summary, content } = req.body;
      const postDoc = await Post.findById(id);

      if (!postDoc) {
        return res.status(404).json('Post not found');
      }

      const isAuthor = postDoc.author.equals(info.id);

      if (!isAuthor) {
        return res.status(400).json('You are not the author');
      }

      postDoc.title = title;
      postDoc.summary = summary;
      postDoc.content = content;
      postDoc.cover = newPath || postDoc.cover;

      await postDoc.save();

      res.json(postDoc);
    } catch (error) {
      console.error(error);
      res.status(500).json('Internal server error');
    }
  });
});

app.get('/post', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', ['username'])
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json('Internal server error');
  }
});

app.get('/post/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const postDoc = await Post.findById(id).populate('author', ['username']);
    if (!postDoc) {
      return res.status(404).json('Post not found');
    }
    res.json(postDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json('Internal server error');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

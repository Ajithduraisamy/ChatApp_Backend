const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const Chat = require("./models/Chat");
const Message = require("./models/Message");
const User = require("./models/User");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const URL = process.env.DB_URL;
const JWT_SECRET = process.env.JWT_SECRET;

mongoose.connect(URL);

app.use(express.json());
app.use(cors({
  origin: "http://localhost:5173"
}));

// Middleware to authenticate requests with JWT
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "User Not Authorized" });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Invalid Token" });
    }
    req.user = user;
    next();
  });
}

app.post("/register", async (req, res) => {
  try {
    const salt = bcrypt.genSaltSync(9);
    const hash = bcrypt.hashSync(req.body.password, salt);
    req.body.password = hash;

    const user = new User(req.body);
    await user.save();
    res.json({ message: "User Created!" });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      const isPassword = bcrypt.compareSync(req.body.password, user.password);
      if (isPassword) {
        const token = jwt.sign(
          { id: user._id, username: user.username },
          JWT_SECRET
        );
        res.json({ token, userId: user._id });
      } else {
        res.status(404).json({ message: "Invalid credentials" });
      }
    } else {
      res.status(404).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});

app.get("/contacts", authenticate, async (req, res) => {
  try {
    const contacts = await User.find({ _id: { $ne: req.user.id } });
    res.json({ contacts });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});

app.get("/user/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ userId: user._id, username: user.username });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});

app.get("/user-profile/:userId", authenticate, async (req, res) => {
  const userId = req.params.userId;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid userId' });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post("/chats/private", authenticate, async (req, res) => {
  try {
    const { recipientId } = req.body;
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const existingChat = await Chat.findOne({
      isGroupChat: false,
      users: { $all: [req.user.id, recipientId] }
    });

    if (existingChat) {
      return res.json({ chat: existingChat });
    }

    const chat = new Chat({
      isGroupChat: false,
      users: [req.user.id, recipientId]
    });

    await chat.save();
    res.json({ chat });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});

app.get("/chats/private", authenticate, async (req, res) => {
  try {
    const chats = await Chat.find({
      isGroupChat: false,
      users: req.user.id
    });
    res.json({ chats });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});

app.post("/chats/private/:chatId/messages", authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text } = req.body;

    const chat = await Chat.findOne({
      _id: chatId,
      isGroupChat: false,
      users: req.user.id
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const newMessage = new Message({
      sender: req.user.id,
      content: text,
      chat: chatId
    });

    await newMessage.save();

    chat.latestMessage = newMessage._id;
    await chat.save();

    const recipientId = chat.users.find(userId => userId !== req.user.id);

    // Emit the new message to the chat room
    io.to(chatId).emit('receiveMessage', {
      ...newMessage.toObject(),
      sender: { _id: req.user.id, username: req.user.username }
    });

    // Emit notification to the recipient only
    io.to(recipientId).emit('newNotification', { message: "You have a new message." });

    res.json({ message: "Message sent successfully", newMessage });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});


app.get("/chats/:chatId/messages", authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const messages = await Message.find({ chat: chatId }).populate("sender", "username");
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});

app.get("/chats/recent", authenticate, async (req, res) => {
  try {
    const recentChats = await Chat.find({ users: req.user.id })
      .populate("users", "username")
      .populate("latestMessage")
      .sort({ updatedAt: -1 });

    res.json({ recentChats });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});

app.post("/groups", authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    const group = new Group({
      name,
      users: [req.user.id]
    });
    await group.save();
    res.json({ group });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});

app.post("/groups/:groupId/join", authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    group.users.addToSet(req.user.id);
    await group.save();
    res.json({ group });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});

app.get("/groups", authenticate, async (req, res) => {
  try {
    const groups = await Group.find({ users: req.user.id });
    res.json({ groups });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});

// Socket.io middleware for authentication
io.use((socket, next) => {
  if (socket.handshake.query && socket.handshake.query.token) {
    jwt.verify(socket.handshake.query.token, JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = decoded;
      next();
    });
  } else {
    next(new Error('Authentication error'));
  }
}).on('connection', (socket) => {
  console.log('A user connected:', socket.user);

 // Handle 'sendMessage' event
socket.on('sendMessage', async (message) => {
  console.log('Received sendMessage event:', message);
  const { content, chatId } = message;
  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      console.error("Chat not found with ID:", chatId);
      socket.emit('error', 'Chat not found');
      return;
    }

    console.log('Authenticated user ID:', socket.user.id);
    const newMessage = new Message({
      sender: socket.user.id,
      content,
      chat: chatId
    });
    await newMessage.save();

    chat.latestMessage = newMessage._id;
    await chat.save();

    // Emit the new message to the chat room
    io.to(chatId).emit('receiveMessage', {
      ...newMessage.toObject(),
      sender: { _id: socket.user.id, username: socket.user.username }
    });
  } catch (error) {
    console.error("Error sending message:", error.message);
  }
});

  // Handle 'joinRoom' event
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log('User joined room:', roomId);
  });

  // Handle 'leaveRoom' event
  socket.on('leaveRoom', (roomId) => {
    socket.leave(roomId);
    console.log('User left room:', roomId);
  });

  // Handle socket disconnection
  socket.on('disconnect', (reason) => {
    console.log('User disconnected:', reason);
  });
});

// Server routes for managing chats and groups omitted for brevity

const PORT = process.env.PORT || 3002;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

**Backend for MERN Stack Chat Application with Socket.io.**
  This repository contains the backend code for a real-time chat application built using Node.js, Express.js, MongoDB, and Socket.io.

**Features**
  Real-time Messaging: Users can send and receive messages instantly using Socket.io.
  User Authentication: Secure login and registration functionality.
  Database Integration: MongoDB for storing chat messages and user data.
  
**Technologies Used**
  Node.js: Backend JavaScript runtime.
  Express.js: Web framework for Node.js.
  MongoDB: NoSQL database for storing data.
  Socket.io: Real-time bidirectional event-based communication.
  
**Getting Started**

  To run this backend application locally, follow these steps:
  
  1. Clone the repository
      git clone https://github.com/Ajithduraisamy/ChatApp_Backend.git
     
  2. Install dependencies
      npm install
  
  3. Set up environment variables
      Create a ".env" file in the root directory and specify the following variables:
      PORT=3002
      MONGO_URI=your_mongodb_uri
      JWT_SECRET=your_jwt_secret
  
  4. Run the application
      npm start
  
  5. Socket.io Integration
      Socket.io is integrated with the Express server. Real-time messaging functionality can be accessed using socket events (io.on('connection', ...), socket.emit(...), socket.on(...)).

**Contributing**
  Contributions are welcome! Please fork the repository and create a pull request with your improvements.

**Acknowledgments**
  Special thanks to Socket.io for enabling real-time communication.

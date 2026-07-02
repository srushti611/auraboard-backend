import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './db';

dotenv.config();

const app = express();
// Force explicit number parsing right away
const port: number = parseInt(process.env.PORT || '5000', 10);

app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

io.on('connection', (socket) => {
  console.log(`👤 Connected: ${socket.id}`);
  socket.on('join-group', ({ groupName, userName }) => {
    const roomID = groupName.trim().toLowerCase();
    socket.join(roomID);
    console.log(`🚪 User [${userName}] joined room: ${roomID}`);
  });
  socket.on('draw-stroke', (data) => {
    socket.to(data.groupName.trim().toLowerCase()).emit('recv-stroke', data);
  });
});

app.post('/api/groups/join', async (req, res) => {
  console.log('📥 Request received for room:', req.body.groupName);
  try {
    const { groupName } = req.body;
    if (!groupName) return res.status(400).json({ error: 'Name required' });
    const roomID = groupName.trim().toLowerCase();

    const existing = await query('SELECT * FROM whiteboard_rooms WHERE id = $1', [roomID]);
    if (existing.rows.length > 0) {
      return res.json({ status: 'joined', group: existing.rows[0] });
    }

    const newRoom = await query(
      'INSERT INTO whiteboard_rooms (id, name) VALUES ($1, $2) RETURNING *',
      [roomID, groupName.trim()]
    );
    return res.status(201).json({ status: 'created', group: newRoom.rows[0] });
  } catch (err) {
    console.error('❌ DATABASE ERROR:', err);
    return res.status(500).json({ error: 'DB Connection failed.' });
  }
});

// Use absolute simplest method signature to remove parameter overload bugs completely
server.listen(port, () => {
  console.log(`🚀 AuraBoard Backend operational on port: ${port}`);
});